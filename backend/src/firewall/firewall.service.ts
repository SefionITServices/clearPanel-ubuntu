import { Injectable, Logger } from '@nestjs/common';
import { exec as execCb } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execCb);

// ─── Types ────────────────────────────────────────────────────────────

export interface FirewallRule {
  id: number;
  to: string;
  action: string;
  from: string;
  port?: string;
  protocol?: string;
  comment?: string;
  v6?: boolean;
}

export interface FirewallStatus {
  enabled: boolean;
  installed: boolean;
  defaultIncoming: string;
  defaultOutgoing: string;
  rules: FirewallRule[];
}

export interface Fail2BanJail {
  name: string;
  enabled: boolean;
  filter: string;
  currentlyBanned: number;
  totalBanned: number;
  currentlyFailed: number;
  totalFailed: number;
}

// ─── Service ──────────────────────────────────────────────────────────

@Injectable()
export class FirewallService {
  private readonly logger = new Logger(FirewallService.name);

  // ═══════════════════════════════════════════════════════════════════
  //  UFW STATUS
  // ═══════════════════════════════════════════════════════════════════

  async getStatus(): Promise<{ success: boolean; status: FirewallStatus; error?: string }> {
    const status: FirewallStatus = {
      enabled: false,
      installed: false,
      defaultIncoming: 'deny',
      defaultOutgoing: 'allow',
      rules: [],
    };

    try {
      // Check if ufw is installed
      try {
        await exec('which ufw', { timeout: 5000 });
        status.installed = true;
      } catch {
        return { success: true, status };
      }

      const { stdout } = await exec('ufw status verbose', { timeout: 10_000 });

      // Parse active/inactive
      if (stdout.includes('Status: active')) {
        status.enabled = true;
      }

      // Parse defaults
      const defaultMatch = stdout.match(/Default:\s+(\w+)\s+\(incoming\),\s+(\w+)\s+\(outgoing\)/);
      if (defaultMatch) {
        status.defaultIncoming = defaultMatch[1];
        status.defaultOutgoing = defaultMatch[2];
      }

      // Parse rules
      const rulesSection = stdout.split('--\n');
      if (rulesSection.length > 1) {
        const ruleLines = rulesSection[1].trim().split('\n').filter(l => l.trim());
        let id = 0;
        for (const line of ruleLines) {
          id++;
          const rule = this.parseUfwRule(id, line);
          if (rule) status.rules.push(rule);
        }
      }

      return { success: true, status };
    } catch (e: any) {
      this.logger.error(`Failed to get firewall status: ${e.message}`);
      return { success: false, status, error: e.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  ENABLE / DISABLE UFW
  // ═══════════════════════════════════════════════════════════════════

  async enable(): Promise<{ success: boolean; message: string }> {
    try {
      await exec('echo "y" | ufw enable', { timeout: 15_000 });
      return { success: true, message: 'Firewall enabled' };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  async disable(): Promise<{ success: boolean; message: string }> {
    try {
      await exec('ufw disable', { timeout: 15_000 });
      return { success: true, message: 'Firewall disabled' };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  INSTALL UFW
  // ═══════════════════════════════════════════════════════════════════

  async install(): Promise<{ success: boolean; message: string }> {
    try {
      await exec('apt-get update && apt-get install -y ufw', { timeout: 120_000 });
      // Set sane defaults
      await exec('ufw default deny incoming', { timeout: 10_000 });
      await exec('ufw default allow outgoing', { timeout: 10_000 });
      // Always allow SSH first so we don't lock out
      await exec('ufw allow 22/tcp comment "SSH"', { timeout: 10_000 });
      return { success: true, message: 'UFW installed with default rules (SSH allowed)' };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  ADD RULE
  // ═══════════════════════════════════════════════════════════════════

  async addRule(opts: {
    action: 'allow' | 'deny' | 'reject' | 'limit';
    port?: string;
    protocol?: 'tcp' | 'udp' | 'any';
    from?: string;
    to?: string;
    comment?: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const { action, port, protocol, from, to, comment } = opts;

      // Build command
      let cmd = `ufw ${action}`;

      if (from && from !== 'Anywhere') {
        cmd += ` from ${from}`;
      }

      if (to && to !== 'Anywhere') {
        cmd += ` to ${to}`;
      }

      if (port) {
        const proto = protocol && protocol !== 'any' ? protocol : '';
        if (port.includes(':') || port.includes(',')) {
          // Port range or multiple ports
          cmd += ` proto ${proto || 'tcp'} port ${port}`;
        } else {
          cmd += proto ? ` ${port}/${proto}` : ` ${port}`;
        }
      }

      if (comment) {
        cmd += ` comment "${comment.replace(/"/g, '\\"')}"`;
      }

      const { stdout, stderr } = await exec(cmd, { timeout: 15_000 });
      const output = (stdout + stderr).trim();

      if (output.includes('Rule added') || output.includes('Rules updated') || output.includes('Skipping')) {
        return { success: true, message: output };
      }
      return { success: true, message: output || 'Rule applied' };
    } catch (e: any) {
      return { success: false, message: e.stderr || e.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  DELETE RULE
  // ═══════════════════════════════════════════════════════════════════

  async deleteRule(ruleNumber: number): Promise<{ success: boolean; message: string }> {
    try {
      // Use --force to skip confirmation
      const { stdout } = await exec(`echo "y" | ufw delete ${ruleNumber}`, { timeout: 15_000 });
      return { success: true, message: stdout.trim() || 'Rule deleted' };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  SET DEFAULT POLICY
  // ═══════════════════════════════════════════════════════════════════

  async setDefault(direction: 'incoming' | 'outgoing', policy: 'allow' | 'deny' | 'reject'): Promise<{ success: boolean; message: string }> {
    try {
      const { stdout } = await exec(`ufw default ${policy} ${direction}`, { timeout: 10_000 });
      return { success: true, message: stdout.trim() || `Default ${direction} set to ${policy}` };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  RESET UFW
  // ═══════════════════════════════════════════════════════════════════

  async reset(): Promise<{ success: boolean; message: string }> {
    try {
      await exec('echo "y" | ufw reset', { timeout: 15_000 });
      return { success: true, message: 'Firewall reset to defaults' };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  COMMON PRESETS
  // ═══════════════════════════════════════════════════════════════════

  async applyPreset(preset: string): Promise<{ success: boolean; message: string }> {
    const presets: Record<string, string[]> = {
      'web-server': [
        'ufw allow 80/tcp comment "HTTP"',
        'ufw allow 443/tcp comment "HTTPS"',
      ],
      'mail-server': [
        'ufw allow 25/tcp comment "SMTP"',
        'ufw allow 587/tcp comment "SMTP Submission"',
        'ufw allow 993/tcp comment "IMAPS"',
        'ufw allow 465/tcp comment "SMTPS"',
        'ufw allow 143/tcp comment "IMAP"',
        'ufw allow 110/tcp comment "POP3"',
        'ufw allow 995/tcp comment "POP3S"',
      ],
      'dns-server': [
        'ufw allow 53/tcp comment "DNS TCP"',
        'ufw allow 53/udp comment "DNS UDP"',
      ],
      'database': [
        'ufw allow 3306/tcp comment "MySQL"',
        'ufw allow 5432/tcp comment "PostgreSQL"',
      ],
      'panel': [
        'ufw allow 22/tcp comment "SSH"',
        'ufw allow 80/tcp comment "HTTP"',
        'ufw allow 443/tcp comment "HTTPS"',
        'ufw allow 3334/tcp comment "ClearPanel"',
      ],
    };

    const commands = presets[preset];
    if (!commands) return { success: false, message: `Unknown preset: ${preset}` };

    try {
      const results: string[] = [];
      for (const cmd of commands) {
        try {
          const { stdout } = await exec(cmd, { timeout: 10_000 });
          results.push(stdout.trim());
        } catch (e: any) {
          results.push(`Error: ${e.message}`);
        }
      }
      return { success: true, message: `Preset "${preset}" applied:\n${results.join('\n')}` };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  FAIL2BAN
  // ═══════════════════════════════════════════════════════════════════

  async getFail2BanStatus(): Promise<{ success: boolean; installed: boolean; running: boolean; jails: Fail2BanJail[] }> {
    try {
      // Check installed
      try {
        await exec('which fail2ban-client', { timeout: 5000 });
      } catch {
        return { success: true, installed: false, running: false, jails: [] };
      }

      // Check running
      let running = false;
      try {
        const { stdout } = await exec('systemctl is-active fail2ban', { timeout: 5000 });
        running = stdout.trim() === 'active';
      } catch {}

      if (!running) {
        return { success: true, installed: true, running: false, jails: [] };
      }

      // Get jails
      const jails: Fail2BanJail[] = [];
      try {
        const { stdout } = await exec('fail2ban-client status', { timeout: 10_000 });
        const jailListMatch = stdout.match(/Jail list:\s+(.+)/);
        if (jailListMatch) {
          const jailNames = jailListMatch[1].split(',').map(j => j.trim()).filter(Boolean);
          for (const name of jailNames) {
            try {
              const { stdout: jailOut } = await exec(`fail2ban-client status ${name}`, { timeout: 10_000 });
              const getVal = (key: string): number => {
                const m = jailOut.match(new RegExp(`${key}:\\s+(\\d+)`));
                return m ? parseInt(m[1], 10) : 0;
              };
              const filterMatch = jailOut.match(/Filter:\s*\n[^]*?Currently failed:\s+(\d+)[^]*?Total failed:\s+(\d+)/);
              jails.push({
                name,
                enabled: true,
                filter: name,
                currentlyFailed: getVal('Currently failed'),
                totalFailed: getVal('Total failed'),
                currentlyBanned: getVal('Currently banned'),
                totalBanned: getVal('Total banned'),
              });
            } catch {}
          }
        }
      } catch {}

      return { success: true, installed: true, running, jails };
    } catch (e: any) {
      this.logger.error(`Failed to get Fail2Ban status: ${e.message}`);
      return { success: false, installed: false, running: false, jails: [] };
    }
  }

  // ─── Parse UFW rule line ──────────────────────────────────────────

  private parseUfwRule(id: number, line: string): FirewallRule | null {
    // Example lines:
    // 22/tcp                     ALLOW       Anywhere
    // 80,443/tcp                 ALLOW       Anywhere                   # Web Server
    // Anywhere                   DENY        203.0.113.0/24
    const trimmed = line.trim();
    if (!trimmed) return null;

    // Extract comment
    let comment: string | undefined;
    const commentIdx = trimmed.indexOf('#');
    let ruleStr = trimmed;
    if (commentIdx > 0) {
      comment = trimmed.slice(commentIdx + 1).trim();
      ruleStr = trimmed.slice(0, commentIdx).trim();
    }

    // Split into columns (at least 3: TO, ACTION, FROM)
    const parts = ruleStr.split(/\s{2,}/);
    if (parts.length < 3) return null;

    const to = parts[0].trim();
    const action = parts[1].trim();
    const from = parts[2].trim();
    const v6 = to.includes('(v6)') || from.includes('(v6)');

    // Parse port/protocol from "to" field
    let port: string | undefined;
    let protocol: string | undefined;
    const portMatch = to.match(/^(\S+?)(?:\/(tcp|udp))?(?:\s+\(v6\))?$/);
    if (portMatch && /^\d/.test(portMatch[1])) {
      port = portMatch[1];
      protocol = portMatch[2];
    }

    return { id, to, action, from, port, protocol, comment, v6 };
  }
}
