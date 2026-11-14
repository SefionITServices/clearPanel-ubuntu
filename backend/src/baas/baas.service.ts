import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { exec as execCb } from 'child_process';
import { promisify } from 'util';
import * as fsp from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { getDataFilePath, getDataDir } from '../common/paths';
import { BaasInstance, CreateBaasDto, BaasSdkSnippet, BaasOverviewStats } from './baas.types';

const exec = promisify(execCb);

@Injectable()
export class BaasService {
  private readonly logger = new Logger(BaasService.name);
  private instancesFile = getDataFilePath('baas-instances.json');

  private async readInstances(): Promise<BaasInstance[]> {
    try {
      const data = await fsp.readFile(this.instancesFile, 'utf8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  private async writeInstances(instances: BaasInstance[]): Promise<void> {
    await fsp.mkdir(path.dirname(this.instancesFile), { recursive: true });
    await fsp.writeFile(this.instancesFile, JSON.stringify(instances, null, 2), 'utf8');
  }

  async getBinaryPath(): Promise<string | null> {
    const candidates = [
      '/usr/local/bin/pocketbase',
      '/opt/clearpanel/bin/pocketbase',
      path.join(process.cwd(), 'bin', 'pocketbase'),
    ];

    for (const c of candidates) {
      try {
        await fsp.access(c);
        return c;
      } catch {
        // continue
      }
    }

    try {
      const { stdout } = await exec('which pocketbase');
      if (stdout.trim()) {
        return stdout.trim();
      }
    } catch {
      // not found
    }

    return null;
  }

  async ensureBinaryInstalled(): Promise<{ installed: boolean; path?: string; version?: string; error?: string }> {
    const existing = await this.getBinaryPath();
    if (existing) {
      try {
        const { stdout } = await exec(`"${existing}" --version`);
        return { installed: true, path: existing, version: stdout.trim() };
      } catch {
        return { installed: true, path: existing, version: 'installed' };
      }
    }

    // Attempt installation on Linux
    if (os.platform() === 'linux') {
      try {
        this.logger.log('PocketBase not found. Downloading latest Linux binary...');
        const arch = os.arch() === 'arm64' ? 'arm64' : 'amd64';
        const version = '0.22.20';
        const url = `https://github.com/pocketbase/pocketbase/releases/download/v${version}/pocketbase_${version}_linux_${arch}.zip`;
        const tmpZip = `/tmp/pocketbase_${Date.now()}.zip`;
        const dest = '/usr/local/bin/pocketbase';

        await exec(`curl -fSL "${url}" -o "${tmpZip}"`, { timeout: 60000 });
        await exec(`unzip -o "${tmpZip}" pocketbase -d /usr/local/bin/`, { timeout: 30000 });
        await exec(`chmod +x "${dest}"`);
        await fsp.unlink(tmpZip).catch(() => {});

        this.logger.log(`PocketBase v${version} installed successfully at ${dest}`);
        return { installed: true, path: dest, version: `v${version}` };
      } catch (err: any) {
        this.logger.error(`Failed to automatically install PocketBase: ${err.message}`);
        return { installed: false, error: err.message };
      }
    }

    return { installed: false, error: 'Automatic installation is currently supported on Linux Ubuntu.' };
  }

  async getOverviewStats(): Promise<BaasOverviewStats> {
    const bin = await this.ensureBinaryInstalled();
    const instances = await this.listInstances();
    const running = instances.filter((i) => i.status === 'running').length;

    return {
      installed: bin.installed,
      pocketbaseVersion: bin.version,
      totalInstances: instances.length,
      runningInstances: running,
    };
  }

  private async findAvailablePort(startPort = 8090): Promise<number> {
    const instances = await this.readInstances();
    const takenPorts = new Set(instances.map((i) => i.port));

    let candidate = startPort;
    while (takenPorts.has(candidate)) {
      candidate++;
    }

    // Verify on system
    for (let p = candidate; p < candidate + 100; p++) {
      if (takenPorts.has(p)) continue;
      try {
        const { stdout } = await exec(`ss -tuln | grep ":${p} " || true`);
        if (!stdout.trim()) {
          return p;
        }
      } catch {
        return p;
      }
    }

    return candidate;
  }

  async listInstances(): Promise<BaasInstance[]> {
    const instances = await this.readInstances();

    // Check live statuses
    const updated = await Promise.all(
      instances.map(async (inst) => {
        let isRunning = false;
        let pid: number | undefined;

        if (os.platform() === 'linux') {
          try {
            const { stdout } = await exec(`systemctl is-active clearbaas-${inst.id} 2>/dev/null || true`);
            isRunning = stdout.trim() === 'active';
            if (isRunning) {
              const { stdout: pidOut } = await exec(`systemctl show -p MainPID --value clearbaas-${inst.id} 2>/dev/null || true`);
              const parsedPid = parseInt(pidOut.trim(), 10);
              if (parsedPid > 0) pid = parsedPid;
            }
          } catch {
            // fallback port check
          }
        }

        if (!isRunning) {
          try {
            const { stdout } = await exec(`curl -s -f http://127.0.0.1:${inst.port}/api/health 2>/dev/null || true`);
            if (stdout && stdout.includes('200')) {
              isRunning = true;
            }
          } catch {
            // not running
          }
        }

        return {
          ...inst,
          status: isRunning ? ('running' as const) : ('stopped' as const),
          pid,
        };
      }),
    );

    return updated;
  }

  async getInstance(id: string): Promise<BaasInstance> {
    const instances = await this.listInstances();
    const inst = instances.find((i) => i.id === id);
    if (!inst) {
      throw new NotFoundException(`BaaS instance "${id}" not found`);
    }
    return inst;
  }

  async createInstance(dto: CreateBaasDto): Promise<BaasInstance> {
    if (!dto.name || !dto.name.trim()) {
      throw new BadRequestException('Instance name is required.');
    }

    if (!dto.adminEmail || !dto.adminEmail.includes('@')) {
      throw new BadRequestException('Valid admin email is required for initial superuser account.');
    }

    await this.ensureBinaryInstalled();

    const instances = await this.readInstances();
    const slug = dto.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const id = `baas-${slug}-${crypto.randomBytes(2).toString('hex')}`;

    const port = dto.port || (await this.findAvailablePort(8090));

    // Data directory
    const baseDataDir = os.platform() === 'linux' ? '/var/lib/clearpanel/baas' : path.join(getDataDir(), 'baas');
    const instanceDataDir = path.join(baseDataDir, id, 'pb_data');
    await fsp.mkdir(instanceDataDir, { recursive: true });

    // Host configuration
    const host = dto.domain ? dto.domain.trim() : `localhost:${port}`;
    const protocol = dto.domain ? 'https' : 'http';
    const apiUrl = `${protocol}://${host}`;
    const adminUrl = `${apiUrl}/_/`;

    const binaryPath = (await this.getBinaryPath()) || '/usr/local/bin/pocketbase';
    const adminPassword = dto.adminPassword || crypto.randomBytes(8).toString('hex') + 'A1!';

    // Setup initial superuser in pb_data
    try {
      await exec(`"${binaryPath}" superuser upsert "${dto.adminEmail}" "${adminPassword}" --dir="${instanceDataDir}"`);
      this.logger.log(`Created initial superuser for BaaS instance "${id}": ${dto.adminEmail}`);
    } catch (err: any) {
      this.logger.warn(`Could not pre-seed superuser: ${err.message}. Admin can register on first visit to /_/`);
    }

    // Create systemd service on Linux
    if (os.platform() === 'linux') {
      const serviceFile = `/etc/systemd/system/clearbaas-${id}.service`;
      const serviceContent = `[Unit]
Description=ClearPanel BaaS Instance (${dto.name})
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${path.dirname(instanceDataDir)}
ExecStart=${binaryPath} serve --http=127.0.0.1:${port} --dir=${instanceDataDir}
Restart=always
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
`;
      try {
        await fsp.writeFile(serviceFile, serviceContent, 'utf8');
        await exec('systemctl daemon-reload');
        await exec(`systemctl enable --now clearbaas-${id}`);
      } catch (err: any) {
        this.logger.error(`Failed to register systemd service: ${err.message}`);
      }

      // Configure Nginx reverse proxy if domain is specified
      if (dto.domain) {
        await this.setupNginxProxy(id, dto.domain, port);
      }
    }

    const newInstance: BaasInstance = {
      id,
      name: dto.name.trim(),
      port,
      domain: dto.domain ? dto.domain.trim() : undefined,
      status: 'running',
      dataPath: instanceDataDir,
      apiUrl,
      adminUrl,
      adminEmail: dto.adminEmail,
      createdAt: new Date().toISOString(),
    };

    instances.push(newInstance);
    await this.writeInstances(instances);

    return newInstance;
  }

  private async setupNginxProxy(id: string, domain: string, port: number): Promise<void> {
    const vhostPath = `/etc/nginx/sites-available/clearbaas-${id}.conf`;
    const vhostEnabled = `/etc/nginx/sites-enabled/clearbaas-${id}.conf`;

    const conf = `server {
    listen 80;
    server_name ${domain};

    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:${port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
`;
    try {
      await fsp.writeFile(vhostPath, conf, 'utf8');
      await exec(`ln -sf "${vhostPath}" "${vhostEnabled}"`);
      await exec('nginx -t && systemctl reload nginx');
      this.logger.log(`Configured Nginx reverse proxy for BaaS ${domain} -> 127.0.0.1:${port}`);
    } catch (err: any) {
      this.logger.warn(`Could not set up Nginx proxy: ${err.message}`);
    }
  }

  async startInstance(id: string): Promise<{ success: boolean; message: string }> {
    const inst = await this.getInstance(id);
    if (os.platform() === 'linux') {
      await exec(`systemctl start clearbaas-${inst.id}`);
    }
    return { success: true, message: `BaaS instance "${inst.name}" started` };
  }

  async stopInstance(id: string): Promise<{ success: boolean; message: string }> {
    const inst = await this.getInstance(id);
    if (os.platform() === 'linux') {
      await exec(`systemctl stop clearbaas-${inst.id}`);
    }
    return { success: true, message: `BaaS instance "${inst.name}" stopped` };
  }

  async restartInstance(id: string): Promise<{ success: boolean; message: string }> {
    const inst = await this.getInstance(id);
    if (os.platform() === 'linux') {
      await exec(`systemctl restart clearbaas-${inst.id}`);
    }
    return { success: true, message: `BaaS instance "${inst.name}" restarted` };
  }

  async deleteInstance(id: string): Promise<{ success: boolean; message: string }> {
    const inst = await this.getInstance(id);

    if (os.platform() === 'linux') {
      try {
        await exec(`systemctl stop clearbaas-${inst.id} 2>/dev/null || true`);
        await exec(`systemctl disable clearbaas-${inst.id} 2>/dev/null || true`);
        await fsp.unlink(`/etc/systemd/system/clearbaas-${inst.id}.service`).catch(() => {});
        await exec('systemctl daemon-reload 2>/dev/null || true');

        // Cleanup Nginx
        await fsp.unlink(`/etc/nginx/sites-enabled/clearbaas-${inst.id}.conf`).catch(() => {});
        await fsp.unlink(`/etc/nginx/sites-available/clearbaas-${inst.id}.conf`).catch(() => {});
        await exec('systemctl reload nginx 2>/dev/null || true');
      } catch {
        // ignore
      }
    }

    // Remove data directory
    try {
      const parentDir = path.dirname(inst.dataPath);
      await fsp.rm(parentDir, { recursive: true, force: true });
    } catch {
      // ignore
    }

    const instances = await this.readInstances();
    const filtered = instances.filter((i) => i.id !== id);
    await this.writeInstances(filtered);

    return { success: true, message: `BaaS instance "${inst.name}" deleted` };
  }

  async getLogs(id: string, lines = 50): Promise<string> {
    const inst = await this.getInstance(id);
    if (os.platform() === 'linux') {
      try {
        const { stdout } = await exec(`journalctl -u clearbaas-${inst.id} -n ${lines} --no-pager 2>&1`);
        return stdout;
      } catch (err: any) {
        return `Error fetching logs: ${err.message}`;
      }
    }
    return `Logs are available when running on Linux host. Instance port: ${inst.port}.`;
  }

  getSdkSnippets(id: string, instance: BaasInstance): BaasSdkSnippet[] {
    const endpoint = instance.domain ? `https://${instance.domain}` : `http://<SERVER_IP>:${instance.port}`;

    const jsSnippet = `// 1. Install PocketBase SDK: npm install pocketbase
import PocketBase from 'pocketbase';

const pb = new PocketBase('${endpoint}');

// 2. User Authentication (Login)
async function loginUser(email, password) {
  const authData = await pb.collection('users').authWithPassword(email, password);
  console.log('Logged in user ID:', pb.authStore.model.id);
  console.log('Valid token:', pb.authStore.isValid);
  return authData;
}

// 3. Real-Time Sync (Listen to changes on any collection)
pb.collection('messages').subscribe('*', function (e) {
  console.log('Realtime event:', e.action, e.record);
});

// 4. Create / Insert a record
async function createPost(title, content) {
  return await pb.collection('posts').create({
    title,
    content,
    user: pb.authStore.model?.id,
  });
}
`;

    const flutterSnippet = `// 1. Add to pubspec.yaml: pocketbase: ^0.19.0
import 'package:pocketbase/pocketbase.dart';

final pb = PocketBase('${endpoint}');

// 2. User Login
Future<void> signIn(String email, String password) async {
  final authData = await pb.collection('users').authWithPassword(email, password);
  print('User token: \${pb.authStore.token}');
  print('User ID: \${pb.authStore.model.id}');
}

// 3. Real-Time Live Stream
void subscribeToMessages() {
  pb.collection('messages').subscribe('*', (e) {
    print('Action: \${e.action}, Record: \${e.record}');
  });
}

// 4. Create Record
Future<RecordModel> addPost(String title) async {
  return await pb.collection('posts').create(body: {
    'title': title,
  });
}
`;

    const pythonSnippet = `# 1. Install SDK: pip install pocketbase
from pocketbase import PocketBase

pb = PocketBase("${endpoint}")

# 2. Authenticate
auth_data = pb.collection("users").auth_with_password("user@example.com", "password123")
print("Logged in as:", pb.auth_store.model.id)

# 3. Query records with filter
records = pb.collection("posts").get_list(1, 20, {"filter": 'status = "active"'})
for post in records.items:
    print(post.title)

# 4. Create a new record
new_post = pb.collection("posts").create({
    "title": "Automated post from Python",
    "status": "active"
})
`;

    const curlSnippet = `# 1. Health check
curl -f "${endpoint}/api/health"

# 2. Login as a user to get auth token
curl -X POST "${endpoint}/api/collections/users/auth-with-password" \\
  -H "Content-Type: application/json" \\
  -d '{"identity":"user@example.com","password":"password123"}'

# 3. Query records from collection 'posts'
curl "${endpoint}/api/collections/posts/records?page=1&perPage=10" \\
  -H "Authorization: Bearer <TOKEN>"

# 4. Create a record
curl -X POST "${endpoint}/api/collections/posts/records" \\
  -H "Authorization: Bearer <TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Hello from cURL"}'
`;

    return [
      { language: 'javascript', label: 'JavaScript / React / Next.js', code: jsSnippet },
      { language: 'flutter', label: 'Flutter / Dart (Mobile & Web)', code: flutterSnippet },
      { language: 'python', label: 'Python', code: pythonSnippet },
      { language: 'curl', label: 'cURL / REST API', code: curlSnippet },
    ];
  }
}
