import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { ProjectDetectorService } from './project-detector.service';
import { getDataFilePath } from '../common/paths';
import * as fs from 'fs/promises';

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
