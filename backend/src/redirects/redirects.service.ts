import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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
    return domain ? all.filter((r) => r.domain.toLowerCase() === domain.toLowerCase()) : all;
  }

  async create(dto: CreateRedirectDto): Promise<{ success: boolean; redirect: Redirect }> {
    const all = await this.readAll();
    const rawFrom = dto.from?.trim() || '/';
    const fromPath = rawFrom.startsWith('/') ? rawFrom : `/${rawFrom}`;
    const targetUrl = dto.to.trim();
    const normalizedDomain = dto.domain.trim().toLowerCase();

    // Check for existing redirect on the same domain and source path
    const existingIdx = all.findIndex(
      (r) => r.domain.toLowerCase() === normalizedDomain && r.from === fromPath,
    );

    const redirect: Redirect = {
      id: existingIdx >= 0 ? all[existingIdx].id : randomUUID(),
      domain: normalizedDomain,
      from: fromPath,
      to: targetUrl,
      type: dto.type,
      wildcard: dto.wildcard ?? false,
      createdAt: new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      all[existingIdx] = redirect;
    } else {
      all.push(redirect);
    }

    await this.writeAll(all);
    await this.syncNginx(normalizedDomain, all);
    return { success: true, redirect };
  }

  async remove(id: string): Promise<{ success: boolean; message: string }> {
    const all = await this.readAll();
    const cleanId = id.trim().toLowerCase();
    const idx = all.findIndex(
      (r) => r.id === id || r.id.toLowerCase().startsWith(cleanId) || r.domain.toLowerCase() === cleanId,
    );
    if (idx === -1) {
      throw new NotFoundException(`Redirect "${id}" not found`);
    }
    const { domain } = all[idx];
    all.splice(idx, 1);
    await this.writeAll(all);
    await this.syncNginx(domain, all);
    return { success: true, message: `Redirect for ${domain} removed` };
  }

  async syncNginx(domain: string, all?: Redirect[]): Promise<void> {
    const items = all || (await this.readAll());
    const domainRedirects = items.filter((r) => r.domain.toLowerCase() === domain.toLowerCase());
    const lines: string[] = [];

    for (const r of domainRedirects) {
      const target = r.to.trim();
      const targetNoTrailingSlash = target.replace(/\/+$/, '');
      const hasQuery = target.includes('?');

      if (r.wildcard) {
        if (r.from === '/' || r.from === '') {
          // Whole domain wildcard redirect:
          // Use regex location ~ ^/ so it doesn't conflict with existing prefix location /
          const dest = hasQuery ? target : `${targetNoTrailingSlash}$request_uri`;
          lines.push(`location ~ ^/ {`);
          lines.push(`    return ${r.type} ${dest};`);
          lines.push(`}`);
        } else {
          // Subpath wildcard redirect
          const dest = hasQuery ? target : `${targetNoTrailingSlash}$request_uri`;
          lines.push(`location ^~ ${r.from} {`);
          lines.push(`    return ${r.type} ${dest};`);
          lines.push(`}`);
        }
      } else {
        if (r.from === '/' || r.from === '') {
          // Exact root / homepage redirect
          lines.push(`location = / {`);
          lines.push(`    return ${r.type} ${target};`);
          lines.push(`}`);
        } else {
          // Exact path redirect (handle both with and without trailing slash)
          const normalized = r.from.replace(/\/+$/, '');
          lines.push(`location = ${normalized} {`);
          lines.push(`    return ${r.type} ${target};`);
          lines.push(`}`);
          lines.push(`location = ${normalized}/ {`);
          lines.push(`    return ${r.type} ${target};`);
          lines.push(`}`);
        }
      }
    }

    try {
      await injectNginxBlock(domain, 'REDIRECTS', lines.join('\n'));
      await reloadNginx();
    } catch (e: any) {
      this.logger.warn(`Failed to sync redirects nginx config for ${domain}: ${e.message}`);
      throw e;
    }
  }
}
