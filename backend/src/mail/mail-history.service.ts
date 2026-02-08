import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';

export type MailAutomationScope = 'stack' | 'domain' | 'mailbox' | 'alias' | 'dkim';

export interface MailAutomationHistoryRecord {
  id: string;
  domainId?: string;
  domain?: string;
  scope: MailAutomationScope;
  target?: string;
  task: string;
  success: boolean;
  message?: string;
  detail?: string;
  executedAt: string;
}

@Injectable()
export class MailHistoryService {
  private readonly logger = new Logger(MailHistoryService.name);
  private readonly historyPath = path.join(process.cwd(), 'mail-automation-history.json');
  private readonly maxRecords = 500;

  async append(records: Omit<MailAutomationHistoryRecord, 'id'>[]): Promise<void> {
    if (!records.length) {
      return;
    }

    const existing = await this.readAll();
    const enriched = records.map((record) => ({ id: randomUUID(), ...record }));
    const combined = [...enriched, ...(existing || [])];
    if (combined && Array.isArray(combined)) {
      combined.sort((a, b) => (a.executedAt < b.executedAt ? 1 : a.executedAt > b.executedAt ? -1 : 0));
    }
    const limited = combined.slice(0, this.maxRecords);

    await this.writeAll(limited);
  }

  async list(options?: { domainId?: string; limit?: number }): Promise<MailAutomationHistoryRecord[]> {
    const history = await this.readAll();
    let filtered = history;
    if (options?.domainId) {
      filtered = filtered.filter((entry) => entry.domainId === options.domainId);
    }
    if (typeof options?.limit === 'number' && options.limit > 0) {
      filtered = filtered.slice(0, options.limit);
    }
    return filtered;
  }

  private async readAll(): Promise<MailAutomationHistoryRecord[]> {
    try {
      const payload = await fs.readFile(this.historyPath, 'utf-8');
      return JSON.parse(payload) as MailAutomationHistoryRecord[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        await this.writeAll([]);
        return [];
      }
      this.logger.error('Failed to read mail automation history', error as Error);
      throw error;
    }
  }

  private async writeAll(records: MailAutomationHistoryRecord[]): Promise<void> {
    await fs.writeFile(this.historyPath, JSON.stringify(records, null, 2), 'utf-8');
  }
}
