import { Injectable, Logger } from '@nestjs/common';
import { exec as execCb, spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { getDataFilePath } from '../common/paths';
import { CreateAppDto, UpdateAppDto, CloneAppDto } from './dto/node-apps.dto';

const exec = promisify(execCb);

export interface AppDefinition {
  id: string;
  name: string;
  runtime: 'node' | 'python' | 'static';
  directory: string;
  startCommand: string;
  port?: number;
  env: { key: string; value: string }[];
  nodeVersion?: string;
  pythonVersion?: string;
  description?: string;
  domain?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AppStatus extends AppDefinition {
  status: 'online' | 'stopped' | 'errored' | 'unknown';
  pid?: number;
  restarts?: number;
  cpu?: string;
  memory?: string;
  uptime?: string;
}

@Injectable()
export class NodeAppsService {
  private readonly logger = new Logger(NodeAppsService.name);

  // ── Persistence ────────────────────────────────────────────────────────────

  private get appsFile(): string {
    return getDataFilePath('node-apps.json');
  }

  private async readApps(): Promise<AppDefinition[]> {
    try {
      return JSON.parse(await fs.readFile(this.appsFile, 'utf-8'));
    } catch {
      return [];
    }
  }

  private async writeApps(apps: AppDefinition[]): Promise<void> {
    await fs.mkdir(path.dirname(this.appsFile), { recursive: true });
    await fs.writeFile(this.appsFile, JSON.stringify(apps, null, 2));
  }

  // ── PM2 helpers ────────────────────────────────────────────────────────────

  async getPm2Status(): Promise<{ installed: boolean; version?: string }> {
    try {
      const { stdout } = await exec('pm2 --version 2>/dev/null');
      return { installed: true, version: stdout.trim() };
    } catch {
      return { installed: false };
    }
  }

  async installPm2(): Promise<{ success: boolean; output: string }> {
    try {
      const { stdout, stderr } = await exec('npm install -g pm2', { timeout: 120000 });
      return { success: true, output: stdout + stderr };
    } catch (err: any) {
      const msg = err.message?.toLowerCase() || '';
      if (msg.includes('eacces') || msg.includes('eperm') || msg.includes('permission denied')) {
        try {
          const { stdout, stderr } = await exec('sudo -n npm install -g pm2', { timeout: 120000 });
          return { success: true, output: stdout + stderr };
        } catch (sudoErr: any) {
          if (sudoErr.message?.includes('password') || sudoErr.message?.includes('terminal')) {
            throw new Error('Permission denied: The backend must run as root or have passwordless sudo to install PM2 globally.');
          }
          throw new Error(`Failed to install PM2 with sudo: ${sudoErr.message}`);
        }
      }
      throw new Error(`Failed to install PM2: ${err.message}`);
    }
  }

  private async pm2List(): Promise<any[]> {
    try {
      const { stdout } = await exec('pm2 jlist 2>/dev/null');
      return JSON.parse(stdout || '[]');
    } catch {
      return [];
    }
  }

  private pm2StatusFor(pm2List: any[], name: string): Partial<AppStatus> {
    const proc = pm2List.find((p: any) => p.name === name);
    if (!proc) return { status: 'stopped' };
    const st = proc.pm2_env?.status;
    return {
      status: st === 'online' ? 'online' : st === 'errored' ? 'errored' : 'stopped',
      pid: proc.pid,
      restarts: proc.pm2_env?.restart_time,
      cpu: proc.monit?.cpu !== undefined ? `${proc.monit.cpu}%` : undefined,
      memory: proc.monit?.memory !== undefined ? `${Math.round(proc.monit.memory / 1024 / 1024)} MB` : undefined,
      uptime: proc.pm2_env?.pm_uptime ? `${Math.round((Date.now() - proc.pm2_env.pm_uptime) / 1000 / 60)} min` : undefined,
    };
  }

  // ── App CRUD ────────────────────────────────────────────────────────────────

  async listApps(): Promise<AppStatus[]> {
    const apps = await this.readApps();
    const pm2 = await this.pm2List();
    return apps.map((a) => ({ ...a, ...this.pm2StatusFor(pm2, a.name) } as AppStatus));
  }

  async createApp(dto: CreateAppDto): Promise<AppDefinition> {
    const apps = await this.readApps();
    if (apps.find((a) => a.name === dto.name)) {
      throw new Error(`App '${dto.name}' already exists`);
    }
    // Ensure directory exists
    await fs.mkdir(dto.directory, { recursive: true });

    const app: AppDefinition = {
      id: randomUUID(),
      name: dto.name,
      runtime: dto.runtime as any,
      directory: dto.directory,
      startCommand: dto.startCommand,
      port: dto.port,
      env: dto.env ?? [],
      nodeVersion: dto.nodeVersion,
      pythonVersion: dto.pythonVersion,
      description: dto.description,
      domain: dto.domain,
      createdAt: new Date().toISOString(),
    };
    apps.push(app);
    await this.writeApps(apps);
    return app;
  }

  async cloneAndCreate(dto: CloneAppDto): Promise<AppDefinition> {
    await exec(`/usr/bin/git clone ${dto.repoUrl} ${dto.directory}${dto.branch ? ` -b ${dto.branch}` : ''}`, { timeout: 120000 });
    return this.createApp({
      name: dto.name,
      runtime: dto.runtime as any,
      directory: dto.directory,
      startCommand: dto.startCommand,
      port: dto.port,
      env: dto.env,
    });
  }

  async updateApp(id: string, dto: UpdateAppDto): Promise<AppDefinition> {
    const apps = await this.readApps();
    const idx = apps.findIndex((a) => a.id === id);
    if (idx < 0) throw new Error('App not found');
    apps[idx] = { ...apps[idx], ...dto, updatedAt: new Date().toISOString() };
    await this.writeApps(apps);
    return apps[idx];
  }

  async deleteApp(id: string): Promise<{ success: boolean }> {
    const apps = await this.readApps();
    const app = apps.find((a) => a.id === id);
    if (!app) throw new Error('App not found');
    // Stop & delete from PM2 (ignore errors if not running)
    try { await exec(`pm2 delete ${app.name}`); } catch { /* not running */ }
    await this.writeApps(apps.filter((a) => a.id !== id));
    return { success: true };
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  private buildStartCommand(app: AppDefinition): string {
    // Build pm2 start command
    const envString = app.env
      .map((e) => `${e.key}=${e.value}`)
      .join(',');
    const envFlag = envString ? `--env-var-list "${envString}"` : '';
    const portEnv = app.port ? `PORT=${app.port} ` : '';

    if (app.runtime === 'python') {
      const python = app.pythonVersion ? `python${app.pythonVersion}` : 'python3';
      const parts = app.startCommand.split(' ');
      const scriptFile = parts[0];
      const args = parts.slice(1).join(' ');
      return `pm2 start ${scriptFile} --name "${app.name}" --interpreter ${python} ${args ? `-- ${args}` : ''} --cwd "${app.directory}" ${envFlag}`;
    }

    // Node.js / static (serve)
    const cmd = app.startCommand;
    return `pm2 start ${cmd} --name "${app.name}" --cwd "${app.directory}" ${envFlag}`;
  }

  async startApp(id: string): Promise<{ success: boolean; output: string }> {
    const apps = await this.readApps();
    const app = apps.find((a) => a.id === id);
    if (!app) throw new Error('App not found');

    // Install deps if package.json exists (Node) or requirements.txt (Python)
    try {
      if (app.runtime === 'node') {
        await fs.access(path.join(app.directory, 'package.json'));
        await exec(`cd "${app.directory}" && npm install --production`, { timeout: 180000 });
      } else if (app.runtime === 'python') {
        await fs.access(path.join(app.directory, 'requirements.txt'));
        await exec(`cd "${app.directory}" && pip3 install -r requirements.txt`, { timeout: 180000 });
      }
    } catch { /* no package.json / requirements.txt — skip */ }

    const cmd = this.buildStartCommand(app);
    const { stdout, stderr } = await exec(cmd);
    return { success: true, output: stdout + stderr };
  }

  async stopApp(id: string): Promise<{ success: boolean }> {
    const apps = await this.readApps();
    const app = apps.find((a) => a.id === id);
    if (!app) throw new Error('App not found');
    await exec(`pm2 stop "${app.name}"`);
    return { success: true };
  }

  async restartApp(id: string): Promise<{ success: boolean }> {
    const apps = await this.readApps();
    const app = apps.find((a) => a.id === id);
    if (!app) throw new Error('App not found');
    await exec(`pm2 restart "${app.name}"`);
    return { success: true };
  }

  async getAppLogs(id: string, lines = 200): Promise<string> {
    const apps = await this.readApps();
    const app = apps.find((a) => a.id === id);
    if (!app) throw new Error('App not found');
    try {
      const { stdout } = await exec(`pm2 logs "${app.name}" --lines ${lines} --nostream 2>&1`);
      return stdout;
    } catch (e: any) {
      return e.message;
    }
  }

  async pullAndRestart(id: string): Promise<{ success: boolean; output: string }> {
    const apps = await this.readApps();
    const app = apps.find((a) => a.id === id);
    if (!app) throw new Error('App not found');
    const { stdout: pullOut, stderr: pullErr } = await exec(`/usr/bin/git -C "${app.directory}" pull`, { timeout: 60000 });

    // Install deps after pull
    try {
      if (app.runtime === 'node') {
        await exec(`cd "${app.directory}" && npm install --production`, { timeout: 180000 });
      } else if (app.runtime === 'python') {
        await exec(`cd "${app.directory}" && pip3 install -r requirements.txt`, { timeout: 180000 });
      }
    } catch { /* skip */ }

    const { stdout: restartOut } = await exec(`pm2 restart "${app.name}"`);
    return { success: true, output: pullOut + pullErr + restartOut };
  }

  // ── Env vars ───────────────────────────────────────────────────────────────

  async setEnv(id: string, env: { key: string; value: string }[]): Promise<AppDefinition> {
    return this.updateApp(id, { env });
  }

  // ── System info ────────────────────────────────────────────────────────────

  async getRuntimes(): Promise<{ node?: string; python3?: string; pm2?: string }> {
    const results: any = {};
    for (const [label, cmd] of [['node', 'node --version'], ['python3', 'python3 --version'], ['pm2', 'pm2 --version']]) {
      try {
        const { stdout } = await exec(`${cmd} 2>/dev/null`);
        results[label] = stdout.trim();
      } catch {
        results[label] = null;
      }
    }
    return results;
  }
}
