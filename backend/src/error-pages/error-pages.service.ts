import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { getDataFilePath } from '../common/paths';
import { injectNginxBlock, reloadNginx } from '../common/nginx-inject';
import { SaveErrorPageDto } from './dto/error-page.dto';

export interface ErrorPage {
  id: string;
  domain: string;
  code: string;
  html: string;
  enabled: boolean;
  updatedAt: string;
}

@Injectable()
export class ErrorPagesService {
  private readonly logger = new Logger(ErrorPagesService.name);

  private get dataPath(): string {
    return getDataFilePath('error-pages.json');
  }

  private async readAll(): Promise<ErrorPage[]> {
    try {
      const raw = await fs.readFile(this.dataPath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  private async writeAll(items: ErrorPage[]): Promise<void> {
    await fs.mkdir(path.dirname(this.dataPath), { recursive: true });
    await fs.writeFile(this.dataPath, JSON.stringify(items, null, 2));
  }

  private getDomainHtmlPath(domain: string, code: string): string {
    // We assume the user creates domains inside /home/username/Domains/domain
    // Since we don't easily know the username here without querying domains.json,
    // we'll write the error pages to a central location: /etc/clearpanel/error-pages
    // OR we put them in the panel's data dir and configure nginx to read from there.
    return path.join(getDataFilePath('error-pages-html'), domain, `${code}.html`);
  }

  async list(domain: string): Promise<ErrorPage[]> {
    const all = await this.readAll();
    return all.filter((r) => r.domain === domain);
  }

  async save(dto: SaveErrorPageDto): Promise<{ success: boolean; page?: ErrorPage; error?: string }> {
    try {
      const all = await this.readAll();
      const existingIdx = all.findIndex((r) => r.domain === dto.domain && r.code === dto.code);

      const htmlPath = this.getDomainHtmlPath(dto.domain, dto.code);
      await fs.mkdir(path.dirname(htmlPath), { recursive: true });
      await fs.writeFile(htmlPath, dto.html, 'utf-8');
      // Set permissions so nginx can read
      await fs.chmod(htmlPath, 0o644).catch(() => {});

      let page: ErrorPage;
      if (existingIdx >= 0) {
        page = all[existingIdx];
        page.html = dto.html;
        page.enabled = dto.enabled ?? true;
        page.updatedAt = new Date().toISOString();
      } else {
        page = {
          id: randomUUID(),
          domain: dto.domain,
          code: dto.code,
          html: dto.html,
          enabled: dto.enabled ?? true,
          updatedAt: new Date().toISOString(),
        };
        all.push(page);
      }

      await this.writeAll(all);
      await this.syncNginx(dto.domain, all);
      return { success: true, page };
    } catch (error: any) {
      this.logger.error(`Failed to save error page: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async remove(id: string): Promise<{ success: boolean; message: string }> {
    const all = await this.readAll();
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return { success: false, message: 'Error page not found' };

    const { domain, code } = all[idx];
    all.splice(idx, 1);

    const htmlPath = this.getDomainHtmlPath(domain, code);
    await fs.rm(htmlPath, { force: true }).catch(() => {});

    await this.writeAll(all);
    await this.syncNginx(domain, all);
    return { success: true, message: 'Error page removed' };
  }

  private async syncNginx(domain: string, all: ErrorPage[]): Promise<void> {
    const domainPages = all.filter((r) => r.domain === domain && r.enabled);
    const lines: string[] = [];

    if (domainPages.length > 0) {
      // Define a location for the error pages directory so nginx can serve them
      const htmlDir = path.dirname(this.getDomainHtmlPath(domain, '404'));
      lines.push(`location ^~ /.clearpanel-errors/ {`);
      lines.push(`    alias ${htmlDir}/;`);
      lines.push(`    internal;`);
      lines.push(`}`);

      for (const p of domainPages) {
        lines.push(`error_page ${p.code} /.clearpanel-errors/${p.code}.html;`);
      }
    }

    try {
      await injectNginxBlock(domain, 'ERROR_PAGES', lines.join('\n'));
      await reloadNginx();
    } catch (e: any) {
      this.logger.warn(`Failed to sync error pages nginx config for ${domain}: ${e.message}`);
    }
  }
}
