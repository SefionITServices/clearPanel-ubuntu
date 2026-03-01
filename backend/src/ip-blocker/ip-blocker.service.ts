import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { getDataFilePath } from '../common/paths';
import { injectNginxBlock, reloadNginx } from '../common/nginx-inject';
import { CreateIpBlockDto } from './dto/ip-blocker.dto';

export interface BlockedIp {
  id: string;
  domain: string;
  ip: string;
  note: string;
  createdAt: string;
}

@Injectable()
export class IpBlockerService {
  private readonly logger = new Logger(IpBlockerService.name);

  private get dataPath(): string {
    return getDataFilePath('ip-blocked.json');
  }

  private async readAll(): Promise<BlockedIp[]> {
    try {
      const raw = await fs.readFile(this.dataPath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  private async writeAll(items: BlockedIp[]): Promise<void> {
    await fs.mkdir(path.dirname(this.dataPath), { recursive: true });
    await fs.writeFile(this.dataPath, JSON.stringify(items, null, 2));
  }

  async list(domain?: string): Promise<BlockedIp[]> {
    const all = await this.readAll();
    return domain ? all.filter((b) => b.domain === domain) : all;
  }

  async create(dto: CreateIpBlockDto): Promise<{ success: boolean; entry: BlockedIp }> {
    const all = await this.readAll();

    // Prevent duplicates for the same domain
    if (all.some((b) => b.domain === dto.domain && b.ip === dto.ip)) {
      throw new Error(`${dto.ip} is already blocked for ${dto.domain}`);
    }

    const entry: BlockedIp = {
      id: randomUUID(),
      domain: dto.domain,
      ip: dto.ip,
      note: dto.note ?? '',
      createdAt: new Date().toISOString(),
    };
    all.push(entry);
    await this.writeAll(all);
    await this.syncNginx(dto.domain, all);
    return { success: true, entry };
  }

  async remove(id: string): Promise<{ success: boolean; message: string }> {
    const all = await this.readAll();
    const idx = all.findIndex((b) => b.id === id);
    if (idx === -1) return { success: false, message: 'Entry not found' };
    const { domain } = all[idx];
    all.splice(idx, 1);
    await this.writeAll(all);
    await this.syncNginx(domain, all);
    return { success: true, message: 'IP block removed' };
  }

  private async syncNginx(domain: string, all: BlockedIp[]): Promise<void> {
    const blocked = all.filter((b) => b.domain === domain);
    const lines = blocked.map((b) => `deny ${b.ip};`);

    try {
      await injectNginxBlock(domain, 'IPBLOCK', lines.join('\n'));
      await reloadNginx();
    } catch (e: any) {
      this.logger.warn(`Failed to sync IP block nginx config for ${domain}: ${e.message}`);
    }
  }
}
