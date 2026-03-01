import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { getDataFilePath } from '../common/paths';
import { injectNginxBlock, reloadNginx } from '../common/nginx-inject';
import { AddDirUserDto, CreateDirPrivacyDto } from './dto/dir-privacy.dto';

const execAsync = promisify(exec);

export interface DirPrivacyEntry {
  id: string;
  domain: string;
  dirPath: string;
  label: string;
  htpasswdFile: string;
  users: string[];
  createdAt: string;
}

const HTPASSWD_DIR = '/etc/clearpanel/htpasswd';

@Injectable()
export class DirPrivacyService {
  private readonly logger = new Logger(DirPrivacyService.name);

  private get dataPath(): string {
    return getDataFilePath('dir-privacy.json');
  }

  private async readAll(): Promise<DirPrivacyEntry[]> {
    try {
      const raw = await fs.readFile(this.dataPath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  private async writeAll(items: DirPrivacyEntry[]): Promise<void> {
    await fs.mkdir(path.dirname(this.dataPath), { recursive: true });
    await fs.writeFile(this.dataPath, JSON.stringify(items, null, 2));
  }

  async list(domain?: string): Promise<DirPrivacyEntry[]> {
    const all = await this.readAll();
    const items = domain ? all.filter((e) => e.domain === domain) : all;
    return items;
  }

  async create(dto: CreateDirPrivacyDto): Promise<{ success: boolean; entry: DirPrivacyEntry }> {
    const all = await this.readAll();

    const dirPath = dto.dirPath.startsWith('/') ? dto.dirPath : `/${dto.dirPath}`;
    const htpasswdFile = path.join(
      HTPASSWD_DIR,
      `${dto.domain}-${dirPath.replace(/\//g, '_').replace(/^_/, '')}.htpasswd`,
    );

    const entry: DirPrivacyEntry = {
      id: randomUUID(),
      domain: dto.domain,
      dirPath,
      label: dto.label,
      htpasswdFile,
      users: [],
      createdAt: new Date().toISOString(),
    };

    all.push(entry);
    await this.writeAll(all);

    // Create empty htpasswd file
    try {
      await execAsync(`sudo mkdir -p ${HTPASSWD_DIR}`);
      await execAsync(`sudo touch "${htpasswdFile}"`);
      await execAsync(`sudo chmod 640 "${htpasswdFile}"`);
    } catch (e: any) {
      this.logger.warn(`Could not create htpasswd file: ${e.message}`);
    }

    await this.syncNginx(dto.domain, all);
    return { success: true, entry };
  }

  async remove(id: string): Promise<{ success: boolean; message: string }> {
    const all = await this.readAll();
    const idx = all.findIndex((e) => e.id === id);
    if (idx === -1) return { success: false, message: 'Entry not found' };
    const { domain, htpasswdFile } = all[idx];
    all.splice(idx, 1);
    await this.writeAll(all);

    try {
      await execAsync(`sudo rm -f "${htpasswdFile}"`);
    } catch {}

    await this.syncNginx(domain, all);
    return { success: true, message: 'Directory protection removed' };
  }

  async addUser(
    id: string,
    dto: AddDirUserDto,
  ): Promise<{ success: boolean; message: string }> {
    const all = await this.readAll();
    const entry = all.find((e) => e.id === id);
    if (!entry) return { success: false, message: 'Entry not found' };

    const { htpasswdFile, users } = entry;

    try {
      // -b = use password from CLI, -c = create (only first user), -i = read from stdin
      const flag = users.length === 0 ? '-c' : '';
      // Use -B for bcrypt hashing
      await execAsync(
        `sudo htpasswd -bB ${flag} "${htpasswdFile}" "${dto.username}" "${dto.password}"`,
      );
    } catch (e: any) {
      // htpasswd may not be installed — try openssl fallback
      try {
        const hash = (
          await execAsync(
            `openssl passwd -apr1 "${dto.password}"`,
          )
        ).stdout.trim();
        const line = `${dto.username}:${hash}\n`;
        await execAsync(`sudo bash -c 'echo "${line}" >> "${htpasswdFile}"'`);
      } catch (e2: any) {
        return { success: false, message: `Failed to add user: ${e2.message}` };
      }
    }

    if (!users.includes(dto.username)) {
      entry.users = [...users, dto.username];
    }
    await this.writeAll(all);
    return { success: true, message: `User ${dto.username} added` };
  }

  async removeUser(
    id: string,
    username: string,
  ): Promise<{ success: boolean; message: string }> {
    const all = await this.readAll();
    const entry = all.find((e) => e.id === id);
    if (!entry) return { success: false, message: 'Entry not found' };

    try {
      await execAsync(`sudo htpasswd -D "${entry.htpasswdFile}" "${username}"`);
    } catch (e: any) {
      this.logger.warn(`htpasswd delete failed: ${e.message}`);
    }
    entry.users = entry.users.filter((u) => u !== username);
    await this.writeAll(all);
    return { success: true, message: `User ${username} removed` };
  }

  private async syncNginx(domain: string, all: DirPrivacyEntry[]): Promise<void> {
    const entries = all.filter((e) => e.domain === domain);
    const lines: string[] = [];

    for (const e of entries) {
      lines.push(`location ^~ ${e.dirPath} {`);
      lines.push(`    auth_basic "${e.label}";`);
      lines.push(`    auth_basic_user_file ${e.htpasswdFile};`);
      lines.push(`    try_files $uri $uri/ =404;`);
      lines.push(`}`);
    }

    try {
      await injectNginxBlock(domain, 'DIRPRIVACY', lines.join('\n'));
      await reloadNginx();
    } catch (e: any) {
      this.logger.warn(`Failed to sync dir-privacy nginx config for ${domain}: ${e.message}`);
    }
  }
}
