import { Injectable } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PhpService } from '../php/php.service';

const execAsync = promisify(exec);

@Injectable()
export class WebServerService {
  private nginxAvailable = false;

  constructor(private readonly phpService: PhpService) {}

  async onModuleInit() {
    await this.checkNginx();
  }

  private async ensureNginxAvailable(): Promise<boolean> {
    if (this.nginxAvailable) {
      return true;
    }

    // Nginx may be installed after the backend starts.
    await this.checkNginx();
    return this.nginxAvailable;
  }

  private async checkNginx(): Promise<void> {
    try {
      await execAsync('which nginx', { timeout: 10_000 });
      this.nginxAvailable = true;
      console.log('✅ Nginx detected');
    } catch {
      this.nginxAvailable = false;
      console.log('⚠️  Nginx not installed - web server automation disabled');
    }
  }

  /** Resolve a PHP-FPM socket, honoring an optional explicit PHP version. */
  private async resolvePhpSocket(phpVersion?: string): Promise<string> {
    if (phpVersion) {
      const explicit = this.phpService.getFpmSocket(phpVersion);
      try {
        await fs.access(explicit);
        return explicit;
      } catch {
        // Fall through to auto-detect if the requested socket does not exist
      }
    }
    return this.phpService.getActiveFpmSocket();
  }

  async installNginx(): Promise<{ success: boolean; message: string }> {
    try {
      console.log('Installing nginx...');
      await execAsync('sudo apt update && sudo apt install -y nginx', { timeout: 120_000 });
      this.nginxAvailable = true;
      await execAsync('sudo systemctl enable nginx', { timeout: 30_000 });
      await execAsync('sudo systemctl start nginx', { timeout: 30_000 });
      return { success: true, message: 'Nginx installed successfully' };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, message: `Failed to install nginx: ${msg}` };
    }
  }

  async ensureVirtualHost(
    domain: string,
    documentRoot: string,
    phpVersion?: string,
  ): Promise<{ success: boolean; message: string; created: boolean; nginxConfig?: string }> {
    const available = await this.ensureNginxAvailable();
    if (!available) {
      return {
        success: false,
        created: false,
        message: 'Nginx not available. Install nginx first.',
      };
    }

    const configPath = `/etc/nginx/sites-available/${domain}`;
    const symlinkPath = `/etc/nginx/sites-enabled/${domain}`;

    const configExists = await fs
      .access(configPath)
      .then(() => true)
      .catch(() => false);

    if (configExists) {
      // Ensure the site is enabled.
      try {
        const linkTarget = await fs.readlink(symlinkPath);
        if (linkTarget !== configPath) {
          try { await fs.unlink(symlinkPath); } catch {}
          try {
            await fs.symlink(configPath, symlinkPath);
          } catch {
            await execAsync(`sudo ln -sf ${configPath} ${symlinkPath}`, { timeout: 10_000 });
          }
        }
      } catch {
        // Missing symlink; create it.
        try {
          await fs.symlink(configPath, symlinkPath);
        } catch {
          await execAsync(`sudo ln -sf ${configPath} ${symlinkPath}`, { timeout: 10_000 });
        }
      }

      // Validate and reload nginx so the vhost takes effect.
      await execAsync('sudo nginx -t', { timeout: 15_000 });
      await execAsync('sudo systemctl reload nginx', { timeout: 30_000 });

      return {
        success: true,
        created: false,
        message: `Virtual host already present for ${domain}`,
      };
    }

    const created = await this.createVirtualHost(domain, documentRoot, phpVersion);
    return {
      success: created.success,
      created: created.success,
      message: created.message,
      nginxConfig: created.nginxConfig,
    };
  }

  async createVirtualHost(
    domain: string,
    documentRoot: string,
    phpVersion?: string,
  ): Promise<{ success: boolean; message: string; nginxConfig?: string }> {
    const available = await this.ensureNginxAvailable();
    if (!available) {
      return { success: false, message: 'Nginx not available. Install nginx first.' };
    }

    // Detect the PHP-FPM socket (per-domain when specified)
    const phpSocket = await this.resolvePhpSocket(phpVersion);

    const configContent = `server {
    listen 80;
    listen [::]:80;
    server_name ${domain} www.${domain};
    
    root ${documentRoot};
    index index.html index.htm index.php;
    
    # Logging
    access_log /var/log/nginx/${domain}-access.log;
    error_log /var/log/nginx/${domain}-error.log;
    
    # Main location
    location / {
        try_files $uri $uri/ =404;
    }
    
    # PHP support (if PHP-FPM is installed)
    location ~ \\.php$ {
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        fastcgi_pass unix:${phpSocket};
        fastcgi_index index.php;
    }
    
    # Deny access to hidden files
    location ~ /\\. {
        deny all;
    }
}`;

    const configPath = `/etc/nginx/sites-available/${domain}`;
    const symlinkPath = `/etc/nginx/sites-enabled/${domain}`;

    try {
      // Write config file (clearpanel owns sites-available; fallback to sudo tee)
      try {
        await fs.writeFile(configPath, configContent, { encoding: 'utf8', mode: 0o644 });
      } catch {
        // Fallback: write via temp file + sudo tee
        const tmpFile = `/tmp/nginx-${domain}-${Date.now()}.conf`;
        await fs.writeFile(tmpFile, configContent, { encoding: 'utf8' });
        await execAsync(`sudo tee ${configPath} < ${tmpFile} > /dev/null`, { timeout: 10_000 });
        await fs.unlink(tmpFile).catch(() => {});
      }

      // Create symlink (clearpanel owns sites-enabled; fallback to sudo)
      try {
        try { await fs.unlink(symlinkPath); } catch {}
        await fs.symlink(configPath, symlinkPath);
      } catch {
        await execAsync(`sudo ln -sf ${configPath} ${symlinkPath}`, { timeout: 10_000 });
      }

      // Test nginx config
      try {
        await execAsync('sudo nginx -t', { timeout: 15_000 });
      } catch {
        // If test fails, remove bad config and report
        try { await fs.unlink(symlinkPath); } catch {}
        try { await fs.unlink(configPath); } catch {}
        return {
          success: false,
          message: `Nginx config test failed for ${domain}. Config was removed.`,
        };
      }

      // Reload nginx
      await execAsync('sudo systemctl reload nginx', { timeout: 30_000 });
      
      return {
        success: true,
        message: `Virtual host created for ${domain}`,
        nginxConfig: configContent
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message:
          `Failed to create virtual host: ${msg}. ` +
          `If this mentions sudo, fix systemd unit (NoNewPrivileges) and sudoers for clearpanel.`,
      };
    }
  }

  async getVhostConfig(domain: string): Promise<{ success: boolean; config?: string; path?: string; enabled?: boolean; message?: string }> {
    const configPath = `/etc/nginx/sites-available/${domain}`;
    const symlinkPath = `/etc/nginx/sites-enabled/${domain}`;
    try {
      const config = await fs.readFile(configPath, 'utf-8');
      const enabled = await fs.access(symlinkPath).then(() => true).catch(() => false);
      return { success: true, config, path: configPath, enabled };
    } catch {
      return { success: false, message: `No virtual host config found for ${domain}` };
    }
  }

  async saveVhostConfig(domain: string, config: string): Promise<{ success: boolean; message: string }> {
    const available = await this.ensureNginxAvailable();
    if (!available) {
      return { success: false, message: 'Nginx not available. Install nginx first.' };
    }
    const configPath = `/etc/nginx/sites-available/${domain}`;
    try {
      // Write config
      try {
        await fs.writeFile(configPath, config, { encoding: 'utf8', mode: 0o644 });
      } catch {
        const tmpFile = `/tmp/nginx-${domain}-${Date.now()}.conf`;
        await fs.writeFile(tmpFile, config, { encoding: 'utf8' });
        await execAsync(`sudo tee ${configPath} < ${tmpFile} > /dev/null`, { timeout: 10_000 });
        await fs.unlink(tmpFile).catch(() => {});
      }
      // Test nginx config
      try {
        await execAsync('sudo nginx -t', { timeout: 15_000 });
      } catch (e) {
        return { success: false, message: `Nginx config test failed. Please fix the syntax. Error: ${e instanceof Error ? e.message : String(e)}` };
      }
      // Reload nginx
      await execAsync('sudo systemctl reload nginx', { timeout: 30_000 });
      return { success: true, message: `Virtual host config updated and nginx reloaded for ${domain}` };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, message: `Failed to save vhost config: ${msg}` };
    }
  }

  async removeVirtualHost(domain: string): Promise<{ success: boolean; message: string }> {
    const available = await this.ensureNginxAvailable();
    if (!available) {
      return { success: false, message: 'Nginx not available' };
    }

    try {
      // Remove symlink
      await execAsync(`sudo rm -f /etc/nginx/sites-enabled/${domain}`, { timeout: 10_000 });
      
      // Remove config
      await execAsync(`sudo rm -f /etc/nginx/sites-available/${domain}`, { timeout: 10_000 });
      
      // Reload nginx
      await execAsync('sudo systemctl reload nginx', { timeout: 30_000 });
      
      return { success: true, message: `Virtual host removed for ${domain}` };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, message: `Failed to remove virtual host: ${msg}` };
    }
  }

  async getNginxStatus(): Promise<{ installed: boolean; running: boolean; version?: string }> {
    const result: { installed: boolean; running: boolean; version?: string } = {
      installed: this.nginxAvailable,
      running: false
    };

    if (!this.nginxAvailable) {
      return result;
    }

    try {
      const { stdout } = await execAsync('nginx -v 2>&1', { timeout: 10_000 });
      result.version = stdout.trim();
    } catch {}

    try {
      const { stdout } = await execAsync('sudo systemctl is-active nginx', { timeout: 30_000 });
      result.running = stdout.trim() === 'active';
    } catch {}

    return result;
  }

  getDNSInstructions(domain: string, serverIp: string): string {
    return `To make ${domain} accessible on the internet:

1. Log in to your domain registrar (GoDaddy, Namecheap, etc.)
2. Go to DNS Management for ${domain}
3. Add these DNS records:

   Type: A
   Name: @ (or leave blank for root domain)
   Value: ${serverIp}
   TTL: 3600 (or Auto)

   Type: A
   Name: www
   Value: ${serverIp}
   TTL: 3600

4. Save changes and wait 5-30 minutes for DNS propagation

After DNS propagates, your site will be accessible at:
- http://${domain}
- http://www.${domain}

To verify DNS propagation:
- Run: dig ${domain} +short
- Or visit: https://dnschecker.org/#A/${domain}
`;
  }
}
