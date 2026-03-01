import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getDataFilePath } from '../common/paths';
import { injectNginxBlock, reloadNginx } from '../common/nginx-inject';
import { SetHotlinkDto } from './dto/hotlink.dto';

const DEFAULT_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'ico', 'svg', 'mp4', 'mp3', 'pdf', 'zip'];

export interface HotlinkConfig {
  domain: string;
  enabled: boolean;
  allowedDomains: string[];
  blockExtensions: string[];
  updatedAt: string;
}

@Injectable()
export class HotlinkService {
  private readonly logger = new Logger(HotlinkService.name);

  private get dataPath(): string {
    return getDataFilePath('hotlink.json');
  }

  private async readAll(): Promise<Record<string, HotlinkConfig>> {
    try {
      const raw = await fs.readFile(this.dataPath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  private async writeAll(data: Record<string, HotlinkConfig>): Promise<void> {
    await fs.mkdir(path.dirname(this.dataPath), { recursive: true });
    await fs.writeFile(this.dataPath, JSON.stringify(data, null, 2));
  }

  async get(domain: string): Promise<HotlinkConfig> {
    const all = await this.readAll();
    return (
      all[domain] ?? {
        domain,
        enabled: false,
        allowedDomains: [],
        blockExtensions: DEFAULT_EXTENSIONS,
        updatedAt: new Date().toISOString(),
      }
    );
  }

  async set(dto: SetHotlinkDto): Promise<{ success: boolean; config: HotlinkConfig }> {
    const all = await this.readAll();
    const config: HotlinkConfig = {
      domain: dto.domain,
      enabled: dto.enabled,
      allowedDomains: dto.allowedDomains ?? [],
      blockExtensions: dto.blockExtensions ?? DEFAULT_EXTENSIONS,
      updatedAt: new Date().toISOString(),
    };
    all[dto.domain] = config;
    await this.writeAll(all);
    await this.syncNginx(config);
    return { success: true, config };
  }

  async disable(domain: string): Promise<{ success: boolean }> {
    return this.set({ domain, enabled: false });
  }

  private async syncNginx(config: HotlinkConfig): Promise<void> {
    let content = '';

    if (config.enabled) {
      const exts = config.blockExtensions.join('|');
      const extras = config.allowedDomains.map((d) => `*.${d}`).join(' ');
      const allowed = ['none', 'blocked', 'server_names', ...(extras ? [extras] : [])].join(' ');

      content = [
        `location ~* \\.(${exts})$ {`,
        `    valid_referers ${allowed};`,
        `    if ($invalid_referer) {`,
        `        return 403;`,
        `    }`,
        `}`,
      ].join('\n');
    }

    try {
      await injectNginxBlock(config.domain, 'HOTLINK', content);
      await reloadNginx();
    } catch (e: any) {
      this.logger.warn(`Failed to sync hotlink nginx config for ${config.domain}: ${e.message}`);
    }
  }
}
