import { Injectable, Logger } from '@nestjs/common';
import { exec as execCb, spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { getDataFilePath } from '../common/paths';
import { DomainsService } from '../domains/domains.service';
import { CreateFtpAccountDto } from './dto/ftp.dto';

const exec = promisify(execCb);

export interface FtpAccount {
  id: string;
  domain: string;
  label: string;
  login: string;
  rootPath: string;
  createdAt: string;
  updatedAt?: string;
}

interface FtpServiceInfo {
  installed: boolean;
  running: boolean;
}

@Injectable()
export class FtpService {
  private readonly logger = new Logger(FtpService.name);
  private cache: { data: FtpAccount[]; ts: number } | null = null;
  private static readonly CACHE_TTL = 5000;

  constructor(private readonly domainsService: DomainsService) {}

  private get accountsPath(): string {
    return getDataFilePath('ftp-accounts.json');
  }

  private async readAccounts(): Promise<FtpAccount[]> {
    const now = Date.now();
    if (this.cache && now - this.cache.ts < FtpService.CACHE_TTL) return this.cache.data;
    try {
      const data = await fs.readFile(this.accountsPath, 'utf-8');
      const parsed = JSON.parse(data);
      this.cache = { data: parsed, ts: now };
      return parsed;
    } catch {
      return [];
    }
  }

  private async writeAccounts(accounts: FtpAccount[]): Promise<void> {
    await fs.mkdir(path.dirname(this.accountsPath), { recursive: true });
    await fs.writeFile(this.accountsPath, JSON.stringify(accounts, null, 2));
    this.cache = { data: accounts, ts: Date.now() };
  }

  private sanitizeUsername(input: string): string {
    let cleaned = input.replace(/[^a-zA-Z0-9_.-]/g, '').toLowerCase();
    cleaned = cleaned.replace(/^[^a-z0-9]+/, '');
    return cleaned;
  }

  private buildSystemUsername(owner: string, requested: string): string {
    const cleanOwner = this.sanitizeUsername(owner || 'cp') || 'cp';
    const cleanRequested = this.sanitizeUsername(requested);
    if (!cleanRequested) {
      throw new Error('Username is invalid');
    }
    let combined = `${cleanOwner}_${cleanRequested}`;
    if (combined.length > 32) {
      combined = combined.slice(0, 32);
    }
    return combined;
  }

  private getUserRoot(owner: string): string {
    const base = (process.env.ROOT_PATH || '/home').trim() || '/home';
    return path.resolve(path.join(base, owner));
  }

  private resolveRootPath(owner: string, domainRoot: string, override?: string): string {
    const rootBase = this.getUserRoot(owner);
    const desired = override
      ? (path.isAbsolute(override) ? override : path.join(rootBase, override))
      : domainRoot;
    const resolved = path.resolve(desired);
    const rootResolved = path.resolve(rootBase);
    const insideRoot = resolved === rootResolved || resolved.startsWith(`${rootResolved}${path.sep}`);
    if (!insideRoot) {
      throw new Error('Root path must be inside the user home directory');
    }
    if (resolved.includes('"') || resolved.includes('\n') || resolved.includes('\r')) {
      throw new Error('Root path contains invalid characters');
    }
    return resolved;
  }

  private async userExists(login: string): Promise<boolean> {
    try {
      await exec(`id -u ${login}`);
      return true;
    } catch {
      return false;
    }
  }

  private async sudo(cmd: string, timeout = 30000): Promise<string> {
    const { stdout } = await exec(`sudo ${cmd}`, { timeout });
    return stdout.trim();
  }

  private async setPassword(login: string, password: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const child = spawn('sudo', ['/usr/sbin/chpasswd'], { stdio: ['pipe', 'pipe', 'pipe'] });
      let stderr = '';
      child.stderr.on('data', (data) => { stderr += data.toString(); });
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) return resolve();
        reject(new Error(stderr || `chpasswd failed (code ${code})`));
      });
      child.stdin.write(`${login}:${password}\n`);
      child.stdin.end();
    });
  }

  private async applyAcl(rootPath: string, login: string): Promise<void> {
    try {
      await exec(`setfacl -m u:${login}:rwx "${rootPath}"`);
      await exec(`setfacl -d -m u:${login}:rwx "${rootPath}"`);
    } catch (e: any) {
      this.logger.warn(`Failed to apply ACL for ${login}: ${e.message || e}`);
    }
  }

  private async removeAcl(rootPath: string, login: string): Promise<void> {
    try {
      await exec(`setfacl -x u:${login} "${rootPath}"`);
      await exec(`setfacl -d -x u:${login} "${rootPath}"`);
    } catch (e: any) {
      this.logger.warn(`Failed to remove ACL for ${login}: ${e.message || e}`);
    }
  }

  private async checkService(binPath: string, service: string): Promise<FtpServiceInfo> {
    let installed = false;
    try {
      await fs.access(binPath);
      installed = true;
    } catch {
      installed = false;
    }

    let running = false;
    if (installed) {
      try {
        const out = await this.sudo(`systemctl is-active ${service}`);
        running = out.trim() === 'active';
      } catch {
        running = false;
      }
    }

    return { installed, running };
  }

  async getStatus(): Promise<{ vsftpd: FtpServiceInfo; proftpd: FtpServiceInfo; active: string | null }> {
    const vsftpd = await this.checkService('/usr/sbin/vsftpd', 'vsftpd');
    const proftpd = await this.checkService('/usr/sbin/proftpd', 'proftpd');
    const active = vsftpd.running ? 'vsftpd' : (proftpd.running ? 'proftpd' : null);
    return { vsftpd, proftpd, active };
  }

  async listAccounts(owner: string): Promise<Array<FtpAccount & { exists: boolean }>> {
    const accounts = await this.readAccounts();
    const results = await Promise.all(accounts.map(async (acc) => ({
      ...acc,
      exists: await this.userExists(acc.login),
    })));
    return results;
  }

  async createAccount(owner: string, input: CreateFtpAccountDto) {
    const domains = await this.domainsService.listDomains();
    const domain = domains.find((d) => d.name.toLowerCase() === input.domain.toLowerCase());
    if (!domain) throw new Error('Domain not found');

    const rootPath = this.resolveRootPath(owner, domain.folderPath, input.rootPath);
    await fs.mkdir(rootPath, { recursive: true });

    const login = this.buildSystemUsername(owner, input.username);
    if (await this.userExists(login)) {
      throw new Error(`FTP login "${login}" already exists`);
    }

    const accounts = await this.readAccounts();
    if (accounts.some(a => a.login === login)) {
      throw new Error(`FTP login "${login}" already exists`);
    }

    try {
      await this.sudo(`/usr/sbin/useradd -M -d "${rootPath}" -s /usr/sbin/nologin "${login}"`);
      await this.setPassword(login, input.password);
      await this.applyAcl(rootPath, login);
    } catch (e: any) {
      if (await this.userExists(login)) {
        try { await this.sudo(`/usr/sbin/userdel "${login}"`); } catch {}
      }
      throw new Error(e.message || String(e));
    }

    const account: FtpAccount = {
      id: randomUUID(),
      domain: domain.name,
      label: input.username,
      login,
      rootPath,
      createdAt: new Date().toISOString(),
    };

    accounts.push(account);
    await this.writeAccounts(accounts);

    return { success: true, account };
  }

  async resetPassword(owner: string, login: string, password: string) {
    const cleanLogin = this.sanitizeUsername(login);
    if (!cleanLogin || cleanLogin !== login.toLowerCase()) throw new Error('Invalid login');
    if (!(await this.userExists(cleanLogin))) {
      throw new Error('FTP account does not exist');
    }
    await this.setPassword(cleanLogin, password);
    return { success: true, message: 'Password updated' };
  }

  async deleteAccount(owner: string, id: string) {
    const accounts = await this.readAccounts();
    const idx = accounts.findIndex(a => a.id === id);
    if (idx === -1) throw new Error('Account not found');
    const account = accounts[idx];

    try {
      await this.removeAcl(account.rootPath, account.login);
      await this.sudo(`/usr/sbin/userdel "${account.login}"`);
    } catch (e: any) {
      throw new Error(e.message || String(e));
    }

    accounts.splice(idx, 1);
    await this.writeAccounts(accounts);

    return { success: true, message: 'FTP account deleted', account };
  }
}
