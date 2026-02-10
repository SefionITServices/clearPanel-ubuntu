import { Injectable, Logger } from '@nestjs/common';
import { exec as execCb } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const exec = promisify(execCb);

export interface AppDefinition {
  id: string;
  name: string;
  description: string;
  longDescription: string;
  icon: string;            // MUI icon name hint for the frontend
  color: string;           // brand colour
  category: 'database' | 'development' | 'monitoring' | 'cache' | 'webserver' | 'utility';
  tags: string[];
  version?: string;
  website?: string;
}

export interface AppStatus {
  id: string;
  installed: boolean;
  running: boolean;
  version: string;
  port?: number;
  url?: string;            // local URL to access the tool
}

export interface AppInfo extends AppDefinition {
  status: AppStatus;
}

@Injectable()
export class AppStoreService {
  private readonly logger = new Logger(AppStoreService.name);

  /** Catalog of all apps available in the store */
  private readonly catalog: AppDefinition[] = [
    {
      id: 'phpmyadmin',
      name: 'phpMyAdmin',
      description: 'Web-based MySQL/MariaDB administration tool',
      longDescription:
        'phpMyAdmin is a free and open-source administration tool for MySQL and MariaDB. It provides a portable web interface that allows you to manage databases, tables, columns, relations, indexes, users, and permissions.',
      icon: 'TableChart',
      color: '#F89C0E',
      category: 'database',
      tags: ['mysql', 'mariadb', 'database', 'admin', 'web'],
      website: 'https://www.phpmyadmin.net',
    },
    {
      id: 'redis',
      name: 'Redis',
      description: 'In-memory data structure store and cache',
      longDescription:
        'Redis is an open-source, in-memory key-value data store used as a database, cache, message broker, and streaming engine. It supports various data structures such as strings, hashes, lists, sets, and sorted sets.',
      icon: 'Memory',
      color: '#DC382D',
      category: 'cache',
      tags: ['cache', 'nosql', 'key-value', 'in-memory'],
      website: 'https://redis.io',
    },
    {
      id: 'nodejs',
      name: 'Node.js',
      description: 'JavaScript runtime built on V8 engine',
      longDescription:
        "Node.js is a cross-platform, open-source JavaScript runtime environment. It allows developers to run JavaScript on the server side, build APIs, and create real-time web applications.",
      icon: 'Javascript',
      color: '#339933',
      category: 'development',
      tags: ['javascript', 'runtime', 'npm', 'server'],
      website: 'https://nodejs.org',
    },
    {
      id: 'composer',
      name: 'Composer',
      description: 'Dependency manager for PHP',
      longDescription:
        'Composer is a dependency management tool for PHP. It allows you to declare the libraries your project depends on and it will manage (install/update) them for you.',
      icon: 'LibraryBooks',
      color: '#885630',
      category: 'development',
      tags: ['php', 'dependency', 'package-manager'],
      website: 'https://getcomposer.org',
    },
    {
      id: 'memcached',
      name: 'Memcached',
      description: 'High-performance distributed memory caching system',
      longDescription:
        'Memcached is a general-purpose distributed memory-caching system. It speeds up dynamic web applications by alleviating database load through caching data and objects in RAM.',
      icon: 'Speed',
      color: '#6B9B37',
      category: 'cache',
      tags: ['cache', 'memory', 'distributed'],
      website: 'https://memcached.org',
    },
    {
      id: 'fail2ban',
      name: 'Fail2Ban',
      description: 'Intrusion prevention and log-monitoring tool',
      longDescription:
        'Fail2Ban scans log files and bans IPs showing malicious signs. It updates firewall rules to reject IP addresses for a specified time, protecting your server from brute-force attacks.',
      icon: 'Shield',
      color: '#E53935',
      category: 'utility',
      tags: ['security', 'firewall', 'protection', 'brute-force'],
      website: 'https://www.fail2ban.org',
    },
    {
      id: 'certbot',
      name: 'Certbot',
      description: "Let's Encrypt SSL certificate manager",
      longDescription:
        "Certbot is a free, open-source tool for automatically using Let's Encrypt certificates to enable HTTPS on your server. It handles certificate issuance and renewal.",
      icon: 'VerifiedUser',
      color: '#00838F',
      category: 'utility',
      tags: ['ssl', 'https', 'certificate', 'lets-encrypt'],
      website: 'https://certbot.eff.org',
    },
    {
      id: 'wp-cli',
      name: 'WP-CLI',
      description: 'Command-line interface for WordPress',
      longDescription:
        'WP-CLI is the official command-line tool for managing WordPress installations. You can update plugins, configure multi-site installations, and much more without using a web browser.',
      icon: 'Code',
      color: '#21759B',
      category: 'development',
      tags: ['wordpress', 'cli', 'cms'],
      website: 'https://wp-cli.org',
    },
  ];

  // ─── helpers ────────────────────────────────────────────────────────

  private async sudo(cmd: string, timeout = 60_000): Promise<string> {
    const { stdout } = await exec(`sudo ${cmd}`, { timeout });
    return stdout.trim();
  }

  private async which(bin: string): Promise<boolean> {
    try {
      await exec(`which ${bin}`);
      return true;
    } catch {
      return false;
    }
  }

  private async serviceRunning(svc: string): Promise<boolean> {
    try {
      const out = await this.sudo(`systemctl is-active ${svc}`);
      return out === 'active';
    } catch {
      return false;
    }
  }

  private async pkgVersion(pkg: string): Promise<string> {
    try {
      const out = await this.sudo(`dpkg -s ${pkg} 2>/dev/null | grep '^Version:' | awk '{print $2}'`);
      return out || '';
    } catch {
      return '';
    }
  }

  // ─── catalog ────────────────────────────────────────────────────────

  getCatalog(): AppDefinition[] {
    return this.catalog;
  }

  // ─── status helpers per app ─────────────────────────────────────────

  private async phpMyAdminStatus(): Promise<AppStatus> {
    const configExists = await this.fileExists('/etc/phpmyadmin/config.inc.php');
    const installed = configExists || (await this.fileExists('/usr/share/phpmyadmin/index.php'));
    let version = '';
    if (installed) {
      try {
        version = await this.sudo(
          `php -r "define('PHPMYADMIN', true); require '/usr/share/phpmyadmin/libraries/classes/Version.php'; echo \\Phpmyadmin\\Version::VERSION ?? '';" 2>/dev/null`,
        );
      } catch {
        version = await this.pkgVersion('phpmyadmin');
      }
    }
    // phpMyAdmin runs via the webserver, so we check nginx/apache
    const running = installed && (await this.serviceRunning('nginx') || await this.serviceRunning('apache2'));
    return { id: 'phpmyadmin', installed, running, version, port: 80, url: '/phpmyadmin' };
  }

  private async redisStatus(): Promise<AppStatus> {
    const installed = await this.which('redis-server');
    const running = await this.serviceRunning('redis-server');
    const version = installed ? (await this.pkgVersion('redis-server')) : '';
    return { id: 'redis', installed, running, version, port: 6379 };
  }

  private async nodejsStatus(): Promise<AppStatus> {
    let installed = false;
    let version = '';
    try {
      const v = (await exec('node --version')).stdout.trim();
      installed = true;
      version = v.replace(/^v/, '');
    } catch {}
    return { id: 'nodejs', installed, running: installed, version };
  }

  private async composerStatus(): Promise<AppStatus> {
    const installed = await this.which('composer');
    let version = '';
    if (installed) {
      try {
        const out = (await exec('composer --version 2>/dev/null')).stdout.trim();
        const m = out.match(/Composer version (\S+)/);
        if (m) version = m[1];
      } catch {}
    }
    return { id: 'composer', installed, running: installed, version };
  }

  private async memcachedStatus(): Promise<AppStatus> {
    const installed = await this.which('memcached');
    const running = await this.serviceRunning('memcached');
    const version = installed ? (await this.pkgVersion('memcached')) : '';
    return { id: 'memcached', installed, running, version, port: 11211 };
  }

  private async fail2banStatus(): Promise<AppStatus> {
    const installed = await this.which('fail2ban-client');
    const running = await this.serviceRunning('fail2ban');
    const version = installed ? (await this.pkgVersion('fail2ban')) : '';
    return { id: 'fail2ban', installed, running, version };
  }

  private async certbotStatus(): Promise<AppStatus> {
    const installed = await this.which('certbot');
    let version = '';
    if (installed) {
      try {
        const out = (await exec('certbot --version 2>&1')).stdout.trim();
        const m = out.match(/certbot (\S+)/);
        if (m) version = m[1];
      } catch {}
    }
    return { id: 'certbot', installed, running: installed, version };
  }

  private async wpCliStatus(): Promise<AppStatus> {
    const installed = await this.which('wp');
    let version = '';
    if (installed) {
      try {
        const out = (await exec('wp --version 2>/dev/null')).stdout.trim();
        const m = out.match(/WP-CLI (\S+)/);
        if (m) version = m[1];
      } catch {}
    }
    return { id: 'wp-cli', installed, running: installed, version };
  }

  // ─── public: get status of one or all apps ──────────────────────────

  async getAppStatus(id: string): Promise<AppStatus> {
    const fn = this.statusMap()[id];
    if (!fn) throw new Error(`Unknown app: ${id}`);
    return fn();
  }

  async getAllStatuses(): Promise<AppStatus[]> {
    const map = this.statusMap();
    return Promise.all(Object.values(map).map((fn) => fn()));
  }

  async getAllApps(): Promise<AppInfo[]> {
    const statuses = await this.getAllStatuses();
    const statusById = Object.fromEntries(statuses.map((s) => [s.id, s]));
    return this.catalog.map((app) => ({
      ...app,
      status: statusById[app.id] || { id: app.id, installed: false, running: false, version: '' },
    }));
  }

  private statusMap(): Record<string, () => Promise<AppStatus>> {
    return {
      phpmyadmin: () => this.phpMyAdminStatus(),
      redis: () => this.redisStatus(),
      nodejs: () => this.nodejsStatus(),
      composer: () => this.composerStatus(),
      memcached: () => this.memcachedStatus(),
      fail2ban: () => this.fail2banStatus(),
      certbot: () => this.certbotStatus(),
      'wp-cli': () => this.wpCliStatus(),
    };
  }

  // ─── install / uninstall ────────────────────────────────────────────

  async installApp(id: string): Promise<{ success: boolean; message: string; logs?: string }> {
    const fn = this.installMap()[id];
    if (!fn) throw new Error(`Unknown app: ${id}`);
    this.logger.log(`Installing app: ${id}`);
    return fn();
  }

  async uninstallApp(id: string): Promise<{ success: boolean; message: string }> {
    const fn = this.uninstallMap()[id];
    if (!fn) throw new Error(`Unknown app: ${id}`);
    this.logger.log(`Uninstalling app: ${id}`);
    return fn();
  }

  private installMap(): Record<string, () => Promise<{ success: boolean; message: string; logs?: string }>> {
    return {
      phpmyadmin: () => this.installPhpMyAdmin(),
      redis: () => this.installGenericApt('redis-server', 'redis-server', 'Redis'),
      nodejs: () => this.installNodejs(),
      composer: () => this.installComposer(),
      memcached: () => this.installGenericApt('memcached', 'memcached', 'Memcached'),
      fail2ban: () => this.installGenericApt('fail2ban', 'fail2ban', 'Fail2Ban'),
      certbot: () => this.installCertbot(),
      'wp-cli': () => this.installWpCli(),
    };
  }

  private uninstallMap(): Record<string, () => Promise<{ success: boolean; message: string }>> {
    return {
      phpmyadmin: () => this.uninstallPhpMyAdmin(),
      redis: () => this.uninstallGenericApt('redis-server', 'Redis'),
      nodejs: () => this.uninstallNodejs(),
      composer: () => this.uninstallComposer(),
      memcached: () => this.uninstallGenericApt('memcached', 'Memcached'),
      fail2ban: () => this.uninstallGenericApt('fail2ban', 'Fail2Ban'),
      certbot: () => this.uninstallGenericApt('certbot', 'Certbot'),
      'wp-cli': () => this.uninstallWpCli(),
    };
  }

  // ─── phpMyAdmin ──────────────────────────────────────────────────────

  private async installPhpMyAdmin(): Promise<{ success: boolean; message: string; logs?: string }> {
    try {
      // Install PHP + phpMyAdmin non-interactively
      // Pre-seed debconf so phpmyadmin doesn't try to configure a DB interactively
      const cmds = [
        'DEBIAN_FRONTEND=noninteractive apt-get update -qq',
        `bash -c 'echo "phpmyadmin phpmyadmin/dbconfig-install boolean false" | debconf-set-selections'`,
        `bash -c 'echo "phpmyadmin phpmyadmin/reconfigure-webserver multiselect" | debconf-set-selections'`,
        'DEBIAN_FRONTEND=noninteractive apt-get install -y -qq phpmyadmin php-mbstring php-zip php-gd php-json php-curl php-fpm',
      ];
      let logs = '';
      for (const cmd of cmds) {
        try { logs += await this.sudo(cmd, 180_000) + '\n'; } catch (e: any) { logs += `WARN: ${e.message}\n`; }
      }

      // Ensure PHP-FPM is running
      const phpVer = await this.detectPhpFpmVersion();
      try { await this.sudo(`systemctl enable php${phpVer}-fpm`); } catch {}
      try { await this.sudo(`systemctl restart php${phpVer}-fpm`); } catch {}

      // Create phpMyAdmin symlink if missing (some distros don't create it)
      try { await this.sudo('ln -sf /usr/share/phpmyadmin /var/www/html/phpmyadmin'); } catch {}

      // Configure nginx to serve phpMyAdmin
      await this.configurePhpMyAdminNginx(phpVer);

      return { success: true, message: 'phpMyAdmin installed successfully', logs };
    } catch (e: any) {
      this.logger.error(`phpMyAdmin install failed: ${e.message}`);
      return { success: false, message: e.message };
    }
  }

  /**
   * Detect the installed PHP-FPM version by checking which socket exists
   */
  private async detectPhpFpmVersion(): Promise<string> {
    // Method 1: find an actual .sock file
    try {
      const sock = await this.sudo(`find /var/run/php/ -name 'php*-fpm.sock' -print -quit 2>/dev/null`);
      const m = sock.match(/php(\d+\.\d+)/);
      if (m) return m[1];
    } catch {}
    // Method 2: check installed php-fpm packages
    try {
      const out = await this.sudo(`dpkg -l 'php*-fpm' 2>/dev/null | grep '^ii' | awk '{print $2}' | head -1`);
      const m = out.match(/php(\d+\.\d+)/);
      if (m) return m[1];
    } catch {}
    // Method 3: php -v
    try {
      const out = await this.sudo('php -v 2>/dev/null | head -1');
      const m = out.match(/PHP (\d+\.\d+)/);
      if (m) return m[1];
    } catch {}
    return '8.1'; // safe default for Ubuntu 22.04+
  }

  private async configurePhpMyAdminNginx(phpVer?: string): Promise<void> {
    if (!phpVer) phpVer = await this.detectPhpFpmVersion();

    // Using root + try_files approach which works more reliably than alias for PHP
    const nginxSnippet = `# phpMyAdmin configuration – managed by clearPanel
location /phpmyadmin {
    root /usr/share/;
    index index.php index.html index.htm;

    location ~ ^/phpmyadmin/(.+\\.php)$ {
        root /usr/share/;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME /usr/share/phpmyadmin/$1;
        fastcgi_pass unix:/var/run/php/php${phpVer}-fpm.sock;
        fastcgi_index index.php;
    }

    location ~* ^/phpmyadmin/(.+\\.(jpg|jpeg|gif|css|png|js|ico|html|xml|txt|svg|woff|woff2|ttf))$ {
        root /usr/share/;
    }
}
`;

    // Write snippet
    const snippetPath = '/etc/nginx/snippets/phpmyadmin.conf';
    await this.sudo(`bash -c 'cat > ${snippetPath} << "HEREDOC"\n${nginxSnippet}\nHEREDOC'`);

    // Include in default server block if not already included
    try {
      const defaultConf = await this.sudo('cat /etc/nginx/sites-available/default');
      if (!defaultConf.includes('phpmyadmin.conf')) {
        // Insert include before the closing brace of the server block
        const updated = defaultConf.replace(
          /^}$/m,
          `    include snippets/phpmyadmin.conf;\n}`,
        );
        await this.sudo(`bash -c 'cat > /etc/nginx/sites-available/default << "HEREDOC"\n${updated}\nHEREDOC'`);
      }
    } catch (e) {
      this.logger.warn('Could not update default nginx conf, creating standalone');
    }

    // Also include in all site configs
    try {
      const sites = await this.sudo('ls /etc/nginx/sites-available/');
      for (const site of sites.split('\n').filter(Boolean)) {
        try {
          const conf = await this.sudo(`cat /etc/nginx/sites-available/${site}`);
          if (!conf.includes('phpmyadmin.conf') && conf.includes('server {')) {
            const updated = conf.replace(
              /^}$/m,
              `    include snippets/phpmyadmin.conf;\n}`,
            );
            await this.sudo(`bash -c 'cat > /etc/nginx/sites-available/${site} << "HEREDOC"\n${updated}\nHEREDOC'`);
          }
        } catch {}
      }
    } catch {}

    // Test and reload
    try {
      await this.sudo('nginx -t');
    } catch (e: any) {
      this.logger.error(`nginx -t failed: ${e.message}`);
      throw new Error(`Nginx config test failed: ${e.message}`);
    }
    await this.sudo('systemctl reload nginx');
  }

  /**
   * Re-run the phpMyAdmin nginx configuration (useful to fix 502 without reinstalling)
   */
  async reconfigurePhpMyAdmin(): Promise<{ success: boolean; message: string; phpVersion: string }> {
    const phpVer = await this.detectPhpFpmVersion();
    // Ensure PHP-FPM is running
    try { await this.sudo(`systemctl enable php${phpVer}-fpm`); } catch {}
    try { await this.sudo(`systemctl restart php${phpVer}-fpm`); } catch {}
    await this.configurePhpMyAdminNginx(phpVer);
    return { success: true, message: `phpMyAdmin reconfigured with PHP ${phpVer}-FPM`, phpVersion: phpVer };
  }

  private async uninstallPhpMyAdmin(): Promise<{ success: boolean; message: string }> {
    try {
      await this.sudo('DEBIAN_FRONTEND=noninteractive apt-get purge -y phpmyadmin');
      await this.sudo('rm -f /etc/nginx/snippets/phpmyadmin.conf');
      // Remove include lines from nginx configs
      try {
        const sites = await this.sudo('ls /etc/nginx/sites-available/');
        for (const site of sites.split('\n').filter(Boolean)) {
          try {
            await this.sudo(`sed -i '/phpmyadmin\\.conf/d' /etc/nginx/sites-available/${site}`);
          } catch {}
        }
        await this.sudo('nginx -t && systemctl reload nginx');
      } catch {}
      return { success: true, message: 'phpMyAdmin uninstalled' };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  // ─── Node.js ────────────────────────────────────────────────────────

  private async installNodejs(): Promise<{ success: boolean; message: string; logs?: string }> {
    try {
      const logs = await this.sudo(
        'bash -c "curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs"',
        180_000,
      );
      return { success: true, message: 'Node.js 20.x installed', logs };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  private async uninstallNodejs(): Promise<{ success: boolean; message: string }> {
    try {
      await this.sudo('DEBIAN_FRONTEND=noninteractive apt-get purge -y nodejs');
      return { success: true, message: 'Node.js uninstalled' };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  // ─── Composer ───────────────────────────────────────────────────────

  private async installComposer(): Promise<{ success: boolean; message: string; logs?: string }> {
    try {
      const cmds = [
        'DEBIAN_FRONTEND=noninteractive apt-get install -y -qq php-cli php-zip unzip',
        'curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer',
      ];
      let logs = '';
      for (const cmd of cmds) {
        logs += await this.sudo(cmd, 120_000) + '\n';
      }
      return { success: true, message: 'Composer installed', logs };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  private async uninstallComposer(): Promise<{ success: boolean; message: string }> {
    try {
      await this.sudo('rm -f /usr/local/bin/composer');
      return { success: true, message: 'Composer uninstalled' };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  // ─── Certbot ────────────────────────────────────────────────────────

  private async installCertbot(): Promise<{ success: boolean; message: string; logs?: string }> {
    try {
      const logs = await this.sudo(
        'DEBIAN_FRONTEND=noninteractive apt-get install -y certbot python3-certbot-nginx',
        120_000,
      );
      return { success: true, message: 'Certbot installed', logs };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  // ─── WP-CLI ─────────────────────────────────────────────────────────

  private async installWpCli(): Promise<{ success: boolean; message: string; logs?: string }> {
    try {
      const cmds = [
        'curl -O https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar',
        'chmod +x wp-cli.phar',
        'mv wp-cli.phar /usr/local/bin/wp',
      ];
      let logs = '';
      for (const cmd of cmds) {
        logs += await this.sudo(cmd, 60_000) + '\n';
      }
      return { success: true, message: 'WP-CLI installed', logs };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  private async uninstallWpCli(): Promise<{ success: boolean; message: string }> {
    try {
      await this.sudo('rm -f /usr/local/bin/wp');
      return { success: true, message: 'WP-CLI uninstalled' };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  // ─── Generic APT install / uninstall ────────────────────────────────

  private async installGenericApt(
    pkg: string,
    service: string,
    label: string,
  ): Promise<{ success: boolean; message: string; logs?: string }> {
    try {
      const logs = await this.sudo(
        `DEBIAN_FRONTEND=noninteractive apt-get install -y ${pkg}`,
        120_000,
      );
      try { await this.sudo(`systemctl enable ${service}`); } catch {}
      try { await this.sudo(`systemctl start ${service}`); } catch {}
      return { success: true, message: `${label} installed successfully`, logs };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  private async uninstallGenericApt(pkg: string, label: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.sudo(`DEBIAN_FRONTEND=noninteractive apt-get purge -y ${pkg}`);
      return { success: true, message: `${label} uninstalled` };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  // ─── file check helper ──────────────────────────────────────────────

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
