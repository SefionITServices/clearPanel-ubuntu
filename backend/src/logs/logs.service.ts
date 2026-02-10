import { Injectable } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';

const execAsync = promisify(exec);
const MAX_LINES = 500;
const EXEC_TIMEOUT = 15_000;

/** Predefined log sources — no arbitrary user input touches the shell. */
const LOG_SOURCES: Record<
  string,
  { label: string; cmd: (lines: number) => string; category: string }
> = {
  // ── System ──
  syslog: {
    label: 'System Log',
    cmd: (n) => `journalctl --no-pager -n ${n} --output=short-iso`,
    category: 'System',
  },
  kernel: {
    label: 'Kernel (dmesg)',
    cmd: (n) => `dmesg --time-format iso | tail -n ${n}`,
    category: 'System',
  },
  auth: {
    label: 'Auth / SSH',
    cmd: (n) => `journalctl -u ssh --no-pager -n ${n} --output=short-iso 2>/dev/null || tail -n ${n} /var/log/auth.log`,
    category: 'System',
  },

  // ── ClearPanel ──
  clearpanel: {
    label: 'ClearPanel Service',
    cmd: (n) => `journalctl -u clearpanel --no-pager -n ${n} --output=short-iso`,
    category: 'ClearPanel',
  },

  // ── Web ──
  'nginx-access': {
    label: 'Nginx Access',
    cmd: (n) => `tail -n ${n} /var/log/nginx/access.log 2>/dev/null || echo "(no log file)"`,
    category: 'Web',
  },
  'nginx-error': {
    label: 'Nginx Error',
    cmd: (n) => `tail -n ${n} /var/log/nginx/error.log 2>/dev/null || echo "(no log file)"`,
    category: 'Web',
  },
  'php-fpm': {
    label: 'PHP-FPM',
    cmd: (n) =>
      `for f in /var/log/php*-fpm.log; do [ -f "$f" ] && tail -n ${n} "$f" && break; done 2>/dev/null || journalctl -u "php*-fpm" --no-pager -n ${n} --output=short-iso 2>/dev/null || echo "(no PHP-FPM log)"`,
    category: 'Web',
  },

  // ── Mail ──
  'mail': {
    label: 'Mail (all)',
    cmd: (n) => `tail -n ${n} /var/log/mail.log 2>/dev/null || journalctl -u postfix -u dovecot --no-pager -n ${n} --output=short-iso`,
    category: 'Mail',
  },
  postfix: {
    label: 'Postfix',
    cmd: (n) => `journalctl -u postfix --no-pager -n ${n} --output=short-iso 2>/dev/null || grep -i postfix /var/log/mail.log | tail -n ${n}`,
    category: 'Mail',
  },
  dovecot: {
    label: 'Dovecot',
    cmd: (n) => `journalctl -u dovecot --no-pager -n ${n} --output=short-iso 2>/dev/null || grep -i dovecot /var/log/mail.log | tail -n ${n}`,
    category: 'Mail',
  },
  rspamd: {
    label: 'Rspamd',
    cmd: (n) => `journalctl -u rspamd --no-pager -n ${n} --output=short-iso`,
    category: 'Mail',
  },
  clamav: {
    label: 'ClamAV',
    cmd: (n) => `journalctl -u clamav-daemon --no-pager -n ${n} --output=short-iso`,
    category: 'Mail',
  },
  opendkim: {
    label: 'OpenDKIM',
    cmd: (n) => `journalctl -u opendkim --no-pager -n ${n} --output=short-iso`,
    category: 'Mail',
  },

  // ── DNS ──
  bind9: {
    label: 'BIND9 DNS',
    cmd: (n) => `journalctl -u bind9 -u named --no-pager -n ${n} --output=short-iso`,
    category: 'DNS',
  },

  // ── Database ──
  mysql: {
    label: 'MySQL / MariaDB',
    cmd: (n) => `journalctl -u mysql -u mariadb --no-pager -n ${n} --output=short-iso`,
    category: 'Database',
  },

  // ── Firewall ──
  ufw: {
    label: 'UFW Firewall',
    cmd: (n) => `journalctl -k --no-pager -n ${n} --output=short-iso | grep -i "UFW" || echo "(no UFW entries)"`,
    category: 'System',
  },
};

export interface LogSource {
  id: string;
  label: string;
  category: string;
}

export interface LogResult {
  source: string;
  label: string;
  lines: string[];
  truncated: boolean;
  timestamp: string;
}

@Injectable()
export class LogsService {
  /** Return available log sources (only those whose service exists). */
  async getSources(): Promise<LogSource[]> {
    return Object.entries(LOG_SOURCES).map(([id, s]) => ({
      id,
      label: s.label,
      category: s.category,
    }));
  }

  /** Fetch log lines for a given source. */
  async getLog(sourceId: string, lines = 100): Promise<LogResult> {
    const source = LOG_SOURCES[sourceId];
    if (!source) {
      throw new Error(`Unknown log source: ${sourceId}`);
    }

    const n = Math.min(Math.max(lines, 1), MAX_LINES);

    try {
      const { stdout, stderr } = await execAsync(source.cmd(n), {
        timeout: EXEC_TIMEOUT,
        maxBuffer: 5 * 1024 * 1024,
        env: { ...process.env, LANG: 'C.UTF-8' },
      });

      const output = (stdout || stderr || '').trim();
      const allLines = output ? output.split('\n') : [];

      return {
        source: sourceId,
        label: source.label,
        lines: allLines.slice(-n),
        truncated: allLines.length > n,
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      // Command may exit non-zero but still have useful output
      const output = (err.stdout || err.stderr || err.message || '').trim();
      return {
        source: sourceId,
        label: source.label,
        lines: output ? output.split('\n').slice(-n) : [`(Error: ${err.message})`],
        truncated: false,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
