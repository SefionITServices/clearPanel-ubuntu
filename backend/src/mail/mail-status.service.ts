import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';

const execAsync = promisify(exec);

export interface MailServiceStatus {
  name: string;
  status: string;
  active: boolean;
  detail?: string;
}

export interface MailQueueStatus {
  total?: number;
  sample?: string[];
  message?: string;
  error?: string;
}

export interface RspamdStats {
  scanned?: number;
  learned?: number;
  spamCount?: number;
  hamCount?: number;
  greylistedCount?: number;
  rejectCount?: number;
  actionsData?: Record<string, number>;
}

export interface MailboxDiskUsage {
  domain: string;
  totalBytes: number;
  mailboxes: { email: string; bytes: number }[];
}

export interface DeliveryStats {
  sent: number;
  received: number;
  bounced: number;
  deferred: number;
  rejected: number;
}

export interface MailMetrics {
  rspamd?: RspamdStats;
  diskUsage?: MailboxDiskUsage[];
  delivery?: DeliveryStats;
  dovecotConnections?: number;
}

export interface MailHealthSnapshot {
  timestamp: string;
  services: MailServiceStatus[];
  queue: MailQueueStatus;
  metrics?: MailMetrics;
}

@Injectable()
export class MailStatusService {
  private readonly logger = new Logger(MailStatusService.name);
  private readonly servicesToCheck = ['postfix', 'dovecot', 'rspamd', 'clamav-daemon'];

  async getStatus(): Promise<MailHealthSnapshot> {
    const services = await Promise.all(this.servicesToCheck.map((service) => this.checkService(service)));
    const queue = await this.checkQueue();

    return {
      timestamp: new Date().toISOString(),
      services,
      queue,
    };
  }

  /** Extended status with metrics — heavier, called separately */
  async getMetrics(): Promise<MailMetrics> {
    const [rspamd, diskUsage, delivery, dovecotConnections] = await Promise.all([
      this.getRspamdStats(),
      this.getMailboxDiskUsage(),
      this.getDeliveryStats(),
      this.getDovecotConnections(),
    ]);
    return { rspamd, diskUsage, delivery, dovecotConnections };
  }

  private async checkService(name: string): Promise<MailServiceStatus> {
    try {
      const { stdout } = await execAsync(`systemctl is-active ${name}.service`);
      const status = stdout.trim() || 'unknown';
      return {
        name,
        status,
        active: status === 'active',
      };
    } catch (error) {
      const detail = this.extractDetail(error);
      const status = this.extractStatusFromError(error);
      return {
        name,
        status,
        active: false,
        detail,
      };
    }
  }

  private async checkQueue(): Promise<MailQueueStatus> {
    try {
      const { stdout } = await execAsync('postqueue -p');
      const output = stdout.trim();

      if (!output || /Mail queue is empty/i.test(output)) {
        return {
          total: 0,
          message: 'Mail queue is empty',
        };
      }

      const lines = output.split('\n');
      const entries = lines
        .map((line) => line.trim())
        .filter((line) => /^[0-9A-F][0-9A-F]*\s+/.test(line))
        .map((line) => this.sanitizeQueueLine(line));

      return {
        total: entries.length,
        sample: entries.slice(0, 10),
      };
    } catch (error) {
      const message = this.extractDetail(error) ?? 'Unable to read mail queue';
      this.logger.warn(`Queue inspection failed: ${message}`);
      return {
        error: message,
      };
    }
  }

  private sanitizeQueueLine(line: string): string {
    return line.replace(/<[^>]*>/g, '<redacted>');
  }

  private extractStatusFromError(error: unknown): string {
    if (error && typeof error === 'object') {
      const execError = error as { stdout?: string; stderr?: string };
      const stdout = execError.stdout?.trim();
      if (stdout) {
        return stdout;
      }
      const stderr = execError.stderr?.trim();
      if (stderr) {
        return stderr;
      }
    }
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return 'unknown';
  }

  private extractDetail(error: unknown): string | undefined {
    if (error && typeof error === 'object') {
      const execError = error as { stderr?: string; stdout?: string };
      const stderr = execError.stderr?.trim();
      if (stderr) {
        return stderr;
      }
      const stdout = execError.stdout?.trim();
      if (stdout) {
        return stdout;
      }
    }
    if (error instanceof Error) {
      return error.message;
    }
    return undefined;
  }

  // ---- Metrics (Phase 5) ----

  private async getRspamdStats(): Promise<RspamdStats | undefined> {
    try {
      // Rspamd exposes a JSON API on :11334 by default
      const { stdout } = await execAsync(
        'curl -s --max-time 3 http://127.0.0.1:11334/stat 2>/dev/null',
      );
      const data = JSON.parse(stdout);
      const actions = data.actions || {};
      return {
        scanned: data.scanned,
        learned: data.learned,
        spamCount: actions['add header'] || actions.rewrite_subject || 0,
        hamCount: actions['no action'] || 0,
        greylistedCount: actions.greylist || 0,
        rejectCount: actions.reject || 0,
        actionsData: actions,
      };
    } catch {
      return undefined;
    }
  }

  private async getMailboxDiskUsage(): Promise<MailboxDiskUsage[] | undefined> {
    const vmailHome = '/var/vmail';
    try {
      await fs.access(vmailHome);
    } catch {
      return undefined;
    }

    try {
      const domainDirs = await fs.readdir(vmailHome, { withFileTypes: true });
      const results: MailboxDiskUsage[] = [];

      for (const dir of domainDirs) {
        if (!dir.isDirectory() || dir.name.startsWith('.')) continue;
        const domain = dir.name;
        const domainPath = `${vmailHome}/${domain}`;
        const mailboxes: { email: string; bytes: number }[] = [];
        let totalBytes = 0;

        try {
          const userDirs = await fs.readdir(domainPath, { withFileTypes: true });
          for (const userDir of userDirs) {
            if (!userDir.isDirectory() || userDir.name.startsWith('.')) continue;
            try {
              const { stdout } = await execAsync(
                `du -sb '${domainPath}/${userDir.name}' 2>/dev/null | awk '{print $1}'`,
              );
              const bytes = parseInt(stdout.trim(), 10) || 0;
              mailboxes.push({ email: `${userDir.name}@${domain}`, bytes });
              totalBytes += bytes;
            } catch { /* skip */ }
          }
        } catch { /* skip this domain */ }

        results.push({ domain, totalBytes, mailboxes });
      }

      return results.length ? results : undefined;
    } catch {
      return undefined;
    }
  }

  private async getDeliveryStats(): Promise<DeliveryStats | undefined> {
    // Parse postfix log for last 24h stats
    try {
      const logFile = '/var/log/mail.log';
      await fs.access(logFile);

      const since = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

      // Count key events from the last 1000 lines (fast)
      const { stdout } = await execAsync(
        `tail -5000 ${logFile} 2>/dev/null | grep -c 'status=sent' || echo 0`,
      );
      const sent = parseInt(stdout.trim(), 10) || 0;

      const { stdout: rcvdOut } = await execAsync(
        `tail -5000 ${logFile} 2>/dev/null | grep -c 'dovecot.*lmtp.*sieve' || echo 0`,
      );
      const received = parseInt(rcvdOut.trim(), 10) || 0;

      const { stdout: bounceOut } = await execAsync(
        `tail -5000 ${logFile} 2>/dev/null | grep -c 'status=bounced' || echo 0`,
      );
      const bounced = parseInt(bounceOut.trim(), 10) || 0;

      const { stdout: deferOut } = await execAsync(
        `tail -5000 ${logFile} 2>/dev/null | grep -c 'status=deferred' || echo 0`,
      );
      const deferred = parseInt(deferOut.trim(), 10) || 0;

      const { stdout: rejectOut } = await execAsync(
        `tail -5000 ${logFile} 2>/dev/null | grep -c 'NOQUEUE: reject' || echo 0`,
      );
      const rejected = parseInt(rejectOut.trim(), 10) || 0;

      return { sent, received, bounced, deferred, rejected };
    } catch {
      return undefined;
    }
  }

  private async getDovecotConnections(): Promise<number | undefined> {
    try {
      const { stdout } = await execAsync(
        `doveadm who 2>/dev/null | tail -n +2 | wc -l`,
      );
      return parseInt(stdout.trim(), 10) || 0;
    } catch {
      return undefined;
    }
  }
}
