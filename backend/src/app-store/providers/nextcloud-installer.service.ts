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
    // database
    try {
      const status = await this.db.getStatus();
      checks.push({ name: 'database', ok: status.installed, detail: status.installed ? status.version : 'DB not installed' });
    } catch (e: any) {
      checks.push({ name: 'database', ok: false, detail: e.message });
    }
    // DNS / vhost not required yet
    return checks;
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
      logs.push(`Creating webroot ${webroot} and data dir ${dataDir}`);
      await this.sudo(`mkdir -p ${webroot} ${dataDir}`);
      // Ensure ownership
      await this.sudo(`chown -R www-data:www-data ${baseDir} || true`);

      // Create nginx vhost
      logs.push('Configuring Nginx virtual host');
      const vhost = await this.web.createVirtualHost(domain, webroot);
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
        logs.push('Download/extract failed: ' + (e.message || String(e)));
        return { success: false, message: 'Failed to download or extract Nextcloud', logs };
      }

      // Move files into place
      logs.push('Installing files to webroot');
      try {
        // Remove any existing content
        await this.sudo(`rm -rf ${webroot}/* || true`);
        await this.sudo(`mv /tmp/nextcloud/* ${webroot}`);
        await this.sudo(`chown -R www-data:www-data ${baseDir}`);
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

      // Grant privileges (use mysql command directly)
      try {
        await this.sudo(`mysql -e "GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${dbUser}'@'localhost' IDENTIFIED BY '${dbPass}'; FLUSH PRIVILEGES;"`, 30_000);
        logs.push('Granted DB privileges');
      } catch (e: any) {
        logs.push('Failed to grant DB privileges: ' + (e.message || String(e)));
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

      // Ensure trusted_domains entries
      try {
        await this.sudo(`sudo -u www-data php ${occPath} config:system:set trusted_domains 0 --value="${domain}"`, 20_000);
        await this.sudo(`sudo -u www-data php ${occPath} config:system:set trusted_domains 1 --value="www.${domain}"`, 20_000).catch(() => {});
        logs.push('Configured trusted_domains');
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

      // Remove files
      if (!opts.keepData) {
        logs.push('Removing files');
        try { await this.sudo(`rm -rf ${baseDir}`); logs.push('Files removed'); } catch (e: any) { logs.push('Failed to remove files: ' + e.message); }
      } else {
        logs.push('Keeping data directory as requested');
      }

      return { success: true, message: `Nextcloud uninstalled for ${domain}`, logs };
    } catch (e: any) {
      logs.push('Uninstall error: ' + (e.message || String(e)));
      return { success: false, message: e?.message || String(e), logs };
    }
  }
}
