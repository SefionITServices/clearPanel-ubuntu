import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ServerSettings } from './server-settings.interface';

@Injectable()
export class ServerSettingsService implements OnModuleInit {
  private readonly logger = new Logger(ServerSettingsService.name);
  private readonly settingsPath = path.join(process.cwd(), 'server-settings.json');
  private cache: ServerSettings | null = null;

  async onModuleInit(): Promise<void> {
    try {
      const settings = await this.readSettings();
      if (settings.serverIp) {
        process.env.SERVER_IP = settings.serverIp;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Unable to initialize server settings: ${message}`);
    }
  }

  async getSettings(): Promise<ServerSettings> {
    const settings = await this.readSettings();
    return this.clone(settings);
  }

  async updateSettings(update: Partial<ServerSettings>): Promise<ServerSettings> {
    const current = await this.readSettings();
    const nameservers = update.nameservers
      ? this.normalizeNameservers(update.nameservers)
      : current.nameservers;

    const next: ServerSettings = {
      primaryDomain: update.primaryDomain ?? current.primaryDomain,
      serverIp: this.resolveServerIp(update.serverIp ?? current.serverIp),
      nameservers,
      updatedAt: new Date().toISOString(),
    };

    await this.writeSettings(next);
    return this.clone(next);
  }

  async getServerIp(): Promise<string> {
    const settings = await this.readSettings();
    const ip = this.resolveServerIp(settings.serverIp);
    if (ip) {
      return ip;
    }
    return '0.0.0.0';
  }

  private async readSettings(): Promise<ServerSettings> {
    if (this.cache) {
      return this.cache;
    }

    try {
      const data = await fs.readFile(this.settingsPath, 'utf-8');
      const parsed = JSON.parse(data) as ServerSettings;
      const normalized: ServerSettings = {
        primaryDomain: parsed.primaryDomain?.toLowerCase(),
        serverIp: this.resolveServerIp(parsed.serverIp),
        nameservers: this.normalizeNameservers(parsed.nameservers ?? []),
        updatedAt: parsed.updatedAt,
      };
      this.cache = normalized;
      return normalized;
    } catch (error) {
      const defaultSettings: ServerSettings = {
        primaryDomain: undefined,
        serverIp: this.resolveServerIp(undefined),
        nameservers: [],
        updatedAt: new Date().toISOString(),
      };
      await this.writeSettings(defaultSettings);
      return defaultSettings;
    }
  }

  private async writeSettings(settings: ServerSettings): Promise<void> {
    const payload = JSON.stringify(settings, null, 2);
    await fs.writeFile(this.settingsPath, payload, 'utf-8');
    this.cache = this.clone(settings);
    if (settings.serverIp) {
      process.env.SERVER_IP = settings.serverIp;
    }
  }

  private resolveServerIp(explicit?: string): string | undefined {
    const trimmed = explicit?.trim();
    if (trimmed) {
      return trimmed;
    }
    if (process.env.SERVER_IP && process.env.SERVER_IP.trim().length > 0) {
      return process.env.SERVER_IP.trim();
    }
    return this.detectPrimaryInterface();
  }

  private detectPrimaryInterface(): string | undefined {
    const interfaces = os.networkInterfaces();
    for (const value of Object.values(interfaces)) {
      if (!value) continue;
      for (const details of value) {
        if (details.family === 'IPv4' && !details.internal && details.address) {
          return details.address;
        }
      }
    }
    return undefined;
  }

  private normalizeNameservers(values: string[]): string[] {
    const normalized = values
      .map((ns) => ns.trim().toLowerCase())
      .filter((ns) => ns.length > 0)
      .map((ns) => (ns.endsWith('.') ? ns.slice(0, -1) : ns));
    return Array.from(new Set(normalized));
  }

  private clone(settings: ServerSettings): ServerSettings {
    return {
      primaryDomain: settings.primaryDomain,
      serverIp: settings.serverIp,
      nameservers: [...settings.nameservers],
      updatedAt: settings.updatedAt,
    };
  }
}
