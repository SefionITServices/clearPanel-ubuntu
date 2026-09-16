import { Injectable, Logger } from '@nestjs/common';
import { getDataFilePath } from '../common/paths';
import { promises as fs } from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { Notification } from './notification.model';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  private get filePath(): string {
    return getDataFilePath('notifications.json');
  }

  private async readAll(): Promise<Notification[]> {
    try {
      const txt = await fs.readFile(this.filePath, 'utf8');
      return JSON.parse(txt) as Notification[];
    } catch (e: any) {
      if (e.code === 'ENOENT') {
        await this.writeAll([]);
        return [];
      }
      this.logger.warn(`Failed to read notifications file: ${e.message}`);
      return [];
    }
  }

  private async writeAll(data: Notification[]) {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  async list(filter?: 'all' | 'unread' | 'read') {
    const all = await this.readAll();
    if (!filter || filter === 'all') return all;
    if (filter === 'unread') return all.filter((n) => !n.isRead);
    return all.filter((n) => n.isRead);
  }

  async countUnread() {
    const all = await this.readAll();
    return all.filter((n) => !n.isRead).length;
  }

  async create(payload: Partial<Notification>) {
    const all = await this.readAll();
    const now = new Date().toISOString();
    const notif: Notification = {
      id: (payload.id as string) || randomUUID(),
      userId: payload.userId || 'root',
      type: (payload.type as any) || 'system',
      title: payload.title || '',
      message: payload.message || '',
      isRead: false,
      createdAt: payload.createdAt || now,
      expiresAt: payload.expiresAt,
      actionUrl: payload.actionUrl,
    };
    // newest first
    all.unshift(notif);
    await this.writeAll(all);
    return notif;
  }

  async markAsRead(id: string) {
    const all = await this.readAll();
    const idx = all.findIndex((n) => n.id === id);
    if (idx === -1) return null;
    all[idx].isRead = true;
    await this.writeAll(all);
    return all[idx];
  }

  async markMultipleAsRead(ids: string[]) {
    if (!ids || ids.length === 0) return 0;
    const all = await this.readAll();
    const idSet = new Set(ids);
    let changed = 0;
    for (const n of all) {
      if (!n.isRead && idSet.has(n.id)) {
        n.isRead = true;
        changed++;
      }
    }
    if (changed > 0) await this.writeAll(all);
    return changed;
  }

  async delete(id: string) {
    const all = await this.readAll();
    const filtered = all.filter((n) => n.id !== id);
    if (filtered.length === all.length) return false;
    await this.writeAll(filtered);
    return true;
  }
}
