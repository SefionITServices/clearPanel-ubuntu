import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { getDataFilePath } from '../common/paths';
import { injectNginxBlock, reloadNginx } from '../common/nginx-inject';
import { CreateRedirectDto } from './dto/redirect.dto';

export interface Redirect {
  id: string;
  domain: string;
  from: string;
  to: string;
  type: '301' | '302';
  wildcard: boolean;
  createdAt: string;
}

@Injectable()
export class RedirectsService {
  private readonly logger = new Logger(RedirectsService.name);

  private get dataPath(): string {
    return getDataFilePath('redirects.json');
  }

  private async readAll(): Promise<Redirect[]> {
    try {
      const raw = await fs.readFile(this.dataPath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  private async writeAll(items: Redirect[]): Promise<void> {
    await fs.mkdir(path.dirname(this.dataPath), { recursive: true });
    await fs.writeFile(this.dataPath, JSON.stringify(items, null, 2));
  }

  async list(domain?: string): Promise<Redirect[]> {
    const all = await this.readAll();
    return domain ? all.filter((r) => r.domain === domain) : all;
  }

  async create(dto: CreateRedirectDto): Promise<{ success: boolean; redirect: Redirect }> {
    const all = await this.readAll();
    const redirect: Redirect = {
      id: randomUUID(),
      domain: dto.domain,
      from: dto.from.startsWith('/') ? dto.from : `/${dto.from}`,
      to: dto.to,
      type: dto.type,
      wildcard: dto.wildcard ?? false,
      createdAt: new Date().toISOString(),
    };
    all.push(redirect);
    await this.writeAll(all);
    await this.syncNginx(dto.domain, all);
    return { success: true, redirect };
  }

  async remove(id: string): Promise<{ success: boolean; message: string }> {
    const all = await this.readAll();
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return { success: false, message: 'Redirect not found' };
    const { domain } = all[idx];
    all.splice(idx, 1);
    await this.writeAll(all);
    await this.syncNginx(domain, all);
    return { success: true, message: 'Redirect removed' };
  }

  private async syncNginx(domain: string, all: Redirect[]): Promise<void> {
    const domainRedirects = all.filter((r) => r.domain === domain);
    const lines: string[] = [];

    for (const r of domainRedirects) {
      const escapedFrom = r.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (r.wildcard) {
        lines.push(`location ^~ ${r.from} {`);
        lines.push(`    return ${r.type} ${r.to}$request_uri;`);
        lines.push(`}`);
      } else {
        lines.push(`location = ${r.from} {`);
        lines.push(`    return ${r.type} ${r.to};`);
        lines.push(`}`);
      }
    }

    try {
      await injectNginxBlock(domain, 'REDIRECTS', lines.join('\n'));
      await reloadNginx();
    } catch (e: any) {
      this.logger.warn(`Failed to sync redirects nginx config for ${domain}: ${e.message}`);
    }
  }
}
