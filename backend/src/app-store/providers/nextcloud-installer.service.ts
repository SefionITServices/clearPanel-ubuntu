import { Injectable, Logger } from '@nestjs/common';
import { exec as execCb } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomBytes } from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { WebServerService } from '../../webserver/webserver.service';
import { SslService } from '../../ssl/ssl.service';

const execAsync = promisify(execCb);

@Injectable()
export class NextcloudInstallerService {
  private readonly logger = new Logger(NextcloudInstallerService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly web: WebServerService,
    private readonly ssl: SslService,
  ) {}

  private async sudo(cmd: string, timeout = 120_000) {
    try {
      const { stdout } = await execAsync(`sudo -n ${cmd}`, { timeout });
      return stdout.trim();
    } catch (e: any) {
      // Retry without -n to surface password prompts in logs if needed
      const { stdout } = await execAsync(`sudo ${cmd}`, { timeout });
      return stdout.trim();
    }
  }

  private genPassword(len = 20) {
    return randomBytes(len).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 20);
  }

  /** Minimal dry-run checks for prerequisites */
  async dryRun(domain: string) {
    const checks: { name: string; ok: boolean; detail?: string }[] = [];
    // nginx
    try {
      const v = await this.sudo('which nginx', 10_000).catch(() => '');
      checks.push({ name: 'nginx', ok: !!v, detail: v || 'nginx not found' });
    } catch (e: any) {
      checks.push({ name: 'nginx', ok: false, detail: e.message });
    }
    // php
    try {
      const v = await this.sudo('which php', 10_000).catch(() => '');
      checks.push({ name: 'php', ok: !!v, detail: v || 'php not found' });
    } catch (e: any) {
      checks.push({ name: 'php', ok: false, detail: e.message });
    }
    // bzip2
    try {
      const v = await this.sudo('which bzip2', 10_000).catch(() => '');
      checks.push({ name: 'bzip2', ok: !!v, detail: v || 'bzip2 not found' });
    } catch (e: any) {
      checks.push({ name: 'bzip2', ok: false, detail: e.message });
    }
    // database
    try {
      const status = await this.db.getStatus();
      checks.push({ name: 'database', ok: status.installed, detail: status.installed ? status.version : 'DB not installed' });
    } catch (e: any) {
      checks.push({ name: 'database', ok: false, detail: e.message });
    }
    return checks;
  }

  private async ensurePrerequisites(logs: string[]) {
    // 1. Ensure required packages are installed
    try {
      const phpVerRes = await this.sudo("php -r 'echo PHP_MAJOR_VERSION . \".\" . PHP_MINOR_VERSION;'", 10_000).catch(() => '8.4');
      const phpVer = phpVerRes || '8.4';

      const checkPkgs = await this.sudo(`dpkg -l bzip2 php${phpVer}-apcu php${phpVer}-gmp php${phpVer}-redis redis-server libmagickcore-6.q16-7-extra 2>&1 || true`, 10_000);
      const needInstall = !checkPkgs.includes('php' + phpVer + '-apcu') || !checkPkgs.includes('redis-server') || !checkPkgs.includes('bzip2');

      if (needInstall) {
        logs.push('Installing Nextcloud system prerequisites (bzip2, redis, apcu, gmp, imagick svg)...');
        await this.sudo(`apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y bzip2 redis-server php${phpVer}-apcu php${phpVer}-gmp php${phpVer}-redis libmagickcore-6.q16-7-extra || DEBIAN_FRONTEND=noninteractive apt-get install -y bzip2 redis-server php${phpVer}-apcu php${phpVer}-gmp php${phpVer}-redis libmagickcore-6.q16-6-extra || true`, 180_000);
      }
      await this.sudo('systemctl enable --now redis-server || true', 10_000);

      // 2. Configure PHP FPM & CLI optimizations
      const iniContent = `output_buffering = Off
memory_limit = 512M
upload_max_filesize = 512M
post_max_size = 512M
max_execution_time = 360
max_input_time = 360
opcache.enable = 1
opcache.interned_strings_buffer = 16
opcache.max_accelerated_files = 10000
opcache.memory_consumption = 128
opcache.save_comments = 1
opcache.revalidate_freq = 1
apc.enable_cli = 1
`;
      const fpmConfDir = `/etc/php/${phpVer}/fpm/conf.d`;
      const cliConfDir = `/etc/php/${phpVer}/cli/conf.d`;
      const tmpIni = `/tmp/99-nextcloud-${Date.now()}.ini`;
      await fs.writeFile(tmpIni, iniContent, 'utf-8');
      await this.sudo(`mkdir -p ${fpmConfDir} ${cliConfDir} && cp ${tmpIni} ${fpmConfDir}/99-nextcloud.ini && cp ${tmpIni} ${cliConfDir}/99-nextcloud.ini && rm -f ${tmpIni}`);

      // 3. Configure clear_env = no and env[PATH] in PHP-FPM www pool
      const poolConf = `/etc/php/${phpVer}/fpm/pool.d/www.conf`;
      await this.sudo(`sed -i 's/^;clear_env = no/clear_env = no/' ${poolConf} 2>/dev/null || true`);
      await this.sudo(`sed -i 's/^;env\\[PATH\\] =/env[PATH] =/' ${poolConf} 2>/dev/null || true`);
      await this.sudo(`systemctl reload php${phpVer}-fpm || systemctl reload php-fpm || true`);
      logs.push(`Configured PHP ${phpVer} FPM & CLI optimization for Nextcloud`);
    } catch (e: any) {
      logs.push(`Warning: could not configure php optimizations: ${e.message}`);
    }
  }

  async install(opts: { domain: string; adminUser?: string; adminPass?: string; adminEmail?: string; dataPath?: string; ssl?: boolean } ) {
    const logs: string[] = [];
    const domain = (opts.domain || '').trim();
    if (!domain) throw new Error('Domain is required for Nextcloud install');

    const adminUser = opts.adminUser || 'admin';
    const adminPass = opts.adminPass || this.genPassword(16);
    const adminEmail = opts.adminEmail || 'admin@' + domain;

    const baseDir = `/var/www/nextcloud/${domain}`;
    const webroot = path.posix.join(baseDir, 'html');
    const dataDir = opts.dataPath || path.posix.join(baseDir, 'data');

    try {
      // Ensure system prerequisites and PHP-FPM optimizations
      await this.ensurePrerequisites(logs);

      logs.push(`Creating webroot ${webroot} and data dir ${dataDir}`);
      await this.sudo(`mkdir -p ${webroot} ${dataDir}`);
      // Ensure ownership
      await this.sudo(`chown -R www-data:www-data ${baseDir} || true`);
      await this.sudo(`setfacl -R -m u:clearpanel:rwx ${baseDir} || true`);
      await this.sudo(`setfacl -R -d -m u:clearpanel:rwx ${baseDir} || true`);

      // Create nginx vhost
      logs.push('Configuring Nginx virtual host for Nextcloud');
      const vhost = await this.web.createNextcloudVirtualHost(domain, webroot);
      logs.push(vhost.message || 'vhost result');
      if (!vhost.success) {
        return { success: false, message: 'Failed to create vhost: ' + vhost.message, logs };
      }

      // Download Nextcloud
      logs.push('Downloading Nextcloud release (latest)');
      const tmpArchive = `/tmp/nextcloud-${Date.now()}.tar.bz2`;
      try {
        await this.sudo(`curl -fsSL -o ${tmpArchive} https://download.nextcloud.com/server/releases/latest.tar.bz2`, 180_000);
        await this.sudo(`tar -xjf ${tmpArchive} -C /tmp`, 120_000);
      } catch (e: any) {
        logs.push('Download/extract failed, trying zip release: ' + (e.message || String(e)));
        const tmpZip = `/tmp/nextcloud-${Date.now()}.zip`;
        try {
          await this.sudo(`curl -fsSL -o ${tmpZip} https://download.nextcloud.com/server/releases/latest.zip`, 180_000);
          await this.sudo(`unzip -q -o ${tmpZip} -d /tmp`, 120_000);
          await this.sudo(`rm -f ${tmpZip}`);
        } catch (zErr: any) {
          logs.push('Zip fallback failed: ' + (zErr.message || String(zErr)));
          return { success: false, message: 'Failed to download or extract Nextcloud', logs };
        }
      }

      // Move files into place (preserving all hidden dotfiles such as .htaccess and .user.ini)
      logs.push('Installing files to webroot');
      try {
        await this.sudo(`rm -rf ${webroot}/* ${webroot}/.* 2>/dev/null || true`);
        await this.sudo(`cp -a /tmp/nextcloud/. ${webroot}/ && rm -rf /tmp/nextcloud`);
        await this.sudo(`chown -R www-data:www-data ${baseDir}`);
        await this.sudo(`setfacl -R -m u:clearpanel:rwx ${baseDir} || true`);
        await this.sudo(`setfacl -R -d -m u:clearpanel:rwx ${baseDir} || true`);
        const userDir = `/home/${process.env.ADMIN_USERNAME || 'hasim751'}/${domain}`;
        await this.sudo(`if [ -d "${userDir}" ] && [ ! -L "${userDir}" ]; then rmdir "${userDir}" 2>/dev/null && ln -sf ${webroot} "${userDir}" && chown -h clearpanel:clearpanel "${userDir}"; elif [ ! -e "${userDir}" ]; then ln -sf ${webroot} "${userDir}" && chown -h clearpanel:clearpanel "${userDir}"; fi || true`);
      } catch (e: any) {
        logs.push('Failed to move files: ' + (e.message || String(e)));
        return { success: false, message: 'Failed to install Nextcloud files', logs };
      }

      // Create DB and user
      const safeDbBase = `nextcloud_${domain.replace(/[^a-z0-9]/gi, '_').slice(0, 20)}`;
      const dbPass = this.genPassword(20);
      logs.push('Creating database');
      const dbRes = await this.db.createDatabase(safeDbBase).catch((e: any) => ({ success: false, message: e?.message || String(e) }));
      logs.push(dbRes.message || JSON.stringify(dbRes));
      const dbMatch = (dbRes.message || '').match(/"([^\"]+)"/);
      const dbName = dbMatch ? dbMatch[1] : safeDbBase;

      logs.push('Creating database user');
      const userBase = `ncuser_${domain.replace(/[^a-z0-9]/gi, '_').slice(0, 16)}`;
      const userRes = await this.db.createUser(userBase, dbPass).catch((e: any) => ({ success: false, message: e?.message || String(e) }));
      logs.push(userRes.message || JSON.stringify(userRes));
      const userMatch = (userRes.message || '').match(/"([^\"]+)"/);
      const dbUser = userMatch ? userMatch[1] : userBase;

      // Grant privileges
      try {
        await this.db.grantPrivileges(dbUser, dbName);
        logs.push('Granted DB privileges via DatabaseService');
      } catch {
        try {
          await this.sudo(`mysql -e "GRANT ALL PRIVILEGES ON \\\`${dbName}\\\`.* TO '${dbUser}'@'localhost'; FLUSH PRIVILEGES;"`, 30_000);
          logs.push('Granted DB privileges');
        } catch (e2: any) {
          logs.push('Failed to grant DB privileges: ' + (e2.message || String(e2)));
        }
      }

      // Run occ maintenance:install if occ exists
      const occPath = `${webroot}/occ`;
      try {
        await this.sudo(`test -f ${occPath}`);
        logs.push('Running occ maintenance:install');
        const occCmd = `sudo -u www-data php ${occPath} maintenance:install --database "mysql" --database-name "${dbName}" --database-user "${dbUser}" --database-pass "${dbPass}" --admin-user "${adminUser}" --admin-pass "${adminPass}" --data-dir "${dataDir}"`;
        const out = await execAsync(occCmd, { timeout: 300_000 });
        if (out.stdout) logs.push(out.stdout.toString().trim());
        if (out.stderr) logs.push(out.stderr.toString().trim());
      } catch (e: any) {
        logs.push('Occ install may have failed or been skipped: ' + (e.message || String(e)));
      }

      // Ensure trusted_domains and proxy/overwrite entries
      const proto = opts.ssl ? 'https' : 'http';
      try {
        await this.sudo(`sudo -u www-data php ${occPath} config:system:set trusted_domains 0 --value="${domain}"`, 20_000);
        await this.sudo(`sudo -u www-data php ${occPath} config:system:set trusted_domains 1 --value="www.${domain}"`, 20_000).catch(() => {});
        await this.sudo(`sudo -u www-data php ${occPath} config:system:set overwrite.cli.url --value="${proto}://${domain}"`, 20_000).catch(() => {});
        await this.sudo(`sudo -u www-data php ${occPath} config:system:set overwritehost --value="${domain}"`, 20_000).catch(() => {});
        if (opts.ssl) {
          await this.sudo(`sudo -u www-data php ${occPath} config:system:set overwriteprotocol --value="https"`, 20_000).catch(() => {});
        }
        await this.sudo(`sudo -u www-data php ${occPath} config:system:set default_phone_region --value="IN"`, 20_000).catch(() => {});
        await this.sudo(`sudo -u www-data php ${occPath} config:system:set memcache.local --value="\\OC\\Memcache\\APCu"`, 20_000).catch(() => {});
        await this.sudo(`sudo -u www-data php ${occPath} config:system:set memcache.distributed --value="\\OC\\Memcache\\Redis"`, 20_000).catch(() => {});
        await this.sudo(`sudo -u www-data php ${occPath} config:system:set memcache.locking --value="\\OC\\Memcache\\Redis"`, 20_000).catch(() => {});
        await this.sudo(`sudo -u www-data php ${occPath} config:system:set redis host --value="127.0.0.1"`, 20_000).catch(() => {});
        await this.sudo(`sudo -u www-data php ${occPath} config:system:set redis port --type=integer --value=6379`, 20_000).catch(() => {});
        await this.sudo(`sudo -u www-data php ${occPath} config:system:set maintenance_window_start --type=integer --value=1`, 20_000).catch(() => {});
        await this.sudo(`sudo -u www-data php ${occPath} config:system:set server_id --value="1"`, 20_000).catch(() => {});
        await this.sudo(`sudo -u www-data php ${occPath} maintenance:repair --include-expensive`, 120_000).catch(() => {});
        await this.sudo(`sudo -u www-data php ${occPath} background:cron`, 20_000).catch(() => {});

        // Setup 5-minute system background cron
        const cronDomain = domain.replace(/[^a-z0-9]/gi, '-');
        const cronFile = `/etc/cron.d/nextcloud-${cronDomain}`;
        const cronEntry = `*/5 * * * * www-data php -f ${webroot}/cron.php\n`;
        const tmpCron = `/tmp/nc-cron-${Date.now()}`;
        await fs.writeFile(tmpCron, cronEntry, 'utf-8');
        await this.sudo(`mv ${tmpCron} ${cronFile} && chmod 644 ${cronFile}`).catch(() => {});

        logs.push('Configured trusted_domains, caching, phone region, and system cron job');
      } catch (e: any) {
        logs.push('Failed to configure trusted_domains: ' + (e.message || String(e)));
      }

      // Request SSL if requested
      if (opts.ssl) {
        logs.push('Requesting SSL certificate');
        const sslRes = await this.ssl.installCertificate(domain, adminEmail, true).catch((e: any) => ({ success: false, message: e?.message || String(e), logs: [] }));
        logs.push(...(sslRes.logs || []));
        if (!sslRes.success) {
          logs.push('SSL install reported failure: ' + sslRes.message);
        } else {
          logs.push('SSL installed successfully');
          try {
            await this.sudo(`sudo -u www-data php ${occPath} config:system:set overwriteprotocol --value="https"`, 20_000);
            await this.sudo(`sudo -u www-data php ${occPath} config:system:set overwrite.cli.url --value="https://${domain}"`, 20_000);
            await this.web.createNextcloudVirtualHost(domain, webroot);
            logs.push('Re-applied Nextcloud SSL virtual host');
          } catch (sslErr: any) {
            logs.push('Warning during SSL post-config: ' + (sslErr.message || String(sslErr)));
          }
        }
      }

      return { success: true, message: `Nextcloud installed for ${domain}`, logs };
    } catch (e: any) {
      logs.push('Unexpected error: ' + (e.message || String(e)));
      this.logger.error(`Nextcloud install error for ${domain}: ${e?.message || e}`);
      return { success: false, message: e?.message || String(e), logs };
    }
  }

  async uninstall(opts: { domain: string; keepData?: boolean }) {
    const domain = opts.domain;
    const logs: string[] = [];
    if (!domain) throw new Error('Domain required');
    const baseDir = `/var/www/nextcloud/${domain}`;
    const webroot = path.posix.join(baseDir, 'html');
    const dataDir = path.posix.join(baseDir, 'data');

    try {
      // Remove vhost
      logs.push('Removing virtual host');
      const r = await this.web.removeVirtualHost(domain).catch((e: any) => ({ success: false, message: e?.message || String(e) }));
      logs.push(r.message || JSON.stringify(r));

      // Drop DB (best effort) - try to detect db/user by naming convention
      const dbBase = `nextcloud_${domain.replace(/[^a-z0-9]/gi, '_').slice(0, 20)}`;
      try {
        const dbRes = await this.db.deleteDatabase(`${process.env.PANEL_USERNAME || 'cp'}_${dbBase}`).catch(() => null);
        if (dbRes) logs.push(dbRes.message || JSON.stringify(dbRes));
      } catch {}

      // Remove cron job
      const cronDomain = domain.replace(/[^a-z0-9]/gi, '-');
      await this.sudo(`rm -f /etc/cron.d/nextcloud-${cronDomain}`).catch(() => {});

      // Remove files
      if (!opts.keepData) {
        logs.push('Removing files');
        try { await this.sudo(`rm -rf ${baseDir}`); logs.push('Files removed'); } catch (e: any) { logs.push('Failed to remove files: ' + e.message); }
      } else {
        logs.push('Keeping data directory as requested');
      }

      // Remove symlink in user home if it was symlinked
      try {
        const userDir = `/home/${process.env.ADMIN_USERNAME || 'hasim751'}/${domain}`;
        await this.sudo(`if [ -L "${userDir}" ]; then rm -f "${userDir}"; fi || true`);
      } catch {}

      return { success: true, message: `Nextcloud uninstalled for ${domain}`, logs };
    } catch (e: any) {
      logs.push('Uninstall error: ' + (e.message || String(e)));
      return { success: false, message: e?.message || String(e), logs };
    }
  }
}
