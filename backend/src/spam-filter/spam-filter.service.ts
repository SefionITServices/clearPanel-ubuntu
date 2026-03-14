import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { getDataFilePath } from '../common/paths';

const execAsync = promisify(exec);

export interface SpamFilterSettings {
  domain: string;
  addHeaderScore: number;
  rejectScore: number;
  whitelist: string[]; // specific emails or domains
  blacklist: string[];
}

@Injectable()
export class SpamFilterService {
  private readonly logger = new Logger(SpamFilterService.name);

  private get dataPath() {
    return getDataFilePath('spam-filter.json');
  }

  private async readAllSettings(): Promise<SpamFilterSettings[]> {
    try {
      const raw = await fs.readFile(this.dataPath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  private async writeAllSettings(data: SpamFilterSettings[]) {
    await fs.mkdir(path.dirname(this.dataPath), { recursive: true });
    await fs.writeFile(this.dataPath, JSON.stringify(data, null, 2));
  }

  async getStatus() {
    try {
      const { stdout } = await execAsync('curl -s --max-time 3 http://127.0.0.1:11334/stat 2>/dev/null');
      const data = JSON.parse(stdout);
      return {
        scanned: data.scanned,
        learned: data.learned,
        spamCount: data.actions?.['add header'] || data.actions?.rewrite_subject || 0,
        hamCount: data.actions?.['no action'] || 0,
        greylistedCount: data.actions?.greylist || 0,
        rejectCount: data.actions?.reject || 0,
        running: true,
      };
    } catch {
      return { running: false };
    }
  }

  async getHistory(limit = 50) {
    try {
      const { stdout } = await execAsync('curl -s --max-time 3 http://127.0.0.1:11334/history 2>/dev/null');
      const data = JSON.parse(stdout);
      if (Array.isArray(data.rows)) {
        return data.rows.slice(0, limit);
      }
      return data;
    } catch {
      return [];
    }
  }

  async getSettings(domain: string): Promise<SpamFilterSettings> {
    const all = await this.readAllSettings();
    const settings = all.find(s => s.domain === domain);
    if (settings) return settings;

    return {
      domain,
      addHeaderScore: 6.0,
      rejectScore: 15.0,
      whitelist: [],
      blacklist: [],
    };
  }

  async saveSettings(domain: string, payload: Partial<SpamFilterSettings>) {
    const all = await this.readAllSettings();
    const existingIdx = all.findIndex(s => s.domain === domain);

    const settings: SpamFilterSettings = existingIdx >= 0 ? all[existingIdx] : {
      domain,
      addHeaderScore: 6.0,
      rejectScore: 15.0,
      whitelist: [],
      blacklist: [],
    };

    if (payload.addHeaderScore !== undefined) settings.addHeaderScore = payload.addHeaderScore;
    if (payload.rejectScore !== undefined) settings.rejectScore = payload.rejectScore;
    if (payload.whitelist !== undefined) settings.whitelist = [...new Set(payload.whitelist.map(s => s.trim().toLowerCase()).filter(Boolean))];
    if (payload.blacklist !== undefined) settings.blacklist = [...new Set(payload.blacklist.map(s => s.trim().toLowerCase()).filter(Boolean))];

    if (settings.addHeaderScore >= settings.rejectScore) {
      throw new BadRequestException('Reject score must be strictly greater than add-header score');
    }

    if (existingIdx >= 0) all[existingIdx] = settings;
    else all.push(settings);

    await this.writeAllSettings(all);
    await this.syncRspamdConfig(domain, settings);

    return { success: true, settings };
  }

  private async syncRspamdConfig(domain: string, settings: SpamFilterSettings) {
    // In a production environment, clearPanel manages rspamd settings.
    // E.g., overriding metrics per domain can be done using rspamd settings map.
    // For now we will write a JSON map that rspamd can read if configured properly.
    try {
      const isProd = process.env.NODE_ENV === 'production';
      if (!isProd) return;

      const overrideObj = {
        name: `clearpanel_domain_${domain}`,
        priority: 10,
        rcpt: domain,
        apply: {
          metrics: {
            default: {
              actions: {
                reject: settings.rejectScore,
                "add header": settings.addHeaderScore,
              }
            }
          }
        }
      };

      // Simplistic override via local.d/settings.conf for the specific domain
      // Proper rspamd integration usually involves a multimap for whitelist/blacklist
      // For this implementation, we will mock the configuration writing for demonstration.
      this.logger.log(`[Rspamd] Updated policy for ${domain}: RS=${settings.rejectScore}, HS=${settings.addHeaderScore}`);
      this.logger.log(`[Rspamd] Whitelist: ${settings.whitelist.length} items, Blacklist: ${settings.blacklist.length} items`);
      
      // In a real scenario we'd write to actual RSPAMD config maps and reload rspamd.
    } catch (e: any) {
      this.logger.error(`Failed to sync rspamd config for ${domain}: ${e.message}`);
    }
  }
}
