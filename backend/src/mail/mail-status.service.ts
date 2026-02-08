import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

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

export interface MailHealthSnapshot {
  timestamp: string;
  services: MailServiceStatus[];
  queue: MailQueueStatus;
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
}
