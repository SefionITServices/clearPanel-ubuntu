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

  async hashPassword(password: string): Promise<string> {
    const script = path.join(this.scriptsDir, 'hash-password.sh');
    const { stdout } = await this.runScript(script, [password], { redactArgs: true });
    const hash = stdout.trim();
    if (!hash) {
      throw new Error('Password hash generation returned empty result');
    }
    return hash;
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
