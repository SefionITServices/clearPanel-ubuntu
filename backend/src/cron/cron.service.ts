import { Injectable, Logger } from '@nestjs/common';
import { exec as execCb } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execCb);

// ─── Types ────────────────────────────────────────────────────────────

export interface CronJob {
  id: number;
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
  command: string;
  schedule: string;     // full schedule expression
  description: string;  // human-readable
  enabled: boolean;
}

interface CronLine {
  raw: string;
  isComment: boolean;
  isDisabled: boolean;  // starts with #
  isEnv: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────

const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const COMMON_SCHEDULES: Record<string, string> = {
  '* * * * *': 'Every minute',
  '*/5 * * * *': 'Every 5 minutes',
  '*/15 * * * *': 'Every 15 minutes',
  '*/30 * * * *': 'Every 30 minutes',
  '0 * * * *': 'Every hour',
  '0 */2 * * *': 'Every 2 hours',
  '0 */6 * * *': 'Every 6 hours',
  '0 */12 * * *': 'Every 12 hours',
  '0 0 * * *': 'Daily at midnight',
  '0 0 * * 0': 'Weekly on Sunday',
  '0 0 1 * *': 'Monthly on the 1st',
  '0 0 1 1 *': 'Yearly on Jan 1',
  '@reboot': 'On reboot',
  '@hourly': 'Every hour',
  '@daily': 'Daily at midnight',
  '@weekly': 'Weekly on Sunday',
  '@monthly': 'Monthly on the 1st',
  '@yearly': 'Yearly on Jan 1',
  '@annually': 'Yearly on Jan 1',
};

function describeSchedule(min: string, hour: string, dom: string, month: string, dow: string): string {
  const sched = `${min} ${hour} ${dom} ${month} ${dow}`;
  if (COMMON_SCHEDULES[sched]) return COMMON_SCHEDULES[sched];

  const parts: string[] = [];

  // Minute
  if (min === '*') parts.push('every minute');
  else if (min.startsWith('*/')) parts.push(`every ${min.slice(2)} minutes`);
  else parts.push(`at minute ${min}`);

  // Hour
  if (hour === '*') { /* already implied */ }
  else if (hour.startsWith('*/')) parts.push(`every ${hour.slice(2)} hours`);
  else parts.push(`at ${hour}:00`);

  // Day of month
  if (dom !== '*') parts.push(`on day ${dom}`);

  // Month
  if (month !== '*') {
    const num = parseInt(month, 10);
    parts.push(`in ${(num >= 1 && num <= 12) ? MONTH_NAMES[num] : month}`);
  }

  // Day of week
  if (dow !== '*') {
    const num = parseInt(dow, 10);
    parts.push(`on ${(num >= 0 && num <= 6) ? DAY_NAMES[num] : dow}`);
  }

  return parts.join(', ');
}

// ─── Service ──────────────────────────────────────────────────────────

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  // ═══════════════════════════════════════════════════════════════════
  //  LIST CRON JOBS
  // ═══════════════════════════════════════════════════════════════════

  async listJobs(user?: string): Promise<{ success: boolean; jobs: CronJob[]; raw: string; error?: string }> {
    try {
      const cmd = user ? `crontab -u "${user}" -l` : 'crontab -l';
      let stdout = '';
      try {
        const result = await exec(cmd, { timeout: 10_000 });
        stdout = result.stdout;
      } catch (e: any) {
        // "no crontab for user" is normal
        if (e.stderr?.includes('no crontab')) {
          return { success: true, jobs: [], raw: '' };
        }
        throw e;
      }

      const jobs: CronJob[] = [];
      const lines = stdout.split('\n');
      let id = 0;

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        // Skip environment variables (KEY=value)
        if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(line) && !line.startsWith('#')) continue;

        // Check if disabled (commented out cron line)
        let workLine = line;
        let enabled = true;
        if (line.startsWith('#')) {
          // Could be a pure comment or a disabled cron
          const uncommented = line.replace(/^#+\s*/, '');
          if (/^[@*0-9]/.test(uncommented) || /^\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+/.test(uncommented)) {
            workLine = uncommented;
            enabled = false;
          } else {
            continue; // Pure comment
          }
        }

        // Parse special schedules (@reboot, @daily, etc.)
        const specialMatch = workLine.match(/^(@(?:reboot|hourly|daily|weekly|monthly|yearly|annually))\s+(.+)$/);
        if (specialMatch) {
          id++;
          const schedule = specialMatch[1];
          jobs.push({
            id,
            minute: '', hour: '', dayOfMonth: '', month: '', dayOfWeek: '',
            command: specialMatch[2],
            schedule,
            description: COMMON_SCHEDULES[schedule] || schedule,
            enabled,
          });
          continue;
        }

        // Parse standard 5-field cron
        const cronMatch = workLine.match(/^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.+)$/);
        if (cronMatch) {
          id++;
          const [, minute, hour, dayOfMonth, month, dayOfWeek, command] = cronMatch;
          jobs.push({
            id,
            minute, hour, dayOfMonth, month, dayOfWeek,
            command,
            schedule: `${minute} ${hour} ${dayOfMonth} ${month} ${dayOfWeek}`,
            description: describeSchedule(minute, hour, dayOfMonth, month, dayOfWeek),
            enabled,
          });
        }
      }

      return { success: true, jobs, raw: stdout };
    } catch (e: any) {
      this.logger.error(`Failed to list cron jobs: ${e.message}`);
      return { success: false, jobs: [], raw: '', error: e.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  ADD CRON JOB
  // ═══════════════════════════════════════════════════════════════════

  async addJob(
    schedule: string,
    command: string,
    user?: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      if (!command?.trim()) return { success: false, message: 'Command is required' };
      if (!schedule?.trim()) return { success: false, message: 'Schedule is required' };

      // Validate schedule
      const parts = schedule.trim().split(/\s+/);
      const isSpecial = /^@(reboot|hourly|daily|weekly|monthly|yearly|annually)$/.test(schedule.trim());
      if (!isSpecial && parts.length !== 5) {
        return { success: false, message: 'Schedule must be 5 fields (min hour dom month dow) or a special keyword (@daily, etc.)' };
      }

      const cronLine = `${schedule.trim()} ${command.trim()}`;
      const existing = await this.getRawCrontab(user);
      const newCrontab = existing ? `${existing.trimEnd()}\n${cronLine}\n` : `${cronLine}\n`;

      await this.writeCrontab(newCrontab, user);
      return { success: true, message: 'Cron job added' };
    } catch (e: any) {
      this.logger.error(`Failed to add cron job: ${e.message}`);
      return { success: false, message: e.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  UPDATE CRON JOB
  // ═══════════════════════════════════════════════════════════════════

  async updateJob(
    jobId: number,
    schedule: string,
    command: string,
    user?: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      if (!command?.trim()) return { success: false, message: 'Command is required' };
      if (!schedule?.trim()) return { success: false, message: 'Schedule is required' };

      const raw = await this.getRawCrontab(user);
      const lines = raw.split('\n');
      const cronLine = `${schedule.trim()} ${command.trim()}`;

      let currentId = 0;
      let found = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(line) && !line.startsWith('#')) continue;

        let workLine = line;
        if (line.startsWith('#')) {
          const uncommented = line.replace(/^#+\s*/, '');
          if (/^[@*0-9]/.test(uncommented) || /^\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+/.test(uncommented)) {
            workLine = uncommented;
          } else {
            continue;
          }
        }

        const isSpecial = /^@(?:reboot|hourly|daily|weekly|monthly|yearly|annually)\s+/.test(workLine);
        const isStandard = /^\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+/.test(workLine);

        if (isSpecial || isStandard) {
          currentId++;
          if (currentId === jobId) {
            lines[i] = cronLine;
            found = true;
            break;
          }
        }
      }

      if (!found) return { success: false, message: `Cron job #${jobId} not found` };

      await this.writeCrontab(lines.join('\n') + '\n', user);
      return { success: true, message: 'Cron job updated' };
    } catch (e: any) {
      this.logger.error(`Failed to update cron job: ${e.message}`);
      return { success: false, message: e.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  DELETE CRON JOB
  // ═══════════════════════════════════════════════════════════════════

  async deleteJob(jobId: number, user?: string): Promise<{ success: boolean; message: string }> {
    try {
      const raw = await this.getRawCrontab(user);
      const lines = raw.split('\n');

      let currentId = 0;
      let found = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(line) && !line.startsWith('#')) continue;

        let workLine = line;
        if (line.startsWith('#')) {
          const uncommented = line.replace(/^#+\s*/, '');
          if (/^[@*0-9]/.test(uncommented) || /^\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+/.test(uncommented)) {
            workLine = uncommented;
          } else {
            continue;
          }
        }

        const isSpecial = /^@(?:reboot|hourly|daily|weekly|monthly|yearly|annually)\s+/.test(workLine);
        const isStandard = /^\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+/.test(workLine);

        if (isSpecial || isStandard) {
          currentId++;
          if (currentId === jobId) {
            lines.splice(i, 1);
            found = true;
            break;
          }
        }
      }

      if (!found) return { success: false, message: `Cron job #${jobId} not found` };

      await this.writeCrontab(lines.join('\n') + '\n', user);
      return { success: true, message: 'Cron job deleted' };
    } catch (e: any) {
      this.logger.error(`Failed to delete cron job: ${e.message}`);
      return { success: false, message: e.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  TOGGLE ENABLE/DISABLE
  // ═══════════════════════════════════════════════════════════════════

  async toggleJob(jobId: number, enable: boolean, user?: string): Promise<{ success: boolean; message: string }> {
    try {
      const raw = await this.getRawCrontab(user);
      const lines = raw.split('\n');

      let currentId = 0;
      let found = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(line) && !line.startsWith('#')) continue;

        let workLine = line;
        let isDisabled = false;
        if (line.startsWith('#')) {
          const uncommented = line.replace(/^#+\s*/, '');
          if (/^[@*0-9]/.test(uncommented) || /^\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+/.test(uncommented)) {
            workLine = uncommented;
            isDisabled = true;
          } else {
            continue;
          }
        }

        const isSpecial = /^@(?:reboot|hourly|daily|weekly|monthly|yearly|annually)\s+/.test(workLine);
        const isStandard = /^\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+/.test(workLine);

        if (isSpecial || isStandard) {
          currentId++;
          if (currentId === jobId) {
            if (enable && isDisabled) {
              lines[i] = workLine;
            } else if (!enable && !isDisabled) {
              lines[i] = `# ${line}`;
            }
            found = true;
            break;
          }
        }
      }

      if (!found) return { success: false, message: `Cron job #${jobId} not found` };

      await this.writeCrontab(lines.join('\n') + '\n', user);
      return { success: true, message: enable ? 'Cron job enabled' : 'Cron job disabled' };
    } catch (e: any) {
      this.logger.error(`Failed to toggle cron job: ${e.message}`);
      return { success: false, message: e.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  RAW CRONTAB
  // ═══════════════════════════════════════════════════════════════════

  async getRawCrontab(user?: string): Promise<string> {
    try {
      const cmd = user ? `crontab -u "${user}" -l` : 'crontab -l';
      const { stdout } = await exec(cmd, { timeout: 10_000 });
      return stdout;
    } catch (e: any) {
      if (e.stderr?.includes('no crontab')) return '';
      throw e;
    }
  }

  async saveRawCrontab(content: string, user?: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.writeCrontab(content, user);
      return { success: true, message: 'Crontab saved' };
    } catch (e: any) {
      this.logger.error(`Failed to save crontab: ${e.message}`);
      return { success: false, message: e.message };
    }
  }

  // ─── Internal ─────────────────────────────────────────────────────

  private async writeCrontab(content: string, user?: string): Promise<void> {
    // Use process substitution via echo + pipe
    const escaped = content.replace(/'/g, "'\\''");
    const cmd = user
      ? `echo '${escaped}' | crontab -u "${user}" -`
      : `echo '${escaped}' | crontab -`;
    await exec(cmd, { timeout: 10_000 });
  }
}
