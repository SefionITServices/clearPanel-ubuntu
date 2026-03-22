import { Controller, Get, Post, Body, Query, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { ProjectDetectorService } from './project-detector.service';
import { getDataFilePath } from '../common/paths';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

@Controller('api/project-detector')
export class ProjectDetectorController {
  constructor(private readonly detector: ProjectDetectorService) {}

  /**
   * GET /api/project-detector/scan?path=/home/user/example.com/public_html
   * Scan a folder and return project type + metadata.
   */
  @Get('scan')
  async scan(@Query('path') folderPath: string, @Req() req: Request, @Res() res: Response) {
    if (!folderPath) {
      return res.status(400).json({ success: false, error: 'path query param required' });
    }
    try {
      const result = await this.detector.detect(folderPath);
      return res.json({ success: true, ...result });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  /**
   * GET /api/project-detector/scan-domain?domain=example.com
   * Look up a domain's folderPath from domains.json then scan it.
   */
  @Get('scan-domain')
  async scanDomain(@Query('domain') domain: string, @Req() req: Request, @Res() res: Response) {
    if (!domain) {
      return res.status(400).json({ success: false, error: 'domain query param required' });
    }
    try {
      const folderPath = await this.resolveDomainPath(domain);
      if (!folderPath) {
        return res.status(404).json({ success: false, error: `Domain ${domain} not found` });
      }
      const result = await this.detector.detect(folderPath);
      return res.json({ success: true, folderPath, ...result });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  /**
   * POST /api/project-detector/run-command
   * { folderPath, command } — runs a safe, short-lived command inside the project folder.
   * Only allowed commands: npm install, npm run build, npm run start, pip install, composer install.
   */
  @Post('run-command')
  async runCommand(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    const { folderPath, command } = body ?? {};
    if (!folderPath || !command) {
      return res.status(400).json({ success: false, error: 'folderPath and command required' });
    }
    // Allowlist: only permit specific safe commands
    const allowed = [
      /^npm (install|ci|run build|run start|run dev)$/,
      /^pnpm (install|run build|run start|run dev)$/,
      /^yarn (install|build|start|dev)$/,
      /^pip install -r requirements\.txt$/,
      /^composer install$/,
    ];
    if (!allowed.some((re) => re.test(command.trim()))) {
      return res.status(403).json({ success: false, error: `Command not allowed: ${command}` });
    }
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: folderPath,
        timeout: 120_000,
        maxBuffer: 2 * 1024 * 1024,
      });
      return res.json({ success: true, output: stdout + stderr });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message, output: e.stdout + e.stderr });
    }
  }

  private async resolveDomainPath(domain: string): Promise<string | null> {
    try {
      const data = await fs.readFile(getDataFilePath('domains.json'), 'utf-8');
      const domains: Array<{ name: string; folderPath: string }> = JSON.parse(data);
      const d = domains.find((entry) => entry.name.toLowerCase() === domain.toLowerCase());
      return d?.folderPath ?? null;
    } catch {
      return null;
    }
  }
}
