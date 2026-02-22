import { Injectable, Logger } from '@nestjs/common';
import { exec as execCb } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const exec = promisify(execCb);

// ─── Types ────────────────────────────────────────────────────────────

export interface BackupInfo {
  filename: string;
  path: string;
  size: number;
  createdAt: string;
  type: 'full' | 'panel' | 'mail' | 'databases' | 'domains';
  description: string;
}

export interface BackupSchedule {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string;  // HH:MM
  retention: number;  // keep N backups
  types: string[];
}

// ─── Service ──────────────────────────────────────────────────────────

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  private get backupDir(): string {
    return process.env.BACKUP_DIR || '/home/backups/clearpanel';
  }

  private get dataDir(): string {
    return process.env.DATA_DIR || path.join(os.homedir(), 'etc', 'clearpanel');
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  private async ensureBackupDir(): Promise<void> {
    await fs.mkdir(this.backupDir, { recursive: true });
  }

  private timestamp(): string {
    return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  }

  private async fileSize(filePath: string): Promise<number> {
    try {
      const stat = await fs.stat(filePath);
      return stat.size;
    } catch { return 0; }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  LIST BACKUPS
  // ═══════════════════════════════════════════════════════════════════

  async listBackups(): Promise<{ success: boolean; backups: BackupInfo[]; error?: string }> {
    try {
      await this.ensureBackupDir();
      const files = await fs.readdir(this.backupDir);
      const backups: BackupInfo[] = [];

      for (const filename of files) {
        if (!filename.endsWith('.tar.gz') && !filename.endsWith('.sql.gz')) continue;
        const filePath = path.join(this.backupDir, filename);
        const stat = await fs.stat(filePath);

        // Parse type from filename (e.g., backup-full-2025-02-22T10-30-00.tar.gz)
        let type: BackupInfo['type'] = 'full';
        let description = 'Server backup';
        if (filename.includes('-panel-')) { type = 'panel'; description = 'Panel configuration backup'; }
        else if (filename.includes('-mail-')) { type = 'mail'; description = 'Mail data backup'; }
        else if (filename.includes('-databases-')) { type = 'databases'; description = 'Database backup'; }
        else if (filename.includes('-domains-')) { type = 'domains'; description = 'Domains & vhosts backup'; }
        else if (filename.includes('-full-')) { type = 'full'; description = 'Full server backup'; }

        backups.push({
          filename,
          path: filePath,
          size: stat.size,
          createdAt: stat.mtime.toISOString(),
          type,
          description,
        });
      }

      // Sort newest first
      backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return { success: true, backups };
    } catch (e: any) {
      this.logger.error(`Failed to list backups: ${e.message}`);
      return { success: false, backups: [], error: e.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  CREATE BACKUP
  // ═══════════════════════════════════════════════════════════════════

  async createBackup(type: 'full' | 'panel' | 'mail' | 'databases' | 'domains'): Promise<{ success: boolean; message: string; filename?: string }> {
    try {
      await this.ensureBackupDir();
      const ts = this.timestamp();

      switch (type) {
        case 'full':
          return this.createFullBackup(ts);
        case 'panel':
          return this.createPanelBackup(ts);
        case 'mail':
          return this.createMailBackup(ts);
        case 'databases':
          return this.createDatabaseBackup(ts);
        case 'domains':
          return this.createDomainsBackup(ts);
        default:
          return { success: false, message: `Unknown backup type: ${type}` };
      }
    } catch (e: any) {
      this.logger.error(`Backup failed: ${e.message}`);
      return { success: false, message: e.message };
    }
  }

  // ─── Full Backup ──────────────────────────────────────────────────

  private async createFullBackup(ts: string): Promise<{ success: boolean; message: string; filename?: string }> {
    const filename = `backup-full-${ts}.tar.gz`;
    const outPath = path.join(this.backupDir, filename);

    // Build include list of directories that exist
    const dirs: string[] = [];
    const candidates = [
      this.dataDir,
      '/etc/nginx/sites-available',
      '/etc/nginx/sites-enabled',
      '/etc/bind/zones',
      '/etc/letsencrypt',
      '/etc/postfix',
      '/etc/dovecot',
      '/etc/opendkim',
      '/var/mail/vhosts',
    ];

    for (const dir of candidates) {
      try { await fs.access(dir); dirs.push(dir); } catch {}
    }

    if (dirs.length === 0) {
      return { success: false, message: 'No data directories found to backup' };
    }

    // Create database dumps first
    const dbDumpPath = path.join(this.backupDir, `.tmp-db-${ts}`);
    await fs.mkdir(dbDumpPath, { recursive: true });

    try {
      await exec(`mysqldump --all-databases 2>/dev/null | gzip > "${dbDumpPath}/mysql-all.sql.gz"`, { timeout: 300_000 });
    } catch {}

    try {
      await exec(`sudo -u postgres pg_dumpall 2>/dev/null | gzip > "${dbDumpPath}/postgres-all.sql.gz"`, { timeout: 300_000 });
    } catch {}

    dirs.push(dbDumpPath);
    const dirArgs = dirs.map(d => `"${d}"`).join(' ');

    try {
      await exec(`tar -czf "${outPath}" ${dirArgs} 2>/dev/null`, { timeout: 600_000 });
    } catch (e: any) {
      // tar may warn about changing files, but still create the archive
      try { await fs.access(outPath); } catch { throw e; }
    }

    // Cleanup temp
    try { await exec(`rm -rf "${dbDumpPath}"`); } catch {}

    const size = await this.fileSize(outPath);
    return { success: true, message: `Full backup created (${this.formatSize(size)})`, filename };
  }

  // ─── Panel Config Backup ──────────────────────────────────────────

  private async createPanelBackup(ts: string): Promise<{ success: boolean; message: string; filename?: string }> {
    const filename = `backup-panel-${ts}.tar.gz`;
    const outPath = path.join(this.backupDir, filename);

    const dirs: string[] = [];
    try { await fs.access(this.dataDir); dirs.push(this.dataDir); } catch {}

    if (dirs.length === 0) {
      return { success: false, message: 'Panel data directory not found' };
    }

    await exec(`tar -czf "${outPath}" ${dirs.map(d => `"${d}"`).join(' ')} 2>/dev/null`, { timeout: 120_000 });
    const size = await this.fileSize(outPath);
    return { success: true, message: `Panel backup created (${this.formatSize(size)})`, filename };
  }

  // ─── Mail Backup ──────────────────────────────────────────────────

  private async createMailBackup(ts: string): Promise<{ success: boolean; message: string; filename?: string }> {
    const filename = `backup-mail-${ts}.tar.gz`;
    const outPath = path.join(this.backupDir, filename);

    const dirs: string[] = [];
    const candidates = ['/var/mail/vhosts', '/etc/postfix', '/etc/dovecot', '/etc/opendkim'];
    for (const d of candidates) {
      try { await fs.access(d); dirs.push(d); } catch {}
    }

    if (dirs.length === 0) {
      return { success: false, message: 'No mail directories found' };
    }

    try {
      await exec(`tar -czf "${outPath}" ${dirs.map(d => `"${d}"`).join(' ')} 2>/dev/null`, { timeout: 300_000 });
    } catch (e: any) {
      try { await fs.access(outPath); } catch { throw e; }
    }

    const size = await this.fileSize(outPath);
    return { success: true, message: `Mail backup created (${this.formatSize(size)})`, filename };
  }

  // ─── Database Backup ──────────────────────────────────────────────

  private async createDatabaseBackup(ts: string): Promise<{ success: boolean; message: string; filename?: string }> {
    const filename = `backup-databases-${ts}.tar.gz`;
    const outPath = path.join(this.backupDir, filename);
    const tmpDir = path.join(this.backupDir, `.tmp-db-${ts}`);
    await fs.mkdir(tmpDir, { recursive: true });

    let hasDumps = false;

    // MySQL/MariaDB
    try {
      await exec(`mysqldump --all-databases 2>/dev/null | gzip > "${tmpDir}/mysql-all.sql.gz"`, { timeout: 300_000 });
      const size = await this.fileSize(`${tmpDir}/mysql-all.sql.gz`);
      if (size > 50) hasDumps = true;
    } catch {}

    // PostgreSQL
    try {
      await exec(`sudo -u postgres pg_dumpall 2>/dev/null | gzip > "${tmpDir}/postgres-all.sql.gz"`, { timeout: 300_000 });
      const size = await this.fileSize(`${tmpDir}/postgres-all.sql.gz`);
      if (size > 50) hasDumps = true;
    } catch {}

    if (!hasDumps) {
      try { await exec(`rm -rf "${tmpDir}"`); } catch {}
      return { success: false, message: 'No databases found to backup' };
    }

    await exec(`tar -czf "${outPath}" -C "${tmpDir}" . 2>/dev/null`, { timeout: 120_000 });
    try { await exec(`rm -rf "${tmpDir}"`); } catch {}

    const size = await this.fileSize(outPath);
    return { success: true, message: `Database backup created (${this.formatSize(size)})`, filename };
  }

  // ─── Domains Backup ───────────────────────────────────────────────

  private async createDomainsBackup(ts: string): Promise<{ success: boolean; message: string; filename?: string }> {
    const filename = `backup-domains-${ts}.tar.gz`;
    const outPath = path.join(this.backupDir, filename);

    const dirs: string[] = [];
    const candidates = ['/etc/nginx/sites-available', '/etc/nginx/sites-enabled', '/etc/bind/zones', '/etc/letsencrypt'];
    for (const d of candidates) {
      try { await fs.access(d); dirs.push(d); } catch {}
    }

    // Also include domains.json and dns.json from data dir
    const dataFiles = ['domains.json', 'dns.json'].map(f => path.join(this.dataDir, f));
    for (const f of dataFiles) {
      try { await fs.access(f); dirs.push(f); } catch {}
    }

    if (dirs.length === 0) {
      return { success: false, message: 'No domain data found' };
    }

    await exec(`tar -czf "${outPath}" ${dirs.map(d => `"${d}"`).join(' ')} 2>/dev/null`, { timeout: 120_000 });
    const size = await this.fileSize(outPath);
    return { success: true, message: `Domains backup created (${this.formatSize(size)})`, filename };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  RESTORE BACKUP
  // ═══════════════════════════════════════════════════════════════════

  async restoreBackup(filename: string): Promise<{ success: boolean; message: string }> {
    try {
      const filePath = path.join(this.backupDir, filename);
      try { await fs.access(filePath); } catch {
        return { success: false, message: `Backup file not found: ${filename}` };
      }

      if (filename.endsWith('.tar.gz')) {
        // Test archive first
        await exec(`tar -tzf "${filePath}" > /dev/null 2>&1`, { timeout: 60_000 });
        // Extract to root (paths are absolute within archive)
        await exec(`tar -xzf "${filePath}" -C / 2>/dev/null`, { timeout: 600_000 });
      } else if (filename.endsWith('.sql.gz')) {
        // Database restore
        if (filename.includes('mysql')) {
          await exec(`zcat "${filePath}" | mysql`, { timeout: 600_000 });
        } else if (filename.includes('postgres')) {
          await exec(`zcat "${filePath}" | sudo -u postgres psql`, { timeout: 600_000 });
        }
      }

      return { success: true, message: `Backup "${filename}" restored successfully. A service restart may be required.` };
    } catch (e: any) {
      this.logger.error(`Restore failed: ${e.message}`);
      return { success: false, message: e.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  DELETE BACKUP
  // ═══════════════════════════════════════════════════════════════════

  async deleteBackup(filename: string): Promise<{ success: boolean; message: string }> {
    try {
      const filePath = path.join(this.backupDir, filename);
      // Safety: ensure file is in backup dir
      if (!filePath.startsWith(this.backupDir)) {
        return { success: false, message: 'Invalid path' };
      }
      await fs.unlink(filePath);
      return { success: true, message: 'Backup deleted' };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  SCHEDULED BACKUPS
  // ═══════════════════════════════════════════════════════════════════

  async getSchedule(): Promise<{ success: boolean; schedule: BackupSchedule }> {
    const defaultSchedule: BackupSchedule = {
      enabled: false,
      frequency: 'daily',
      time: '03:00',
      retention: 7,
      types: ['full'],
    };

    try {
      const schedulePath = path.join(this.dataDir, 'backup-schedule.json');
      const raw = await fs.readFile(schedulePath, 'utf-8');
      const schedule = { ...defaultSchedule, ...JSON.parse(raw) };
      return { success: true, schedule };
    } catch {
      return { success: true, schedule: defaultSchedule };
    }
  }

  async saveSchedule(schedule: BackupSchedule): Promise<{ success: boolean; message: string }> {
    try {
      // Save config
      await fs.mkdir(this.dataDir, { recursive: true });
      const schedulePath = path.join(this.dataDir, 'backup-schedule.json');
      await fs.writeFile(schedulePath, JSON.stringify(schedule, null, 2));

      // Update crontab
      if (schedule.enabled) {
        const [hour, minute] = schedule.time.split(':');
        let cronSchedule = '';
        switch (schedule.frequency) {
          case 'daily': cronSchedule = `${minute} ${hour} * * *`; break;
          case 'weekly': cronSchedule = `${minute} ${hour} * * 0`; break;
          case 'monthly': cronSchedule = `${minute} ${hour} 1 * *`; break;
        }

        // Remove existing backup cron, add new one
        const backupCmd = '/usr/local/bin/clearpanel backup';
        try {
          const { stdout } = await exec('crontab -l 2>/dev/null || echo ""');
          const lines = stdout.split('\n').filter(l => !l.includes('clearpanel backup'));
          lines.push(`${cronSchedule} ${backupCmd} # ClearPanel auto-backup`);
          const newCrontab = lines.filter(l => l.trim()).join('\n') + '\n';
          await exec(`echo '${newCrontab.replace(/'/g, "'\\''")}' | crontab -`, { timeout: 10_000 });
        } catch (e: any) {
          this.logger.warn(`Failed to update crontab: ${e.message}`);
        }
      } else {
        // Remove backup cron
        try {
          const { stdout } = await exec('crontab -l 2>/dev/null || echo ""');
          const lines = stdout.split('\n').filter(l => !l.includes('clearpanel backup'));
          const newCrontab = lines.filter(l => l.trim()).join('\n') + '\n';
          await exec(`echo '${newCrontab.replace(/'/g, "'\\''")}' | crontab -`, { timeout: 10_000 });
        } catch {}
      }

      return { success: true, message: 'Backup schedule saved' };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  // ─── Utility ──────────────────────────────────────────────────────

  private formatSize(bytes: number): string {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(i > 1 ? 2 : 0)} ${sizes[i]}`;
  }
}
