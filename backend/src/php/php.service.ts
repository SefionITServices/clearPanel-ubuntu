import { Injectable, Logger } from '@nestjs/common';
import { exec as execCb } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const exec = promisify(execCb);

// ─── Types ────────────────────────────────────────────────────────────

export interface PhpVersion {
  version: string;        // e.g. "8.3"
  installed: boolean;
  active: boolean;        // is the default CLI version
  fpmRunning: boolean;
  fpmEnabled: boolean;
  fpmSocketPath: string;  // e.g. /var/run/php/php8.3-fpm.sock
}

export interface PhpExtension {
  name: string;
  enabled: boolean;
  version?: string;
}

export interface PhpIniDirective {
  key: string;
  value: string;
  file: string;           // which ini file it comes from
}

export interface PhpIniConfig {
  version: string;
  directives: Record<string, string>;
  iniPath: string;
}

export interface PhpFpmPool {
  name: string;
  user: string;
  group: string;
  listenSocket: string;
  pm: string;              // static | dynamic | ondemand
  pmMaxChildren: number;
  pmStartServers?: number;
  pmMinSpareServers?: number;
  pmMaxSpareServers?: number;
}

export interface PhpLogEntry {
  timestamp: string;
  level: string;
  message: string;
}

// Known PHP versions available through the Ondřej PPA
const KNOWN_VERSIONS = ['7.4', '8.0', '8.1', '8.2', '8.3', '8.4'];

// Important php.ini directives users commonly edit
const COMMON_DIRECTIVES = [
  'upload_max_filesize',
  'post_max_size',
  'memory_limit',
  'max_execution_time',
  'max_input_time',
  'max_input_vars',
  'display_errors',
  'error_reporting',
  'date.timezone',
  'file_uploads',
  'allow_url_fopen',
  'session.gc_maxlifetime',
  'opcache.enable',
  'opcache.memory_consumption',
];

@Injectable()
export class PhpService {
  private readonly logger = new Logger(PhpService.name);

  // ─── Helpers ──────────────────────────────────────────────────────

  private async sudo(cmd: string, timeout = 60_000): Promise<string> {
    const { stdout } = await exec(`sudo ${cmd}`, { timeout });
    return stdout.trim();
  }

  private async run(cmd: string, timeout = 30_000): Promise<string> {
    try {
      const { stdout } = await exec(cmd, { timeout });
      return stdout.trim();
    } catch {
      try {
        const { stdout } = await exec(`sudo ${cmd}`, { timeout });
        return stdout.trim();
      } catch {
        return '';
      }
    }
  }

  private async which(bin: string): Promise<boolean> {
    try { await exec(`which ${bin}`); return true; } catch { return false; }
  }

  private async serviceActive(svc: string): Promise<boolean> {
    try {
      const out = await this.sudo(`systemctl is-active ${svc} 2>/dev/null`);
      return out === 'active';
    } catch { return false; }
  }

  private async serviceEnabled(svc: string): Promise<boolean> {
    try {
      const out = await this.sudo(`systemctl is-enabled ${svc} 2>/dev/null`);
      return out === 'enabled';
    } catch { return false; }
  }

  private async fileExists(p: string): Promise<boolean> {
    try { await fs.access(p); return true; } catch { return false; }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  1. PHP VERSION MANAGER
  // ═══════════════════════════════════════════════════════════════════

  /** List all known PHP versions and their install/FPM status */
  async listVersions(): Promise<PhpVersion[]> {
    // Find the default CLI PHP version
    let defaultVersion = '';
    try {
      const out = await this.run('php -v 2>/dev/null | head -1');
      const m = out.match(/PHP (\d+\.\d+)/);
      if (m) defaultVersion = m[1];
    } catch {}

    const results: PhpVersion[] = [];
    for (const ver of KNOWN_VERSIONS) {
      try {
        const installed = await this.which(`php${ver}`);
        const fpmService = `php${ver}-fpm`;
        let fpmRunning = false;
        let fpmEnabled = false;
        if (installed) {
          try { fpmRunning = await this.serviceActive(fpmService); } catch {}
          try { fpmEnabled = await this.serviceEnabled(fpmService); } catch {}
        }
        const fpmSocketPath = `/var/run/php/php${ver}-fpm.sock`;

        results.push({
          version: ver,
          installed,
          active: ver === defaultVersion,
          fpmRunning,
          fpmEnabled,
          fpmSocketPath,
        });
      } catch (e) {
        // Even if check fails, still include the version as not-installed
        this.logger.warn(`Error checking PHP ${ver}: ${e}`);
        results.push({
          version: ver,
          installed: false,
          active: false,
          fpmRunning: false,
          fpmEnabled: false,
          fpmSocketPath: `/var/run/php/php${ver}-fpm.sock`,
        });
      }
    }
    return results;
  }

  /** Get the default (active) PHP CLI version */
  async getDefaultVersion(): Promise<string> {
    try {
      const out = await this.run('php -v 2>/dev/null | head -1');
      const m = out.match(/PHP (\d+\.\d+)/);
      return m ? m[1] : '';
    } catch { return ''; }
  }

  /** Ensure the Ondřej PPA is added (required for multiple PHP versions) */
  async ensurePpa(): Promise<void> {
    try {
      const out = await this.sudo('apt-cache policy php8.3 2>/dev/null | head -3');
      if (out.includes('ppa.launchpadcontent.net/ondrej') || out.includes('packages.sury.org')) return;
    } catch {}
    // Add PPA
    this.logger.log('Adding ondrej/php PPA...');
    await this.sudo('env DEBIAN_FRONTEND=noninteractive apt-get install -y software-properties-common', 60_000);
    await this.sudo('add-apt-repository -y ppa:ondrej/php', 60_000);
    await this.sudo('apt-get update -qq', 60_000);
  }

  /** Install a PHP version with FPM + common extensions */
  async installVersion(version: string): Promise<{ success: boolean; message: string; logs?: string }> {
    if (!KNOWN_VERSIONS.includes(version)) {
      return { success: false, message: `Unknown PHP version: ${version}. Supported: ${KNOWN_VERSIONS.join(', ')}` };
    }
    try {
      await this.ensurePpa();
      const pkgs = [
        `php${version}-fpm`,
        `php${version}-cli`,
        `php${version}-common`,
        `php${version}-mysql`,
        `php${version}-pgsql`,
        `php${version}-sqlite3`,
        `php${version}-curl`,
        `php${version}-gd`,
        `php${version}-mbstring`,
        `php${version}-xml`,
        `php${version}-zip`,
        `php${version}-bcmath`,
        `php${version}-intl`,
        `php${version}-readline`,
        `php${version}-opcache`,
      ].join(' ');
      const logs = await this.sudo(
        `env DEBIAN_FRONTEND=noninteractive apt-get install -y ${pkgs}`,
        180_000,
      );
      // Enable and start FPM
      await this.sudo(`systemctl enable php${version}-fpm`);
      await this.sudo(`systemctl start php${version}-fpm`);
      return { success: true, message: `PHP ${version} installed successfully`, logs };
    } catch (e: any) {
      this.logger.error(`PHP ${version} install failed: ${e.message}`);
      return { success: false, message: e.message };
    }
  }

  /** Uninstall a PHP version */
  async uninstallVersion(version: string): Promise<{ success: boolean; message: string }> {
    if (!KNOWN_VERSIONS.includes(version)) {
      return { success: false, message: `Unknown PHP version: ${version}` };
    }
    try {
      await this.sudo(`systemctl stop php${version}-fpm 2>/dev/null || true`);
      await this.sudo(
        `env DEBIAN_FRONTEND=noninteractive apt-get purge -y 'php${version}-*'`,
        120_000,
      );
      await this.sudo('apt-get autoremove -y', 60_000);
      return { success: true, message: `PHP ${version} uninstalled` };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  /** Set the default CLI PHP version using update-alternatives */
  async setDefaultVersion(version: string): Promise<{ success: boolean; message: string }> {
    if (!KNOWN_VERSIONS.includes(version)) {
      return { success: false, message: `Unknown PHP version: ${version}` };
    }
    const phpBin = `/usr/bin/php${version}`;
    if (!(await this.fileExists(phpBin))) {
      return { success: false, message: `PHP ${version} is not installed` };
    }
    try {
      await this.sudo(`update-alternatives --set php ${phpBin}`);
      // Also update php-config and phpize if available
      try { await this.sudo(`update-alternatives --set php-config /usr/bin/php-config${version}`); } catch {}
      try { await this.sudo(`update-alternatives --set phpize /usr/bin/phpize${version}`); } catch {}
      return { success: true, message: `Default PHP version set to ${version}` };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  /** Start/stop/restart PHP-FPM for a version */
  async controlFpm(version: string, action: 'start' | 'stop' | 'restart' | 'enable' | 'disable'): Promise<{ success: boolean; message: string }> {
    const svc = `php${version}-fpm`;
    try {
      await this.sudo(`systemctl ${action} ${svc}`);
      return { success: true, message: `php${version}-fpm ${action} successful` };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  2. PHP CONFIGURATION EDITOR
  // ═══════════════════════════════════════════════════════════════════

  /** Get common php.ini values for a version + SAPI (cli or fpm) */
  async getConfig(version: string, sapi: 'cli' | 'fpm' = 'fpm'): Promise<PhpIniConfig> {
    const iniPath = `/etc/php/${version}/${sapi}/php.ini`;
    const directives: Record<string, string> = {};

    try {
      const content = await this.sudo(`cat ${iniPath}`);
      for (const key of COMMON_DIRECTIVES) {
        // Match: key = value (ignoring commented lines)
        const regex = new RegExp(`^\\s*${key.replace('.', '\\.')}\\s*=\\s*(.+)`, 'm');
        const m = content.match(regex);
        directives[key] = m ? m[1].trim() : '';
      }
    } catch {
      // file doesn't exist or can't read
    }

    return { version, directives, iniPath };
  }

  /** Update php.ini directives for a version + SAPI */
  async setConfig(
    version: string,
    sapi: 'cli' | 'fpm' = 'fpm',
    changes: Record<string, string>,
  ): Promise<{ success: boolean; message: string; restarted: boolean }> {
    const iniPath = `/etc/php/${version}/${sapi}/php.ini`;
    try {
      for (const [key, value] of Object.entries(changes)) {
        const escapedKey = key.replace('.', '\\.');
        // Try in-place sed: uncomment + set, or append if not found
        // First try: replace an existing (possibly commented) line
        await this.sudo(
          `sed -i 's/^;*\\s*${escapedKey}\\s*=.*/${key} = ${value}/' ${iniPath}`,
        );
        // Check if it was actually set
        const check = await this.sudo(`grep -c '^${escapedKey}\\s*=' ${iniPath} 2>/dev/null || echo 0`);
        if (check.trim() === '0') {
          // Append it
          await this.sudo(`echo '${key} = ${value}' >> ${iniPath}`);
        }
      }

      // Restart FPM if editing fpm config
      let restarted = false;
      if (sapi === 'fpm') {
        try {
          await this.sudo(`systemctl restart php${version}-fpm`);
          restarted = true;
        } catch {}
      }

      return { success: true, message: `php.ini updated for PHP ${version} (${sapi})`, restarted };
    } catch (e: any) {
      return { success: false, message: e.message, restarted: false };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  3. PHP EXTENSIONS MANAGER
  // ═══════════════════════════════════════════════════════════════════

  /** List installed/available extensions for a version */
  async listExtensions(version: string): Promise<PhpExtension[]> {
    const extensions: PhpExtension[] = [];

    try {
      // Get all installed modules
      const enabledRaw = await this.run(`php${version} -m 2>/dev/null`);
      const enabledModules = new Set(
        enabledRaw
          .split('\n')
          .map((l) => l.trim().toLowerCase())
          .filter((l) => l && !l.startsWith('[')),
      );

      // Get all available packages for this version
      const availableRaw = await this.sudo(
        `apt-cache search 'php${version}-' 2>/dev/null | awk '{print $1}' | sort`,
      );
      const seen = new Set<string>();

      for (const pkg of availableRaw.split('\n').filter(Boolean)) {
        // Extract extension name from package: php8.3-curl → curl
        const m = pkg.match(new RegExp(`^php${version.replace('.', '\\.')}-(.+)$`));
        if (!m) continue;
        const extName = m[1];
        if (seen.has(extName)) continue;
        seen.add(extName);
        // Skip meta/non-extension packages
        if (['fpm', 'cli', 'common', 'dev', 'phpdbg', 'cgi'].includes(extName)) continue;

        extensions.push({
          name: extName,
          enabled: enabledModules.has(extName),
        });
      }
    } catch (e: any) {
      this.logger.error(`Failed to list extensions: ${e.message}`);
    }

    return extensions;
  }

  /** Install/enable a PHP extension */
  async installExtension(version: string, ext: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.sudo(
        `env DEBIAN_FRONTEND=noninteractive apt-get install -y php${version}-${ext}`,
        120_000,
      );
      // Restart FPM so it picks up the new extension
      try { await this.sudo(`systemctl restart php${version}-fpm`); } catch {}
      return { success: true, message: `php${version}-${ext} installed` };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  /** Uninstall/remove a PHP extension */
  async removeExtension(version: string, ext: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.sudo(
        `env DEBIAN_FRONTEND=noninteractive apt-get purge -y php${version}-${ext}`,
        60_000,
      );
      try { await this.sudo(`systemctl restart php${version}-fpm`); } catch {}
      return { success: true, message: `php${version}-${ext} removed` };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  4. PHP-FPM POOL MANAGER
  // ═══════════════════════════════════════════════════════════════════

  /** List FPM pools for a version */
  async listPools(version: string): Promise<PhpFpmPool[]> {
    const poolDir = `/etc/php/${version}/fpm/pool.d`;
    const pools: PhpFpmPool[] = [];

    try {
      const files = await this.sudo(`ls ${poolDir}/*.conf 2>/dev/null`);
      for (const file of files.split('\n').filter(Boolean)) {
        try {
          const content = await this.sudo(`cat ${file}`);
          const pool = this.parsePoolConf(content, file);
          if (pool) pools.push(pool);
        } catch {}
      }
    } catch {}

    return pools;
  }

  private parsePoolConf(content: string, filePath: string): PhpFpmPool | null {
    const nameMatch = content.match(/^\[(.+)\]/m);
    if (!nameMatch) return null;

    const get = (key: string, def: string = ''): string => {
      const m = content.match(new RegExp(`^\\s*${key.replace('.', '\\.')}\\s*=\\s*(.+)`, 'm'));
      return m ? m[1].trim() : def;
    };

    return {
      name: nameMatch[1],
      user: get('user', 'www-data'),
      group: get('group', 'www-data'),
      listenSocket: get('listen', ''),
      pm: get('pm', 'dynamic'),
      pmMaxChildren: parseInt(get('pm.max_children', '5'), 10),
      pmStartServers: parseInt(get('pm.start_servers', '2'), 10) || undefined,
      pmMinSpareServers: parseInt(get('pm.min_spare_servers', '1'), 10) || undefined,
      pmMaxSpareServers: parseInt(get('pm.max_spare_servers', '3'), 10) || undefined,
    };
  }

  /** Create or update an FPM pool */
  async savePool(
    version: string,
    pool: {
      name: string;
      user?: string;
      group?: string;
      pm?: string;
      pmMaxChildren?: number;
      pmStartServers?: number;
      pmMinSpareServers?: number;
      pmMaxSpareServers?: number;
    },
  ): Promise<{ success: boolean; message: string }> {
    const poolDir = `/etc/php/${version}/fpm/pool.d`;
    const filePath = `${poolDir}/${pool.name}.conf`;
    const user = pool.user || 'www-data';
    const group = pool.group || 'www-data';
    const pm = pool.pm || 'dynamic';
    const maxChildren = pool.pmMaxChildren || 5;

    const conf = `[${pool.name}]
user = ${user}
group = ${group}
listen = /var/run/php/php${version}-fpm-${pool.name}.sock
listen.owner = www-data
listen.group = www-data
listen.mode = 0660

pm = ${pm}
pm.max_children = ${maxChildren}
${pm === 'dynamic' ? `pm.start_servers = ${pool.pmStartServers || 2}
pm.min_spare_servers = ${pool.pmMinSpareServers || 1}
pm.max_spare_servers = ${pool.pmMaxSpareServers || 3}` : ''}
${pm === 'ondemand' ? 'pm.process_idle_timeout = 10s' : ''}

php_admin_value[error_log] = /var/log/php${version}-fpm-${pool.name}.log
php_admin_flag[log_errors] = on
`;

    try {
      const tmpFile = `/tmp/php-pool-${pool.name}-${Date.now()}.conf`;
      await fs.writeFile(tmpFile, conf);
      await this.sudo(`mv ${tmpFile} ${filePath}`);
      await this.sudo(`chown root:root ${filePath}`);
      await this.sudo(`chmod 644 ${filePath}`);
      await this.sudo(`systemctl restart php${version}-fpm`);
      return { success: true, message: `Pool '${pool.name}' saved and FPM restarted` };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  /** Delete an FPM pool */
  async deletePool(version: string, poolName: string): Promise<{ success: boolean; message: string }> {
    if (poolName === 'www') {
      return { success: false, message: 'Cannot delete the default www pool' };
    }
    try {
      await this.sudo(`rm -f /etc/php/${version}/fpm/pool.d/${poolName}.conf`);
      await this.sudo(`systemctl restart php${version}-fpm`);
      return { success: true, message: `Pool '${poolName}' deleted` };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  5. PHP ERROR LOGS VIEWER
  // ═══════════════════════════════════════════════════════════════════

  /** Read last N lines of PHP-FPM error log */
  async getErrorLog(version: string, lines = 100): Promise<{ entries: PhpLogEntry[]; raw: string }> {
    const logPaths = [
      `/var/log/php${version}-fpm.log`,
      `/var/log/php-fpm.log`,
      `/var/log/syslog`,
    ];

    let raw = '';
    for (const logPath of logPaths) {
      try {
        raw = await this.sudo(`tail -n ${lines} ${logPath} 2>/dev/null`);
        if (raw) break;
      } catch {}
    }

    // Also check the pool-specific logs
    try {
      const poolLog = await this.sudo(
        `tail -n ${lines} /var/log/php${version}-fpm-*.log 2>/dev/null`,
      );
      if (poolLog) raw = raw ? `${raw}\n${poolLog}` : poolLog;
    } catch {}

    const entries: PhpLogEntry[] = [];
    for (const line of raw.split('\n').filter(Boolean)) {
      // Common format: [09-Feb-2026 12:34:56] WARNING: ...
      const m = line.match(/\[([^\]]+)\]\s*(NOTICE|WARNING|ERROR|ALERT|CRITICAL):?\s*(.*)/i);
      if (m) {
        entries.push({ timestamp: m[1], level: m[2].toUpperCase(), message: m[3] });
      } else {
        entries.push({ timestamp: '', level: 'INFO', message: line });
      }
    }

    return { entries, raw };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  6. DOMAIN PHP VERSION HELPER
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Detect the best PHP-FPM socket to use — returns the versioned socket path.
   * Used by webserver service when creating vhosts.
   */
  async getActiveFpmSocket(): Promise<string> {
    // Find running FPM sockets, prefer the highest version
    for (const ver of [...KNOWN_VERSIONS].reverse()) {
      const sockPath = `/var/run/php/php${ver}-fpm.sock`;
      if (await this.fileExists(sockPath)) return sockPath;
    }
    // Fallback to generic
    return '/var/run/php/php-fpm.sock';
  }

  /** Get FPM socket for a specific version */
  getFpmSocket(version: string): string {
    return `/var/run/php/php${version}-fpm.sock`;
  }
}
