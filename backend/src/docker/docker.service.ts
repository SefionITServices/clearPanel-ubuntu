import { Injectable, Logger } from '@nestjs/common';
import { exec as execCb } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getDataFilePath } from '../common/paths';
import { PullImageDto, RunContainerDto, CreateComposeDto } from './dto/docker.dto';

const exec = promisify(execCb);

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: string;
  state: string;   // running | exited | paused | restarting
  ports: string;
  created: string;
  size?: string;
}

export interface DockerImage {
  id: string;
  repository: string;
  tag: string;
  size: string;
  created: string;
}

export interface ComposeStack {
  name: string;
  projectPath: string;
  status: string;
  services: number;
  createdAt: string;
}

@Injectable()
export class DockerService {
  private readonly logger = new Logger(DockerService.name);

  // ── Docker daemon status ───────────────────────────────────────────────────

  async getStatus(): Promise<{ installed: boolean; running: boolean; version?: string; compose?: boolean }> {
    try {
      const { stdout: ver } = await exec('docker --version 2>/dev/null');
      const installed = ver.includes('Docker');
      let running = false;
      let composeAvail = false;
      if (installed) {
        try {
          await exec('docker info 2>/dev/null');
          running = true;
        } catch { /* daemon not running */ }
        try {
          await exec('docker compose version 2>/dev/null');
          composeAvail = true;
        } catch { /* no compose */ }
      }
      return { installed, running, version: ver.trim(), compose: composeAvail };
    } catch {
      return { installed: false, running: false };
    }
  }

  async install(): Promise<{ success: boolean; output: string }> {
    try {
      const { stdout, stderr } = await exec(
        'curl -fsSL https://get.docker.com | sudo sh && sudo systemctl enable --now docker && sudo usermod -aG docker $USER',
        { timeout: 300000 },
      );
      return { success: true, output: stdout + stderr };
    } catch (e: any) {
      throw new Error(`Docker install failed: ${e.message}`);
    }
  }

  // ── Containers ─────────────────────────────────────────────────────────────

  async listContainers(all = true): Promise<DockerContainer[]> {
    const flag = all ? '-a' : '';
    const fmt = '{{.ID}}\\t{{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.State}}\\t{{.Ports}}\\t{{.CreatedAt}}';
    try {
      const { stdout } = await exec(`docker ps ${flag} --format "${fmt}"`);
      return stdout.trim().split('\n').filter(Boolean).map((line) => {
        const [id, name, image, status, state, ports, created] = line.split('\t');
        return { id, name: name.replace(/^\//, ''), image, status, state, ports, created };
      });
    } catch {
      return [];
    }
  }

  async containerAction(id: string, action: 'start' | 'stop' | 'restart' | 'pause' | 'unpause'): Promise<{ success: boolean; output: string }> {
    const { stdout, stderr } = await exec(`docker ${action} ${id}`);
    return { success: true, output: stdout + stderr };
  }

  async removeContainer(id: string, force = false): Promise<{ success: boolean }> {
    await exec(`docker rm ${force ? '-f' : ''} ${id}`);
    return { success: true };
  }

  async getContainerLogs(id: string, tail = 200): Promise<string> {
    try {
      const { stdout, stderr } = await exec(`docker logs --tail ${tail} --timestamps ${id} 2>&1`);
      return stdout + stderr;
    } catch (e: any) {
      return e.message;
    }
  }

  async inspectContainer(id: string): Promise<any> {
    const { stdout } = await exec(`docker inspect ${id}`);
    const arr = JSON.parse(stdout);
    return arr[0] ?? {};
  }

  async runContainer(dto: RunContainerDto): Promise<{ success: boolean; id: string }> {
    const parts = ['docker run -d'];
    parts.push(`--name ${dto.name}`);
    if (dto.restartPolicy) parts.push(`--restart ${dto.restartPolicy}`);
    for (const p of dto.ports ?? []) parts.push(`-p ${p}`);
    for (const e of dto.env ?? []) parts.push(`-e "${e}"`);
    for (const v of dto.volumes ?? []) parts.push(`-v ${v}`);
    if (dto.network) parts.push(`--network ${dto.network}`);
    parts.push(dto.image);
    const cmd = parts.join(' ');
    const { stdout } = await exec(cmd);
    return { success: true, id: stdout.trim() };
  }

  // ── Images ─────────────────────────────────────────────────────────────────

  async listImages(): Promise<DockerImage[]> {
    const fmt = '{{.ID}}\\t{{.Repository}}\\t{{.Tag}}\\t{{.Size}}\\t{{.CreatedAt}}';
    try {
      const { stdout } = await exec(`docker images --format "${fmt}"`);
      return stdout.trim().split('\n').filter(Boolean).map((line) => {
        const [id, repository, tag, size, created] = line.split('\t');
        return { id, repository, tag, size, created };
      });
    } catch {
      return [];
    }
  }

  async pullImage(dto: PullImageDto): Promise<{ success: boolean; output: string }> {
    const { stdout, stderr } = await exec(`docker pull ${dto.image}`, { timeout: 300000 });
    return { success: true, output: stdout + stderr };
  }

  async removeImage(id: string, force = false): Promise<{ success: boolean }> {
    await exec(`docker rmi ${force ? '-f' : ''} ${id}`);
    return { success: true };
  }

  // ── Docker Compose stacks ──────────────────────────────────────────────────

  private get stacksFile(): string {
    return getDataFilePath('docker-stacks.json');
  }

  private async readStacks(): Promise<ComposeStack[]> {
    try {
      const raw = await fs.readFile(this.stacksFile, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  private async writeStacks(stacks: ComposeStack[]): Promise<void> {
    await fs.mkdir(path.dirname(this.stacksFile), { recursive: true });
    await fs.writeFile(this.stacksFile, JSON.stringify(stacks, null, 2));
  }

  async listStacks(): Promise<ComposeStack[]> {
    const stacks = await this.readStacks();
    // Refresh status from docker compose ps
    const updated = await Promise.all(
      stacks.map(async (s) => {
        try {
          const { stdout } = await exec(`docker compose -p ${s.name} ps --format json 2>/dev/null`);
          const services = stdout.trim().split('\n').filter(Boolean).length;
          const hasRunning = stdout.includes('"Running"') || stdout.includes('"running"');
          return { ...s, status: hasRunning ? 'running' : 'stopped', services };
        } catch {
          return { ...s, status: 'unknown' };
        }
      }),
    );
    return updated;
  }

  async createStack(dto: CreateComposeDto): Promise<{ success: boolean }> {
    await fs.mkdir(dto.projectPath, { recursive: true });
    await fs.writeFile(path.join(dto.projectPath, 'docker-compose.yml'), dto.composeContent);
    const stacks = await this.readStacks();
    stacks.push({ name: dto.name, projectPath: dto.projectPath, status: 'stopped', services: 0, createdAt: new Date().toISOString() });
    await this.writeStacks(stacks);
    return { success: true };
  }

  async deleteStack(name: string): Promise<{ success: boolean }> {
    const stacks = await this.readStacks();
    await this.writeStacks(stacks.filter((s) => s.name !== name));
    return { success: true };
  }

  async composeUp(projectPath: string, detach = true): Promise<{ success: boolean; output: string }> {
    const flag = detach ? '-d' : '';
    const { stdout, stderr } = await exec(`docker compose -f ${path.join(projectPath, 'docker-compose.yml')} up ${flag} --build`, { timeout: 300000 });
    return { success: true, output: stdout + stderr };
  }

  async composeDown(projectPath: string): Promise<{ success: boolean; output: string }> {
    const { stdout, stderr } = await exec(`docker compose -f ${path.join(projectPath, 'docker-compose.yml')} down`);
    return { success: true, output: stdout + stderr };
  }

  async composePs(projectPath: string): Promise<any[]> {
    try {
      const { stdout } = await exec(`docker compose -f ${path.join(projectPath, 'docker-compose.yml')} ps --format json`);
      return stdout.trim().split('\n').filter(Boolean).map((l) => {
        try { return JSON.parse(l); } catch { return { raw: l }; }
      });
    } catch {
      return [];
    }
  }

  async composeLogs(projectPath: string, tail = 100): Promise<string> {
    try {
      const { stdout, stderr } = await exec(
        `docker compose -f ${path.join(projectPath, 'docker-compose.yml')} logs --tail ${tail} 2>&1`,
      );
      return stdout + stderr;
    } catch (e: any) {
      return e.message;
    }
  }

  async getComposeFile(projectPath: string): Promise<string> {
    try {
      return await fs.readFile(path.join(projectPath, 'docker-compose.yml'), 'utf-8');
    } catch {
      return '';
    }
  }

  async saveComposeFile(projectPath: string, content: string): Promise<{ success: boolean }> {
    await fs.writeFile(path.join(projectPath, 'docker-compose.yml'), content);
    return { success: true };
  }

  // ── Networks ───────────────────────────────────────────────────────────────

  async listNetworks(): Promise<any[]> {
    const fmt = '{{.ID}}\\t{{.Name}}\\t{{.Driver}}\\t{{.Scope}}\\t{{.CreatedAt}}';
    try {
      const { stdout } = await exec(`docker network ls --format "${fmt}"`);
      return stdout.trim().split('\n').filter(Boolean).map((line) => {
        const [id, name, driver, scope, created] = line.split('\t');
        return { id, name, driver, scope, created };
      });
    } catch {
      return [];
    }
  }

  // ── Volumes ────────────────────────────────────────────────────────────────

  async listVolumes(): Promise<any[]> {
    const fmt = '{{.Name}}\\t{{.Driver}}\\t{{.Mountpoint}}\\t{{.CreatedAt}}';
    try {
      const { stdout } = await exec(`docker volume ls --format "${fmt}"`);
      return stdout.trim().split('\n').filter(Boolean).map((line) => {
        const [name, driver, mountpoint, created] = line.split('\t');
        return { name, driver, mountpoint, created };
      });
    } catch {
      return [];
    }
  }

  async pruneSystem(): Promise<{ success: boolean; output: string }> {
    const { stdout, stderr } = await exec('docker system prune -f');
    return { success: true, output: stdout + stderr };
  }

  async getStats(): Promise<any[]> {
    try {
      const fmt = '{{.ID}}\\t{{.Name}}\\t{{.CPUPerc}}\\t{{.MemUsage}}\\t{{.MemPerc}}\\t{{.NetIO}}\\t{{.BlockIO}}';
      const { stdout } = await exec(`docker stats --no-stream --format "${fmt}"`);
      return stdout.trim().split('\n').filter(Boolean).map((line) => {
        const [id, name, cpu, memUsage, memPerc, netIO, blockIO] = line.split('\t');
        return { id, name, cpu, memUsage, memPerc, netIO, blockIO };
      });
    } catch {
      return [];
    }
  }
}
