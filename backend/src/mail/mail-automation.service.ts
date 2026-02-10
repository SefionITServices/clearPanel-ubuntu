import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as path from 'node:path';

const execAsync = promisify(exec);

export interface AutomationLog {
  task: string;
  success: boolean;
  message: string;
  detail?: string;
}

export interface DkimResult {
  selector: string;
  publicRecord: string;
}

export interface DomainPolicySettings {
  spamThreshold?: number;
  greylistingEnabled?: boolean;
  greylistingDelaySeconds?: number;
  virusScanEnabled?: boolean;
}

@Injectable()
export class MailAutomationService {
  private readonly logger = new Logger(MailAutomationService.name);
  private readonly scriptsDir = path.join(process.cwd(), '..', 'scripts', 'email');

  async ensureStack(): Promise<AutomationLog[]> {
    const logs: AutomationLog[] = [];
    const script = path.join(this.scriptsDir, 'install-stack.sh');
    try {
      const { stdout, stderr } = await this.runScript(script, []);
      logs.push({
        task: 'Install mail stack',
        success: true,
        message: 'Postfix/Dovecot stack verified',
        detail: this.compact(stdout, stderr),
      });
    } catch (error) {
      logs.push({
        task: 'Install mail stack',
        success: false,
        message: 'Mail stack installation failed',
        detail: this.errorMessage(error),
      });
    }
    return logs;
  }

  async provisionDomain(domain: string): Promise<AutomationLog[]> {
    const logs: AutomationLog[] = [];
    const script = path.join(this.scriptsDir, 'provision-domain.sh');
    try {
      const { stdout, stderr } = await this.runScript(script, [domain]);
      logs.push({
        task: 'Provision mail domain',
        success: true,
        message: `Provisioned ${domain}`,
        detail: this.compact(stdout, stderr),
      });
    } catch (error) {
      logs.push({
        task: 'Provision mail domain',
        success: false,
        message: `Failed to provision ${domain}`,
        detail: this.errorMessage(error),
      });
    }
    return logs;
  }

  async removeDomain(domain: string): Promise<AutomationLog[]> {
    const logs: AutomationLog[] = [];
    const script = path.join(this.scriptsDir, 'remove-domain.sh');
    try {
      const { stdout, stderr } = await this.runScript(script, [domain]);
      logs.push({
        task: 'Remove mail domain',
        success: true,
        message: `Removed ${domain}`,
        detail: this.compact(stdout, stderr),
      });
    } catch (error) {
      logs.push({
        task: 'Remove mail domain',
        success: false,
        message: `Failed to remove ${domain}`,
        detail: this.errorMessage(error),
      });
    }
    return logs;
  }

  async provisionMailbox(domain: string, mailbox: string, passwordHash: string, quotaMb?: number): Promise<AutomationLog[]> {
    const logs: AutomationLog[] = [];
    const script = path.join(this.scriptsDir, 'provision-mailbox.sh');
    try {
      const args: string[] = [domain, mailbox, passwordHash];
      if (typeof quotaMb === 'number' && !Number.isNaN(quotaMb)) {
        args.push(String(quotaMb));
      }
      const { stdout, stderr } = await this.runScript(script, args, { redactArgs: true });
      logs.push({
        task: 'Provision mailbox',
        success: true,
        message: `Provisioned ${mailbox}`,
        detail: this.compact(stdout, stderr),
      });
    } catch (error) {
      logs.push({
        task: 'Provision mailbox',
        success: false,
        message: `Failed to provision ${mailbox}`,
        detail: this.errorMessage(error),
      });
    }
    return logs;
  }

  async removeMailbox(domain: string, mailbox: string): Promise<AutomationLog[]> {
    const logs: AutomationLog[] = [];
    const script = path.join(this.scriptsDir, 'remove-mailbox.sh');
    try {
      const { stdout, stderr } = await this.runScript(script, [domain, mailbox]);
      logs.push({
        task: 'Remove mailbox',
        success: true,
        message: `Removed ${mailbox}`,
        detail: this.compact(stdout, stderr),
      });
    } catch (error) {
      logs.push({
        task: 'Remove mailbox',
        success: false,
        message: `Failed to remove ${mailbox}`,
        detail: this.errorMessage(error),
      });
    }
    return logs;
  }

  async provisionAlias(domain: string, source: string, destination: string): Promise<AutomationLog[]> {
    const logs: AutomationLog[] = [];
    const script = path.join(this.scriptsDir, 'provision-alias.sh');
    try {
      const { stdout, stderr } = await this.runScript(script, [domain, source, destination]);
      logs.push({
        task: 'Provision alias',
        success: true,
        message: `Alias ${source} → ${destination}`,
        detail: this.compact(stdout, stderr),
      });
    } catch (error) {
      logs.push({
        task: 'Provision alias',
        success: false,
        message: `Failed to configure alias ${source}`,
        detail: this.errorMessage(error),
      });
    }
    return logs;
  }

  async removeAlias(domain: string, source: string): Promise<AutomationLog[]> {
    const logs: AutomationLog[] = [];
    const script = path.join(this.scriptsDir, 'remove-alias.sh');
    try {
      const { stdout, stderr } = await this.runScript(script, [domain, source]);
      logs.push({
        task: 'Remove alias',
        success: true,
        message: `Removed alias ${source}`,
        detail: this.compact(stdout, stderr),
      });
    } catch (error) {
      logs.push({
        task: 'Remove alias',
        success: false,
        message: `Failed to remove alias ${source}`,
        detail: this.errorMessage(error),
      });
    }
    return logs;
  }

  async getDkimRecord(domain: string, selector: string): Promise<DkimResult | undefined> {
    const script = path.join(this.scriptsDir, 'show-dkim.sh');
    try {
      const { stdout } = await this.runScript(script, [domain, selector]);
      const record = stdout.trim();
      if (!record) {
        return undefined;
      }
      return {
        selector,
        publicRecord: record,
      };
    } catch (error) {
      this.logger.warn(`Unable to retrieve DKIM record for ${domain}`, error as Error);
      return undefined;
    }
  }

  async rotateDkim(domain: string, selector: string): Promise<{ logs: AutomationLog[]; result?: DkimResult }> {
    const logs: AutomationLog[] = [];
    const script = path.join(this.scriptsDir, 'rotate-dkim.sh');
    try {
      const { stdout, stderr } = await this.runScript(script, [domain, selector]);
      const record = stdout.trim();
      logs.push({
        task: 'Rotate DKIM',
        success: true,
        message: `Generated DKIM selector ${selector} for ${domain}`,
        detail: this.compact(stdout, stderr),
      });
      if (record) {
        return {
          logs,
          result: {
            selector,
            publicRecord: record,
          },
        };
      }
      return { logs };
    } catch (error) {
      logs.push({
        task: 'Rotate DKIM',
        success: false,
        message: `Failed to rotate DKIM for ${domain}`,
        detail: this.errorMessage(error),
      });
      return { logs };
    }
  }

  async configureDomainPolicy(domain: string, settings: DomainPolicySettings): Promise<AutomationLog[]> {
    const logs: AutomationLog[] = [];
    const script = path.join(this.scriptsDir, 'configure-spam-policy.sh');
    try {
      const args = [domain, JSON.stringify(settings)];
      const { stdout, stderr } = await this.runScript(script, args);
      logs.push({
        task: 'Configure domain policy',
        success: true,
        message: `Applied spam and virus policy for ${domain}`,
        detail: this.compact(stdout, stderr),
      });
    } catch (error) {
      logs.push({
        task: 'Configure domain policy',
        success: false,
        message: `Failed to configure policy for ${domain}`,
        detail: this.errorMessage(error),
      });
    }
    return logs;
  }

  // ---- TLS & Security Hardening (Phase 4) ----

  async setupMailTls(
    hostname: string,
    email: string,
    reuseExisting?: boolean,
  ): Promise<AutomationLog[]> {
    const logs: AutomationLog[] = [];
    const script = path.join(this.scriptsDir, 'setup-mail-tls.sh');
    const args = [hostname, email];
    if (reuseExisting) args.push('--reuse-existing');
    try {
      const { stdout, stderr } = await this.runScript(script, args);
      logs.push({
        task: 'Setup mail TLS',
        success: true,
        message: `TLS configured for ${hostname}`,
        detail: this.compact(stdout, stderr),
      });
    } catch (error) {
      logs.push({
        task: 'Setup mail TLS',
        success: false,
        message: `Failed to setup TLS for ${hostname}`,
        detail: this.errorMessage(error),
      });
    }
    return logs;
  }

  async setupPostscreen(dryRun?: boolean): Promise<AutomationLog[]> {
    const logs: AutomationLog[] = [];
    const script = path.join(this.scriptsDir, 'setup-postscreen.sh');
    const args = dryRun ? ['--dry-run'] : [];
    try {
      const { stdout, stderr } = await this.runScript(script, args);
      logs.push({
        task: 'Setup postscreen',
        success: true,
        message: 'Postscreen + reputation guards configured',
        detail: this.compact(stdout, stderr),
      });
    } catch (error) {
      logs.push({
        task: 'Setup postscreen',
        success: false,
        message: 'Failed to configure postscreen',
        detail: this.errorMessage(error),
      });
    }
    return logs;
  }

  async setupDmarc(
    domain: string,
    reportEmail?: string,
  ): Promise<AutomationLog[]> {
    const logs: AutomationLog[] = [];
    const script = path.join(this.scriptsDir, 'setup-dmarc.sh');
    const args = [domain];
    if (reportEmail) args.push(reportEmail);
    try {
      const { stdout, stderr } = await this.runScript(script, args);
      logs.push({
        task: 'Setup DMARC',
        success: true,
        message: `DMARC + ARC configured for ${domain}`,
        detail: this.compact(stdout, stderr),
      });
    } catch (error) {
      logs.push({
        task: 'Setup DMARC',
        success: false,
        message: `Failed to setup DMARC for ${domain}`,
        detail: this.errorMessage(error),
      });
    }
    return logs;
  }

  async hashPassword(password: string): Promise<string> {
    const script = path.join(this.scriptsDir, 'hash-password.sh');
    const { stdout } = await this.runScript(script, [password], { redactArgs: true });
    const hash = stdout.trim();
    if (!hash) {
      throw new Error('Password hash generation returned empty result');
    }
    return hash;
  }

  // ---- Queue Management ----

  async flushQueue(): Promise<AutomationLog[]> {
    const logs: AutomationLog[] = [];
    try {
      const { stdout, stderr } = await execAsync('postqueue -f');
      logs.push({
        task: 'Flush mail queue',
        success: true,
        message: 'Queue flush requested',
        detail: this.compact(stdout, stderr),
      });
    } catch (error) {
      logs.push({
        task: 'Flush mail queue',
        success: false,
        message: 'Failed to flush queue',
        detail: this.errorMessage(error),
      });
    }
    return logs;
  }

  async deleteQueueMessage(queueId: string): Promise<AutomationLog[]> {
    const logs: AutomationLog[] = [];
    if (!/^[0-9A-Fa-f]+$/.test(queueId)) {
      logs.push({
        task: 'Delete queue message',
        success: false,
        message: `Invalid queue ID: ${queueId}`,
      });
      return logs;
    }
    try {
      const { stdout, stderr } = await execAsync(`postsuper -d ${queueId}`);
      logs.push({
        task: 'Delete queue message',
        success: true,
        message: `Deleted message ${queueId}`,
        detail: this.compact(stdout, stderr),
      });
    } catch (error) {
      logs.push({
        task: 'Delete queue message',
        success: false,
        message: `Failed to delete message ${queueId}`,
        detail: this.errorMessage(error),
      });
    }
    return logs;
  }

  async deleteAllQueueMessages(): Promise<AutomationLog[]> {
    const logs: AutomationLog[] = [];
    try {
      const { stdout, stderr } = await execAsync('postsuper -d ALL');
      logs.push({
        task: 'Delete all queue messages',
        success: true,
        message: 'All queued messages deleted',
        detail: this.compact(stdout, stderr),
      });
    } catch (error) {
      logs.push({
        task: 'Delete all queue messages',
        success: false,
        message: 'Failed to purge mail queue',
        detail: this.errorMessage(error),
      });
    }
    return logs;
  }

  async retryQueueMessage(queueId: string): Promise<AutomationLog[]> {
    const logs: AutomationLog[] = [];
    if (!/^[0-9A-Fa-f]+$/.test(queueId)) {
      logs.push({
        task: 'Retry queue message',
        success: false,
        message: `Invalid queue ID: ${queueId}`,
      });
      return logs;
    }
    try {
      const { stdout, stderr } = await execAsync(`postqueue -i ${queueId}`);
      logs.push({
        task: 'Retry queue message',
        success: true,
        message: `Requeued message ${queueId}`,
        detail: this.compact(stdout, stderr),
      });
    } catch (error) {
      logs.push({
        task: 'Retry queue message',
        success: false,
        message: `Failed to retry message ${queueId}`,
        detail: this.errorMessage(error),
      });
    }
    return logs;
  }

  // ---- Mail Logs ----

  async getMailLogs(lines?: number, search?: string): Promise<{ lines: string[]; total: number }> {
    const logFile = '/var/log/mail.log';
    const limit = lines || 100;
    try {
      let command = `tail -${limit} ${logFile} 2>/dev/null`;
      if (search) {
        const safeSearch = search.replace(/[^a-zA-Z0-9@._\-]/g, '');
        if (safeSearch) {
          command += ` | grep -i '${safeSearch}'`;
        }
      }
      const { stdout } = await execAsync(command);
      const logLines = stdout.trim().split('\n').filter(Boolean);
      return { lines: logLines, total: logLines.length };
    } catch {
      return { lines: [], total: 0 };
    }
  }

  // ---- DNS Propagation Check ----

  async checkDnsPropagation(
    domain: string,
    records: { type: string; name: string; value: string }[],
  ): Promise<{ record: { type: string; name: string; expected: string }; actual: string[]; match: boolean }[]> {
    const results: { record: { type: string; name: string; expected: string }; actual: string[]; match: boolean }[] = [];

    for (const rec of records) {
      const fqdn = rec.name === '@' ? domain : `${rec.name}.${domain}`;
      let actual: string[] = [];
      let match = false;

      try {
        const recordType = rec.type.toUpperCase();
        const { stdout } = await execAsync(
          `dig +short ${recordType} ${fqdn} @8.8.8.8 2>/dev/null`,
          { timeout: 10000 },
        );
        actual = stdout.trim().split('\n').filter(Boolean).map(l => l.replace(/\.$/,'').replace(/^"|"$/g, ''));

        const normalizedExpected = rec.value.replace(/^"|"$/g, '').trim();

        if (recordType === 'MX') {
          match = actual.some(a => {
            const parts = a.split(/\s+/);
            return parts.length >= 2 && parts[1].replace(/\.$/, '') === normalizedExpected;
          });
        } else {
          match = actual.some(a => a === normalizedExpected || a.includes(normalizedExpected));
        }
      } catch { /* dig failed — not propagated */ }

      results.push({
        record: { type: rec.type, name: rec.name, expected: rec.value },
        actual,
        match,
      });
    }

    return results;
  }

  // ---- Mailbox Backup / Restore ----

  async backupMailbox(domain: string, email: string): Promise<{ path: string; sizeBytes: number; logs: AutomationLog[] }> {
    const logs: AutomationLog[] = [];
    const user = email.split('@')[0];
    const backupDir = `/var/backups/clearpanel/mail`;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = `${backupDir}/${domain}_${user}_${timestamp}.tar.gz`;

    try {
      await execAsync(`mkdir -p '${backupDir}'`);
      await execAsync(`tar -czf '${backupFile}' -C '/var/vmail/${domain}' '${user}' 2>/dev/null`);
      const { stdout } = await execAsync(`stat -c '%s' '${backupFile}' 2>/dev/null`);
      const sizeBytes = parseInt(stdout.trim(), 10) || 0;

      logs.push({
        task: 'Backup mailbox',
        success: true,
        message: `Backed up ${email} (${(sizeBytes / 1024 / 1024).toFixed(2)} MB)`,
      });

      return { path: backupFile, sizeBytes, logs };
    } catch (error) {
      logs.push({
        task: 'Backup mailbox',
        success: false,
        message: `Failed to backup ${email}`,
        detail: this.errorMessage(error),
      });
      return { path: '', sizeBytes: 0, logs };
    }
  }

  async restoreMailbox(domain: string, email: string, backupPath: string): Promise<AutomationLog[]> {
    const logs: AutomationLog[] = [];
    const user = email.split('@')[0];
    const targetDir = `/var/vmail/${domain}`;

    if (!backupPath.startsWith('/var/backups/clearpanel/mail/') || !backupPath.endsWith('.tar.gz')) {
      logs.push({
        task: 'Restore mailbox',
        success: false,
        message: 'Invalid backup path',
      });
      return logs;
    }

    try {
      await execAsync(`tar -xzf '${backupPath}' -C '${targetDir}' 2>/dev/null`);
      await execAsync(`chown -R vmail:vmail '${targetDir}/${user}' 2>/dev/null`);

      logs.push({
        task: 'Restore mailbox',
        success: true,
        message: `Restored ${email} from backup`,
      });
    } catch (error) {
      logs.push({
        task: 'Restore mailbox',
        success: false,
        message: `Failed to restore ${email}`,
        detail: this.errorMessage(error),
      });
    }
    return logs;
  }

  async listBackups(domain?: string): Promise<{ file: string; domain: string; email: string; timestamp: string; sizeBytes: number }[]> {
    const backupDir = '/var/backups/clearpanel/mail';
    try {
      const { stdout } = await execAsync(`ls -1 '${backupDir}' 2>/dev/null`);
      const files = stdout.trim().split('\n').filter(f => f.endsWith('.tar.gz'));
      const results: { file: string; domain: string; email: string; timestamp: string; sizeBytes: number }[] = [];

      for (const file of files) {
        const match = file.match(/^(.+?)_(.+?)_(\d{4}-\d{2}-\d{2}T.+)\.tar\.gz$/);
        if (!match) continue;

        const [, fileDomain, user, timestamp] = match;
        if (domain && fileDomain !== domain) continue;

        try {
          const { stdout: sizeOut } = await execAsync(`stat -c '%s' '${backupDir}/${file}' 2>/dev/null`);
          const sizeBytes = parseInt(sizeOut.trim(), 10) || 0;
          results.push({ file, domain: fileDomain, email: `${user}@${fileDomain}`, timestamp, sizeBytes });
        } catch {
          results.push({ file, domain: fileDomain, email: `${user}@${fileDomain}`, timestamp, sizeBytes: 0 });
        }
      }

      return results;
    } catch {
      return [];
    }
  }

  // ---- Per-User Rate Limiting ----

  async setupRateLimit(domain: string, email: string, limitPerHour: number): Promise<AutomationLog[]> {
    const logs: AutomationLog[] = [];
    const script = path.join(this.scriptsDir, 'setup-rate-limit.sh');
    try {
      const { stdout, stderr } = await this.runScript(script, [domain, email, String(limitPerHour)]);
      logs.push({
        task: 'Setup rate limit',
        success: true,
        message: `Rate limit set for ${email === '*' ? `@${domain}` : email}: ${limitPerHour}/hour`,
        detail: this.compact(stdout, stderr),
      });
    } catch (error) {
      logs.push({
        task: 'Setup rate limit',
        success: false,
        message: `Failed to set rate limit for ${email}`,
        detail: this.errorMessage(error),
      });
    }
    return logs;
  }

  async getRateLimits(domain: string): Promise<{ email: string; limit: number; updatedAt?: string }[]> {
    const stateDir = path.join(process.cwd(), '..', 'backend', 'mail-state', 'rate-limits');
    const filePath = path.join(stateDir, `${domain}.json`);
    try {
      const raw = await import('node:fs/promises').then(fs => fs.readFile(filePath, 'utf-8'));
      const data = JSON.parse(raw);
      return data.limits || [];
    } catch {
      return [];
    }
  }

  private async runScript(script: string, args: string[], options?: { redactArgs?: boolean }) {
    const quotedArgs = args.map((value) => `'${value.replace(/'/g, "'\\''")}'`);
    const command = ['bash', script, ...quotedArgs].join(' ');
    const safeCommand = options?.redactArgs ? `bash ${script} [REDACTED]` : command;
    this.logger.debug(`Executing: ${safeCommand}`);
    return execAsync(command, { env: process.env });
  }

  private compact(stdout: string, stderr: string): string | undefined {
    const output = [stdout?.trim(), stderr?.trim()].filter(Boolean).join('\n');
    return output.length ? output : undefined;
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}
