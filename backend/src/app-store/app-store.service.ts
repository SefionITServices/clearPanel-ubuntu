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

export type DiagnoseCheck = { name: string; status: 'ok' | 'error' | 'warn'; detail: string };

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
    {
      id: 'pgadmin',
      name: 'pgAdmin 4',
      description: 'Web-based PostgreSQL administration tool',
      longDescription:
        'pgAdmin is the most popular open-source administration and development platform for PostgreSQL. It provides a graphical interface for managing databases, running queries, and monitoring server performance.',
      icon: 'TableChart',
      color: '#336791',
      category: 'database',
      tags: ['postgresql', 'database', 'admin', 'web'],
      website: 'https://www.pgadmin.org',
    },
    {
      id: 'roundcube',
      name: 'Roundcube',
      description: 'Modern webmail client for IMAP servers',
      longDescription:
        'Roundcube is a free and open-source browser-based IMAP email client with a desktop-like UI. It provides full email functionality including address book, folder management, message search, and sieve filter support.',
      icon: 'MailOutline',
      color: '#37BEFF',
      category: 'utility',
      tags: ['email', 'webmail', 'imap', 'mail', 'roundcube'],
      website: 'https://roundcube.net',
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

  private async pgAdminStatus(): Promise<AppStatus> {
    let installed = false;
    let running = false;
    let version = '';
    // Check if pgadmin4 package is installed
    try {
      const v = await this.sudo(`dpkg -s pgadmin4 2>/dev/null | grep '^Version:' | awk '{print $2}'`);
      if (v) { installed = true; version = v; }
    } catch {}
    // Also check pip-based install
    if (!installed) {
      try {
        const v = (await exec('pip3 show pgadmin4 2>/dev/null | grep Version')).stdout.trim();
        const m = v.match(/Version:\s*(\S+)/);
        if (m) { installed = true; version = m[1]; }
      } catch {}
    }
    // Check if pgadmin4 web service is running
    if (installed) {
      try {
        running = await this.serviceRunning('pgadmin4');
      } catch {}
      if (!running) {
        // Also check if it's running via apache/nginx reverse proxy
        try {
          const out = await this.sudo(`curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://localhost/pgadmin 2>/dev/null || echo 000`);
          running = out.startsWith('2') || out.startsWith('3');
        } catch {}
      }
    }
    return { id: 'pgadmin', installed, running, version, url: '/pgadmin' };
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
      pgadmin: () => this.pgAdminStatus(),
      roundcube: () => this.roundcubeStatus(),
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
      pgadmin: () => this.installPgAdmin(),
      roundcube: () => this.installRoundcube(),
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
      pgadmin: () => this.uninstallPgAdmin(),
      roundcube: () => this.uninstallRoundcube(),
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

  // ─── pgAdmin 4 ──────────────────────────────────────────────────────

  private async installPgAdmin(): Promise<{ success: boolean; message: string; logs?: string }> {
    try {
      const cmds = [
        // Install the public key for the APT repository
        'bash -c "curl -fsS https://www.pgadmin.org/static/packages_pgadmin_org.pub | gpg --dearmor -o /usr/share/keyrings/packages-pgadmin-org.gpg 2>/dev/null || true"',
        // Create the repository configuration file
        'bash -c \'echo "deb [signed-by=/usr/share/keyrings/packages-pgadmin-org.gpg] https://ftp.postgresql.org/pub/pgadmin/pgadmin4/apt/$(lsb_release -cs) pgadmin4 main" > /etc/apt/sources.list.d/pgadmin4.list\'',
        'DEBIAN_FRONTEND=noninteractive apt-get update -qq',
        'DEBIAN_FRONTEND=noninteractive apt-get install -y pgadmin4-web',
      ];
      let logs = '';
      for (const cmd of cmds) {
        try { logs += await this.sudo(cmd, 180_000) + '\n'; } catch (e: any) { logs += `WARN: ${e.message}\n`; }
      }

      // Run the pgAdmin web setup non-interactively
      try {
        logs += await this.sudo(
          'bash -c "echo \\"admin@localhost\\nadmin\\nadmin\\" | /usr/pgadmin4/bin/setup-web.sh --yes 2>&1"',
          120_000,
        ) + '\n';
      } catch (e: any) {
        logs += `Setup note: ${e.message}\n`;
      }

      // Configure nginx reverse proxy for pgAdmin
      await this.configurePgAdminNginx();

      return { success: true, message: 'pgAdmin 4 installed successfully', logs };
    } catch (e: any) {
      this.logger.error(`pgAdmin install failed: ${e.message}`);
      return { success: false, message: e.message };
    }
  }

  private async configurePgAdminNginx(): Promise<void> {
    const nginxSnippet = `# pgAdmin configuration – managed by clearPanel
location /pgadmin {
    proxy_pass http://127.0.0.1:5050/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Script-Name /pgadmin;
    proxy_redirect off;
}
`;
    const snippetPath = '/etc/nginx/snippets/pgadmin.conf';
    await this.sudo(`bash -c 'cat > ${snippetPath} << "HEREDOC"\n${nginxSnippet}\nHEREDOC'`);

    // Include in default server block if not already included
    try {
      const defaultConf = await this.sudo('cat /etc/nginx/sites-available/default');
      if (!defaultConf.includes('pgadmin.conf')) {
        const updated = defaultConf.replace(
          /^}$/m,
          `    include snippets/pgadmin.conf;\n}`,
        );
        await this.sudo(`bash -c 'cat > /etc/nginx/sites-available/default << "HEREDOC"\n${updated}\nHEREDOC'`);
      }
    } catch {}

    try {
      await this.sudo('nginx -t');
      await this.sudo('systemctl reload nginx');
    } catch (e: any) {
      this.logger.error(`pgAdmin nginx config failed: ${e.message}`);
    }
  }

  private async uninstallPgAdmin(): Promise<{ success: boolean; message: string }> {
    try {
      await this.sudo('DEBIAN_FRONTEND=noninteractive apt-get purge -y pgadmin4-web pgadmin4');
      await this.sudo('rm -f /etc/nginx/snippets/pgadmin.conf');
      try {
        const sites = await this.sudo('ls /etc/nginx/sites-available/');
        for (const site of sites.split('\n').filter(Boolean)) {
          try { await this.sudo(`sed -i '/pgadmin\\.conf/d' /etc/nginx/sites-available/${site}`); } catch {}
        }
        await this.sudo('nginx -t && systemctl reload nginx');
      } catch {}
      return { success: true, message: 'pgAdmin 4 uninstalled' };
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

  private async portListening(port: number): Promise<boolean> {
    try {
      const out = await this.sudo(`ss -tlnp 'sport = :${port}' 2>/dev/null | tail -n +2`);
      return out.length > 0;
    } catch { return false; }
  }

  private async serviceEnabled(svc: string): Promise<boolean> {
    try {
      const out = await this.sudo(`systemctl is-enabled ${svc} 2>/dev/null`);
      return out === 'enabled';
    } catch { return false; }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  GENERIC DIAGNOSE DISPATCHER
  // ═══════════════════════════════════════════════════════════════════

  async diagnoseApp(id: string): Promise<{ success: boolean; checks: DiagnoseCheck[] }> {
    const map: Record<string, () => Promise<DiagnoseCheck[]>> = {
      phpmyadmin: () => this.diagnosePhpMyAdminChecks(),
      redis: () => this.diagnoseRedis(),
      nodejs: () => this.diagnoseNodejs(),
      composer: () => this.diagnoseComposer(),
      memcached: () => this.diagnoseMemcached(),
      fail2ban: () => this.diagnoseFail2ban(),
      certbot: () => this.diagnoseCertbot(),
      'wp-cli': () => this.diagnoseWpCli(),
      pgadmin: () => this.diagnosePgAdmin(),
      roundcube: () => this.diagnoseRoundcube(),
    };
    const fn = map[id];
    if (!fn) return { success: false, checks: [{ name: 'Error', status: 'error', detail: `Unknown app: ${id}` }] };
    try {
      const checks = await fn();
      return { success: true, checks };
    } catch (e: any) {
      return { success: false, checks: [{ name: 'Error', status: 'error', detail: e.message }] };
    }
  }

  // keep backward-compat wrapper
  async diagnosePhpMyAdmin() {
    return this.diagnoseApp('phpmyadmin');
  }

  // ─── per-app diagnose implementations ──────────────────────────────

  private async diagnosePhpMyAdminChecks(): Promise<DiagnoseCheck[]> {
    const checks: DiagnoseCheck[] = [];

    const pmaIndex = await this.fileExists('/usr/share/phpmyadmin/index.php');
    const pmaConfig = await this.fileExists('/etc/phpmyadmin/config.inc.php');
    checks.push({
      name: 'phpMyAdmin Files',
      status: pmaIndex ? 'ok' : 'error',
      detail: pmaIndex
        ? `index.php found${pmaConfig ? ', config.inc.php found' : ', config.inc.php missing (optional)'}`
        : 'phpMyAdmin is not installed (/usr/share/phpmyadmin/index.php missing)',
    });

    const nginxRunning = await this.serviceRunning('nginx');
    checks.push({ name: 'Nginx', status: nginxRunning ? 'ok' : 'error', detail: nginxRunning ? 'Nginx is running' : 'Nginx is NOT running' });

    const snippetExists = await this.fileExists('/etc/nginx/snippets/phpmyadmin.conf');
    let snippetIncluded = false;
    if (snippetExists) {
      try {
        const defConf = await this.sudo('cat /etc/nginx/sites-enabled/default 2>/dev/null || true');
        snippetIncluded = defConf.includes('phpmyadmin.conf');
      } catch {}
    }
    checks.push({
      name: 'Nginx phpMyAdmin Config',
      status: snippetExists && snippetIncluded ? 'ok' : snippetExists ? 'warn' : 'error',
      detail: !snippetExists ? 'snippets/phpmyadmin.conf does not exist'
        : snippetIncluded ? 'Snippet exists and is included in site config'
        : 'Snippet exists but NOT included in any site config',
    });

    const phpVer = await this.detectPhpFpmVersion();
    const fpmService = `php${phpVer}-fpm`;
    const fpmRunning = await this.serviceRunning(fpmService);
    checks.push({ name: `PHP-FPM (${phpVer})`, status: fpmRunning ? 'ok' : 'error', detail: fpmRunning ? `${fpmService} is running` : `${fpmService} is NOT running` });

    const socketPath = `/var/run/php/php${phpVer}-fpm.sock`;
    const socketExists = await this.fileExists(socketPath);
    checks.push({ name: 'PHP-FPM Socket', status: socketExists ? 'ok' : 'error', detail: socketExists ? `Socket found: ${socketPath}` : `Socket NOT found: ${socketPath}` });

    const mysqlRunning = await this.serviceRunning('mysql') || await this.serviceRunning('mariadb');
    checks.push({ name: 'MySQL / MariaDB', status: mysqlRunning ? 'ok' : 'error', detail: mysqlRunning ? 'Database server is running' : 'MySQL/MariaDB is NOT running' });

    let nginxTestOk = false;
    let nginxTestDetail = '';
    try { await this.sudo('nginx -t 2>&1'); nginxTestOk = true; nginxTestDetail = 'nginx -t passed'; } catch (e: any) { nginxTestDetail = `nginx -t FAILED: ${e.message?.substring(0, 200)}`; }
    checks.push({ name: 'Nginx Config Test', status: nginxTestOk ? 'ok' : 'error', detail: nginxTestDetail });

    let httpStatus = '';
    try { httpStatus = await this.sudo(`curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://localhost/phpmyadmin/ 2>/dev/null`); } catch { httpStatus = '000'; }
    const httpOk = httpStatus.startsWith('2') || httpStatus.startsWith('3');
    checks.push({
      name: 'HTTP Response',
      status: httpOk ? 'ok' : 'error',
      detail: httpOk ? `HTTP ${httpStatus} — phpMyAdmin is reachable`
        : httpStatus === '502' ? 'HTTP 502 Bad Gateway — PHP-FPM socket/config mismatch'
        : httpStatus === '404' ? 'HTTP 404 — Nginx not including phpMyAdmin location'
        : httpStatus === '000' ? 'Could not connect — Nginx may not be running'
        : `HTTP ${httpStatus}`,
    });

    return checks;
  }

  private async diagnoseRedis(): Promise<DiagnoseCheck[]> {
    const checks: DiagnoseCheck[] = [];

    const installed = await this.which('redis-server');
    checks.push({ name: 'Redis Server Binary', status: installed ? 'ok' : 'error', detail: installed ? 'redis-server found in PATH' : 'redis-server not found — Redis is not installed' });

    const running = await this.serviceRunning('redis-server');
    checks.push({ name: 'Redis Service', status: running ? 'ok' : 'error', detail: running ? 'redis-server service is active' : 'redis-server service is NOT active' });

    const enabled = await this.serviceEnabled('redis-server');
    checks.push({ name: 'Auto-Start on Boot', status: enabled ? 'ok' : 'warn', detail: enabled ? 'redis-server is enabled on boot' : 'redis-server will NOT start on boot' });

    const listening = await this.portListening(6379);
    checks.push({ name: 'Port 6379', status: listening ? 'ok' : 'error', detail: listening ? 'Redis is listening on port 6379' : 'Nothing listening on port 6379' });

    const configExists = await this.fileExists('/etc/redis/redis.conf');
    checks.push({ name: 'Config File', status: configExists ? 'ok' : 'warn', detail: configExists ? '/etc/redis/redis.conf exists' : 'Config file not found at /etc/redis/redis.conf' });

    // Ping test
    let pingOk = false;
    try {
      const out = await this.sudo('redis-cli ping 2>/dev/null');
      pingOk = out === 'PONG';
    } catch {}
    checks.push({ name: 'Redis PING', status: pingOk ? 'ok' : 'error', detail: pingOk ? 'PONG — Redis is responding' : 'Redis is not responding to PING' });

    // Memory info
    try {
      const mem = await this.sudo(`redis-cli info memory 2>/dev/null | grep used_memory_human`);
      const m = mem.match(/used_memory_human:(\S+)/);
      if (m) checks.push({ name: 'Memory Usage', status: 'ok', detail: `Current memory usage: ${m[1]}` });
    } catch {}

    return checks;
  }

  private async diagnoseNodejs(): Promise<DiagnoseCheck[]> {
    const checks: DiagnoseCheck[] = [];

    let nodeVersion = '';
    try { nodeVersion = (await exec('node --version')).stdout.trim(); } catch {}
    checks.push({ name: 'Node.js Binary', status: nodeVersion ? 'ok' : 'error', detail: nodeVersion ? `node ${nodeVersion} found` : 'node command not found' });

    let npmVersion = '';
    try { npmVersion = (await exec('npm --version')).stdout.trim(); } catch {}
    checks.push({ name: 'npm', status: npmVersion ? 'ok' : 'error', detail: npmVersion ? `npm v${npmVersion} found` : 'npm not found' });

    // Check if npx is available
    let npxOk = false;
    try { await exec('which npx'); npxOk = true; } catch {}
    checks.push({ name: 'npx', status: npxOk ? 'ok' : 'warn', detail: npxOk ? 'npx is available' : 'npx not found' });

    // Check NODE_PATH or global modules location
    let globalPath = '';
    try { globalPath = (await exec('npm root -g 2>/dev/null')).stdout.trim(); } catch {}
    if (globalPath) checks.push({ name: 'Global Modules', status: 'ok', detail: `Global path: ${globalPath}` });

    // Check Node.js source (nodesource vs system)
    let source = 'unknown';
    try {
      const out = await this.sudo(`dpkg -s nodejs 2>/dev/null | grep -i maintainer`);
      if (out.includes('NodeSource')) source = 'NodeSource';
      else if (out.includes('Ubuntu') || out.includes('Debian')) source = 'System package';
    } catch {}
    checks.push({ name: 'Installation Source', status: 'ok', detail: `Installed from: ${source}` });

    return checks;
  }

  private async diagnoseComposer(): Promise<DiagnoseCheck[]> {
    const checks: DiagnoseCheck[] = [];

    const installed = await this.which('composer');
    let version = '';
    if (installed) {
      try {
        const out = (await exec('composer --version 2>/dev/null')).stdout.trim();
        const m = out.match(/Composer version (\S+)/);
        if (m) version = m[1];
      } catch {}
    }
    checks.push({ name: 'Composer Binary', status: installed ? 'ok' : 'error', detail: installed ? `composer v${version} found` : 'composer not found in PATH' });

    // Check PHP CLI dependency
    let phpCli = false;
    try { await exec('php --version 2>/dev/null'); phpCli = true; } catch {}
    checks.push({ name: 'PHP CLI', status: phpCli ? 'ok' : 'error', detail: phpCli ? 'PHP CLI is available (required by Composer)' : 'PHP CLI not found — Composer requires PHP' });

    // Check common PHP extensions needed by Composer
    const neededExts = ['json', 'mbstring', 'openssl', 'zip'];
    for (const ext of neededExts) {
      let enabled = false;
      try {
        const out = (await exec(`php -m 2>/dev/null`)).stdout;
        enabled = out.toLowerCase().includes(ext);
      } catch {}
      checks.push({ name: `PHP ext: ${ext}`, status: enabled ? 'ok' : 'warn', detail: enabled ? `${ext} extension loaded` : `${ext} extension not loaded — some packages may fail` });
    }

    // Check if unzip is available
    const unzipOk = await this.which('unzip');
    checks.push({ name: 'unzip', status: unzipOk ? 'ok' : 'warn', detail: unzipOk ? 'unzip is available' : 'unzip not found — Composer may use slower PHP-based extraction' });

    return checks;
  }

  private async diagnoseMemcached(): Promise<DiagnoseCheck[]> {
    const checks: DiagnoseCheck[] = [];

    const installed = await this.which('memcached');
    checks.push({ name: 'Memcached Binary', status: installed ? 'ok' : 'error', detail: installed ? 'memcached found in PATH' : 'memcached not found — not installed' });

    const running = await this.serviceRunning('memcached');
    checks.push({ name: 'Memcached Service', status: running ? 'ok' : 'error', detail: running ? 'memcached service is active' : 'memcached service is NOT active' });

    const enabled = await this.serviceEnabled('memcached');
    checks.push({ name: 'Auto-Start on Boot', status: enabled ? 'ok' : 'warn', detail: enabled ? 'memcached is enabled on boot' : 'memcached will NOT start on boot' });

    const listening = await this.portListening(11211);
    checks.push({ name: 'Port 11211', status: listening ? 'ok' : 'error', detail: listening ? 'Memcached is listening on port 11211' : 'Nothing listening on port 11211' });

    const configExists = await this.fileExists('/etc/memcached.conf');
    checks.push({ name: 'Config File', status: configExists ? 'ok' : 'warn', detail: configExists ? '/etc/memcached.conf exists' : 'Config file not found' });

    // Check memory allocation from config
    if (configExists) {
      try {
        const conf = await this.sudo('cat /etc/memcached.conf 2>/dev/null');
        const memMatch = conf.match(/-m\s+(\d+)/);
        if (memMatch) checks.push({ name: 'Memory Limit', status: 'ok', detail: `Allocated ${memMatch[1]} MB` });
      } catch {}
    }

    // Connection test
    let connOk = false;
    try {
      const out = await this.sudo(`bash -c 'echo stats | nc -q1 localhost 11211 2>/dev/null | head -1'`);
      connOk = out.includes('STAT');
    } catch {}
    checks.push({ name: 'Connection Test', status: connOk ? 'ok' : 'error', detail: connOk ? 'Memcached is responding to stats command' : 'Cannot connect to Memcached' });

    return checks;
  }

  private async diagnoseFail2ban(): Promise<DiagnoseCheck[]> {
    const checks: DiagnoseCheck[] = [];

    const installed = await this.which('fail2ban-client');
    checks.push({ name: 'Fail2Ban Binary', status: installed ? 'ok' : 'error', detail: installed ? 'fail2ban-client found' : 'fail2ban-client not found — not installed' });

    const running = await this.serviceRunning('fail2ban');
    checks.push({ name: 'Fail2Ban Service', status: running ? 'ok' : 'error', detail: running ? 'fail2ban is active' : 'fail2ban is NOT active' });

    const enabled = await this.serviceEnabled('fail2ban');
    checks.push({ name: 'Auto-Start on Boot', status: enabled ? 'ok' : 'warn', detail: enabled ? 'fail2ban is enabled on boot' : 'fail2ban will NOT start on boot' });

    const configExists = await this.fileExists('/etc/fail2ban/jail.local');
    const defaultConf = await this.fileExists('/etc/fail2ban/jail.conf');
    checks.push({
      name: 'Config Files',
      status: defaultConf ? 'ok' : 'error',
      detail: defaultConf
        ? `jail.conf found${configExists ? ', jail.local found (custom overrides)' : ', no jail.local (using defaults)'}`
        : 'No fail2ban config files found',
    });

    // Count active jails
    if (running) {
      try {
        const out = await this.sudo('fail2ban-client status 2>/dev/null');
        const m = out.match(/Number of jail:\s*(\d+)/);
        const jails = m ? m[1] : '0';
        const jailList = out.match(/Jail list:\s*(.*)/);
        checks.push({
          name: 'Active Jails',
          status: parseInt(jails) > 0 ? 'ok' : 'warn',
          detail: `${jails} jail(s) active${jailList ? `: ${jailList[1].trim()}` : ''}`,
        });
      } catch {}

      // Total banned IPs
      try {
        const out = await this.sudo(`fail2ban-client status sshd 2>/dev/null`);
        const banned = out.match(/Currently banned:\s*(\d+)/);
        if (banned) checks.push({ name: 'SSH Jail Banned', status: 'ok', detail: `${banned[1]} IP(s) currently banned in sshd jail` });
      } catch {}
    }

    // Log file
    const logExists = await this.fileExists('/var/log/fail2ban.log');
    checks.push({ name: 'Log File', status: logExists ? 'ok' : 'warn', detail: logExists ? '/var/log/fail2ban.log exists' : 'Log file not found' });

    return checks;
  }

  private async diagnoseCertbot(): Promise<DiagnoseCheck[]> {
    const checks: DiagnoseCheck[] = [];

    const installed = await this.which('certbot');
    let version = '';
    if (installed) {
      try {
        const out = (await exec('certbot --version 2>&1')).stdout.trim();
        const m = out.match(/certbot (\S+)/);
        if (m) version = m[1];
      } catch {}
    }
    checks.push({ name: 'Certbot Binary', status: installed ? 'ok' : 'error', detail: installed ? `certbot v${version}` : 'certbot not found — not installed' });

    // Nginx plugin
    let nginxPlugin = false;
    try {
      const out = (await exec('certbot plugins 2>/dev/null')).stdout;
      nginxPlugin = out.includes('nginx');
    } catch {}
    checks.push({ name: 'Nginx Plugin', status: nginxPlugin ? 'ok' : 'warn', detail: nginxPlugin ? 'python3-certbot-nginx plugin available' : 'Nginx plugin not found — install python3-certbot-nginx' });

    // Auto-renewal timer
    let timerActive = false;
    try {
      const out = await this.sudo('systemctl is-active certbot.timer 2>/dev/null');
      timerActive = out === 'active';
    } catch {}
    // Also check snap timer and cron as alternatives
    let cronRenewal = false;
    if (!timerActive) {
      try {
        const out = await this.sudo('cat /etc/cron.d/certbot 2>/dev/null || crontab -l 2>/dev/null');
        cronRenewal = out.includes('certbot');
      } catch {}
      if (!cronRenewal) {
        try {
          const out = await this.sudo('systemctl is-active snap.certbot.renew.timer 2>/dev/null');
          timerActive = out === 'active';
        } catch {}
      }
    }
    checks.push({
      name: 'Auto-Renewal',
      status: timerActive || cronRenewal ? 'ok' : 'warn',
      detail: timerActive ? 'Renewal timer is active'
        : cronRenewal ? 'Cron-based renewal configured'
        : 'No auto-renewal detected — certificates may expire',
    });

    // List certificates
    try {
      const out = await this.sudo('certbot certificates 2>/dev/null');
      const certs = out.match(/Certificate Name: (.+)/g);
      const count = certs ? certs.length : 0;
      const expiring = out.match(/INVALID: EXPIRED|WILL EXPIRE SOON/gi);
      checks.push({
        name: 'Certificates',
        status: count > 0 ? (expiring ? 'warn' : 'ok') : 'ok',
        detail: count > 0
          ? `${count} certificate(s) managed${expiring ? ' — some expiring/expired!' : ''}`
          : 'No certificates managed yet',
      });
    } catch {}

    // Port 80 accessible (needed for HTTP-01 challenge)
    const port80 = await this.portListening(80);
    checks.push({ name: 'Port 80 (HTTP)', status: port80 ? 'ok' : 'warn', detail: port80 ? 'Port 80 is listening (needed for HTTP-01 challenges)' : 'Port 80 not listening — HTTP-01 challenges will fail' });

    return checks;
  }

  private async diagnoseWpCli(): Promise<DiagnoseCheck[]> {
    const checks: DiagnoseCheck[] = [];

    const installed = await this.which('wp');
    let version = '';
    if (installed) {
      try {
        const out = (await exec('wp --version 2>/dev/null')).stdout.trim();
        const m = out.match(/WP-CLI (\S+)/);
        if (m) version = m[1];
      } catch {}
    }
    checks.push({ name: 'WP-CLI Binary', status: installed ? 'ok' : 'error', detail: installed ? `WP-CLI v${version}` : 'wp command not found — not installed' });

    // PHP CLI required
    let phpCli = false;
    let phpVer = '';
    try {
      const out = (await exec('php --version 2>/dev/null')).stdout;
      phpCli = true;
      const m = out.match(/PHP (\d+\.\d+\.\d+)/);
      if (m) phpVer = m[1];
    } catch {}
    checks.push({ name: 'PHP CLI', status: phpCli ? 'ok' : 'error', detail: phpCli ? `PHP ${phpVer} available (required by WP-CLI)` : 'PHP CLI not found — WP-CLI requires PHP' });

    // MySQL/MariaDB (WordPress dependency)
    const mysqlRunning = await this.serviceRunning('mysql') || await this.serviceRunning('mariadb');
    checks.push({ name: 'MySQL / MariaDB', status: mysqlRunning ? 'ok' : 'warn', detail: mysqlRunning ? 'Database server is running' : 'Database not running — WordPress sites won\'t be accessible' });

    // Check for WordPress installations
    if (installed) {
      try {
        const out = await this.sudo(`find /var/www -maxdepth 3 -name 'wp-config.php' 2>/dev/null`);
        const sites = out.split('\n').filter(Boolean);
        checks.push({
          name: 'WordPress Sites',
          status: sites.length > 0 ? 'ok' : 'ok',
          detail: sites.length > 0
            ? `${sites.length} WordPress installation(s) found`
            : 'No WordPress installations found in /var/www',
        });
      } catch {}

      // Check for updates available
      try {
        const out = (await exec('wp cli check-update 2>/dev/null')).stdout.trim();
        const hasUpdate = out.includes('Success') === false && out.length > 0 && !out.includes('WP-CLI is at the latest');
        checks.push({ name: 'WP-CLI Updates', status: hasUpdate ? 'warn' : 'ok', detail: hasUpdate ? 'A WP-CLI update is available' : 'WP-CLI is up to date' });
      } catch {}
    }

    return checks;
  }

  private async diagnosePgAdmin(): Promise<DiagnoseCheck[]> {
    const checks: DiagnoseCheck[] = [];

    // Check if pgadmin4 is installed
    let installed = false;
    let version = '';
    try {
      const v = await this.sudo(`dpkg -s pgadmin4-web 2>/dev/null | grep '^Version:' | awk '{print $2}'`);
      if (v) { installed = true; version = v; }
    } catch {}
    if (!installed) {
      try {
        const v = await this.sudo(`dpkg -s pgadmin4 2>/dev/null | grep '^Version:' | awk '{print $2}'`);
        if (v) { installed = true; version = v; }
      } catch {}
    }
    checks.push({ name: 'pgAdmin Package', status: installed ? 'ok' : 'error', detail: installed ? `pgadmin4 v${version} installed` : 'pgAdmin is not installed' });

    // Check PostgreSQL
    const pgRunning = await this.serviceRunning('postgresql');
    checks.push({ name: 'PostgreSQL', status: pgRunning ? 'ok' : 'error', detail: pgRunning ? 'PostgreSQL is running' : 'PostgreSQL is NOT running — pgAdmin requires it' });

    // Check nginx
    const nginxRunning = await this.serviceRunning('nginx');
    checks.push({ name: 'Nginx', status: nginxRunning ? 'ok' : 'error', detail: nginxRunning ? 'Nginx is running' : 'Nginx is NOT running' });

    // Check nginx config snippet
    const snippetExists = await this.fileExists('/etc/nginx/snippets/pgadmin.conf');
    checks.push({ name: 'Nginx pgAdmin Config', status: snippetExists ? 'ok' : 'warn', detail: snippetExists ? 'snippets/pgadmin.conf exists' : 'pgAdmin nginx snippet not found' });

    // Check if pgAdmin web is reachable
    let httpStatus = '';
    try {
      httpStatus = await this.sudo(`curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://localhost/pgadmin/ 2>/dev/null`);
    } catch { httpStatus = '000'; }
    const httpOk = httpStatus.startsWith('2') || httpStatus.startsWith('3');
    checks.push({
      name: 'HTTP Response',
      status: httpOk ? 'ok' : 'warn',
      detail: httpOk ? `HTTP ${httpStatus} — pgAdmin is reachable`
        : httpStatus === '502' ? 'HTTP 502 — pgAdmin service may not be running'
        : httpStatus === '404' ? 'HTTP 404 — Nginx not proxying to pgAdmin'
        : `HTTP ${httpStatus} — pgAdmin may not be configured yet`,
    });

    return checks;
  }

  // ─── Roundcube ──────────────────────────────────────────────────────

  private async roundcubeStatus(): Promise<AppStatus> {
    const installed = await this.fileExists('/usr/share/roundcube/index.php');
    const running = installed && (await this.serviceRunning('nginx') || await this.serviceRunning('apache2'));
    let version = '';
    if (installed) {
      version = await this.pkgVersion('roundcube-core');
    }
    return { id: 'roundcube', installed, running, version, url: '/mail (webmail domain)' };
  }

  private async installRoundcube(): Promise<{ success: boolean; message: string; logs?: string }> {
    try {
      const scriptsDir = path.join(process.cwd(), '..', 'scripts', 'email');
      const script = path.join(scriptsDir, 'install-roundcube.sh');

      // Detect a sensible default webmail domain
      let webmailDomain = 'webmail.localhost';
      try {
        const settings = await fs.readFile(
          path.join(process.cwd(), 'server-settings.json'), 'utf-8',
        );
        const parsed = JSON.parse(settings);
        if (parsed.primaryDomain) {
          webmailDomain = `webmail.${parsed.primaryDomain}`;
        }
      } catch { /* use default */ }

      const { stdout, stderr } = await exec(`sudo bash ${script} '${webmailDomain}'`, { timeout: 300_000 });
      const logs = [stdout?.trim(), stderr?.trim()].filter(Boolean).join('\n');
      return {
        success: true,
        message: `Roundcube installed. Access via: http://${webmailDomain}`,
        logs,
      };
    } catch (e: any) {
      this.logger.error(`Roundcube install failed: ${e.message}`);
      return { success: false, message: e.message };
    }
  }

  private async uninstallRoundcube(): Promise<{ success: boolean; message: string }> {
    try {
      const scriptsDir = path.join(process.cwd(), '..', 'scripts', 'email');
      const script = path.join(scriptsDir, 'uninstall-roundcube.sh');

      let webmailDomain = 'webmail.localhost';
      try {
        const settings = await fs.readFile(
          path.join(process.cwd(), 'server-settings.json'), 'utf-8',
        );
        const parsed = JSON.parse(settings);
        if (parsed.primaryDomain) {
          webmailDomain = `webmail.${parsed.primaryDomain}`;
        }
      } catch { /* use default */ }

      await exec(`sudo bash ${script} '${webmailDomain}'`, { timeout: 120_000 });
      return { success: true, message: 'Roundcube uninstalled' };
    } catch (e: any) {
      this.logger.error(`Roundcube uninstall failed: ${e.message}`);
      return { success: false, message: e.message };
    }
  }

  private async diagnoseRoundcube(): Promise<DiagnoseCheck[]> {
    const checks: DiagnoseCheck[] = [];

    const installed = await this.fileExists('/usr/share/roundcube/index.php');
    checks.push({
      name: 'Roundcube Package',
      status: installed ? 'ok' : 'error',
      detail: installed ? 'Roundcube is installed' : 'Roundcube is not installed',
    });

    const nginxRunning = await this.serviceRunning('nginx');
    checks.push({
      name: 'Nginx',
      status: nginxRunning ? 'ok' : 'error',
      detail: nginxRunning ? 'Nginx is running' : 'Nginx is NOT running',
    });

    // Check if any Roundcube vhost exists
    let vhostFound = false;
    try {
      const out = await this.sudo(`grep -rl 'roundcube' /etc/nginx/sites-enabled/ 2>/dev/null | head -1`);
      vhostFound = out.length > 0;
    } catch {}
    checks.push({
      name: 'Nginx Vhost',
      status: vhostFound ? 'ok' : 'warn',
      detail: vhostFound ? 'Roundcube nginx vhost found' : 'No Roundcube nginx vhost configured',
    });

    // Check Dovecot (IMAP)
    const dovecotRunning = await this.serviceRunning('dovecot');
    checks.push({
      name: 'Dovecot (IMAP)',
      status: dovecotRunning ? 'ok' : 'error',
      detail: dovecotRunning ? 'Dovecot is running' : 'Dovecot is NOT running — Roundcube needs IMAP',
    });

    // Check Postfix (SMTP)
    const postfixRunning = await this.serviceRunning('postfix');
    checks.push({
      name: 'Postfix (SMTP)',
      status: postfixRunning ? 'ok' : 'warn',
      detail: postfixRunning ? 'Postfix is running' : 'Postfix is NOT running — sending mail will fail',
    });

    return checks;
  }
}
