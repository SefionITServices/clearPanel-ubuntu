import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

export type ProjectType =
  | 'docker-compose'
  | 'docker'
  | 'nextjs'
  | 'nodejs'
  | 'python'
  | 'laravel'
  | 'php'
  | 'static'
  | 'unknown';

export interface EnvVar {
  key: string;
  value: string;
  isExample: boolean;
}

export interface ProjectDetection {
  type: ProjectType;
  label: string;
  confidence: 'high' | 'medium' | 'low';
  portHint?: number;
  startCommand?: string;
  buildCommand?: string;
  envFiles: string[];
  envVars: EnvVar[];
  dockerServices?: string[];
  hasDockerfile: boolean;
  packageName?: string;
}

@Injectable()
export class ProjectDetectorService {

  async detect(folderPath: string): Promise<ProjectDetection> {
    // Scan the folder and its parent (in case folderPath is /home/user/domain/public_html)
    const directoriesToScan = [folderPath];
    const parent = path.dirname(folderPath);
    if (parent && parent !== folderPath) directoriesToScan.push(parent);

    let detectedFolder = folderPath;
    let files: string[] = [];

    for (const dir of directoriesToScan) {
      try {
        const entries = await fs.readdir(dir);
        files = entries.map((e) => e.toLowerCase());
        detectedFolder = dir;
        // If we find meaningful markers in this dir, stop
        if (this.hasMarkers(files)) break;
      } catch {
        // Directory may not exist yet
      }
    }

    const envFiles = await this.findEnvFiles(detectedFolder, files);
    const envVars = await this.parseEnvVars(detectedFolder, envFiles);

    return await this.classify(detectedFolder, files, envFiles, envVars);
  }

  private hasMarkers(files: string[]): boolean {
    return [
      'docker-compose.yml', 'docker-compose.yaml',
      'dockerfile',
      'package.json',
      'next.config.js', 'next.config.ts', 'next.config.mjs',
      'requirements.txt', 'pyproject.toml',
      'artisan',
      'index.php',
    ].some((m) => files.includes(m));
  }

  private async classify(
    dir: string,
    files: string[],
    envFiles: string[],
    envVars: EnvVar[],
  ): Promise<ProjectDetection> {
    const hasFile = (name: string) => files.includes(name.toLowerCase());

    // ── Docker Compose ──────────────────────────────────────────────────────
    if (hasFile('docker-compose.yml') || hasFile('docker-compose.yaml')) {
      const composeFile = hasFile('docker-compose.yml') ? 'docker-compose.yml' : 'docker-compose.yaml';
      const compose = await this.parseCompose(path.join(dir, composeFile));
      return {
        type: 'docker-compose',
        label: 'Docker Compose',
        confidence: 'high',
        portHint: compose.port,
        dockerServices: compose.services,
        hasDockerfile: hasFile('dockerfile'),
        envFiles,
        envVars,
      };
    }

    // ── Standalone Dockerfile ───────────────────────────────────────────────
    if (hasFile('dockerfile')) {
      const port = await this.parseDockerfilePort(path.join(dir, 'Dockerfile'));
      return {
        type: 'docker',
        label: 'Docker',
        confidence: 'high',
        portHint: port,
        hasDockerfile: true,
        envFiles,
        envVars,
      };
    }

    // ── Next.js ─────────────────────────────────────────────────────────────
    if (
      hasFile('next.config.js') ||
      hasFile('next.config.ts') ||
      hasFile('next.config.mjs') ||
      hasFile('next.config.cjs')
    ) {
      const pkg = await this.readPackageJson(path.join(dir, 'package.json'));
      return {
        type: 'nextjs',
        label: 'Next.js',
        confidence: 'high',
        portHint: 3000,
        startCommand: 'npm start',
        buildCommand: 'npm run build',
        hasDockerfile: hasFile('dockerfile'),
        packageName: pkg?.name,
        envFiles,
        envVars,
      };
    }

    // ── Node.js ─────────────────────────────────────────────────────────────
    if (hasFile('package.json')) {
      const pkg = await this.readPackageJson(path.join(dir, 'package.json'));
      const port = this.inferNodePort(envVars, pkg);
      const startCmd = pkg?.scripts?.start || pkg?.scripts?.serve || 'node index.js';
      const buildCmd = pkg?.scripts?.build;
      return {
        type: 'nodejs',
        label: 'Node.js',
        confidence: 'high',
        portHint: port,
        startCommand: startCmd,
        buildCommand: buildCmd,
        hasDockerfile: hasFile('dockerfile'),
        packageName: pkg?.name,
        envFiles,
        envVars,
      };
    }

    // ── Python ──────────────────────────────────────────────────────────────
    if (hasFile('requirements.txt') || hasFile('pyproject.toml') || hasFile('app.py') || hasFile('main.py')) {
      const port = this.inferPortFromEnv(envVars) || 8000;
      let startCommand = 'python app.py';
      if (hasFile('main.py')) startCommand = 'python main.py';
      if (hasFile('gunicorn.conf.py') || hasFile('wsgi.py')) startCommand = 'gunicorn wsgi:app';
      if (hasFile('uvicorn') || files.some((f) => f.includes('fastapi'))) startCommand = 'uvicorn main:app';
      return {
        type: 'python',
        label: 'Python',
        confidence: 'medium',
        portHint: port,
        startCommand,
        hasDockerfile: hasFile('dockerfile'),
        envFiles,
        envVars,
      };
    }

    // ── Laravel ─────────────────────────────────────────────────────────────
    if (hasFile('artisan')) {
      return {
        type: 'laravel',
        label: 'Laravel (PHP)',
        confidence: 'high',
        hasDockerfile: hasFile('dockerfile'),
        startCommand: 'php artisan serve',
        envFiles,
        envVars,
      };
    }

    // ── PHP (generic) ───────────────────────────────────────────────────────
    if (hasFile('index.php') || files.some((f) => f.endsWith('.php'))) {
      return {
        type: 'php',
        label: 'PHP',
        confidence: 'medium',
        hasDockerfile: hasFile('dockerfile'),
        envFiles,
        envVars,
      };
    }

    // ── Static ──────────────────────────────────────────────────────────────
    if (hasFile('index.html') || hasFile('index.htm')) {
      return {
        type: 'static',
        label: 'Static Site',
        confidence: 'medium',
        hasDockerfile: hasFile('dockerfile'),
        envFiles,
        envVars,
      };
    }

    return {
      type: 'unknown',
      label: 'Unknown',
      confidence: 'low',
      hasDockerfile: hasFile('dockerfile'),
      envFiles,
      envVars,
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async findEnvFiles(dir: string, files: string[]): Promise<string[]> {
    return files
      .filter((f) => f === '.env' || f.startsWith('.env.') || f === 'env.example' || f === '.env.example')
      .map((f) => path.join(dir, f));
  }

  private async parseEnvVars(dir: string, envFiles: string[]): Promise<EnvVar[]> {
    const vars: EnvVar[] = [];
    for (const filePath of envFiles) {
      const isExample = filePath.includes('example');
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx < 1) continue;
          const key = trimmed.slice(0, eqIdx).trim();
          const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
          if (!vars.find((v) => v.key === key)) {
            vars.push({ key, value, isExample });
          }
        }
      } catch { /* file unreadable */ }
    }
    return vars;
  }

  private async readPackageJson(p: string): Promise<any> {
    try {
      const data = await fs.readFile(p, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  private async parseCompose(p: string): Promise<{ port?: number; services: string[] }> {
    try {
      const content = await fs.readFile(p, 'utf-8');
      const services: string[] = [];
      let port: number | undefined;

      // Naive YAML parse - extract service names and first host port mapping
      const serviceSection = content.match(/^services:\s*\n([\s\S]*?)(?=^\w|\z)/m)?.[1] ?? '';
      const serviceNames = [...serviceSection.matchAll(/^\s{2}(\w[\w-]*)\s*:/gm)].map((m) => m[1]);
      services.push(...serviceNames);

      const portMatch = content.match(/["']?(\d+):(\d+)["']?/);
      if (portMatch) port = parseInt(portMatch[1], 10);

      return { port, services };
    } catch {
      return { services: [] };
    }
  }

  private async parseDockerfilePort(p: string): Promise<number | undefined> {
    try {
      const content = await fs.readFile(p, 'utf-8');
      const match = content.match(/^EXPOSE\s+(\d+)/im);
      return match ? parseInt(match[1], 10) : undefined;
    } catch {
      return undefined;
    }
  }

  private inferNodePort(envVars: EnvVar[], pkg: any): number {
    const portFromEnv = this.inferPortFromEnv(envVars);
    if (portFromEnv) return portFromEnv;
    // Check package.json scripts for --port flag
    const scripts = Object.values(pkg?.scripts ?? {}).join(' ');
    const portMatch = scripts.match(/--port[= ](\d+)/i) || scripts.match(/-p (\d+)/);
    if (portMatch) return parseInt(portMatch[1], 10);
    return 3000;
  }

  private inferPortFromEnv(envVars: EnvVar[]): number | undefined {
    const portVar = envVars.find((v) => ['PORT', 'APP_PORT', 'SERVER_PORT'].includes(v.key.toUpperCase()));
    if (portVar) {
      const p = parseInt(portVar.value, 10);
      if (!isNaN(p)) return p;
    }
    return undefined;
  }
}
