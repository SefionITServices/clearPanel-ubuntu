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
    await this.ensureMimeTypes();
  }

  async ensureMimeTypes(): Promise<void> {
    try {
      const mimePath = '/etc/nginx/mime.types';
      const content = await fs.readFile(mimePath, 'utf-8');
      if (!content.includes('js mjs;') && !content.includes(' mjs;')) {
        const updated = content.replace(
          /(application\/javascript\s+js);/,
          '$1 mjs;'
        );
        if (updated !== content) {
          try {
            await fs.writeFile(mimePath, updated, 'utf-8');
          } catch {
            const tmpFile = `/tmp/mime.types-${Date.now()}`;
            await fs.writeFile(tmpFile, updated, 'utf-8');
            await execAsync(`sudo tee ${mimePath} < ${tmpFile} > /dev/null`);
            await fs.unlink(tmpFile).catch(() => {});
          }
          await execAsync('sudo nginx -t && sudo systemctl reload nginx').catch(() => {});
        }
      }
    } catch {}
  }

  async ensureNextcloudGlobalConfig(): Promise<void> {
    try {
      const mapPath = '/etc/nginx/conf.d/nextcloud.conf';
      const exists = await fs.access(mapPath).then(() => true).catch(() => false);
      if (!exists) {
        const content = `# Global map for Nextcloud asset cache-busting
map $arg_v $asset_immutable {
    "" "";
    default ", immutable";
}
`;
        try {
          await fs.writeFile(mapPath, content, { encoding: 'utf8', mode: 0o644 });
        } catch {
          const tmpFile = `/tmp/nextcloud-map-${Date.now()}.conf`;
          await fs.writeFile(tmpFile, content, 'utf-8');
          await execAsync(`sudo mkdir -p /etc/nginx/conf.d && sudo tee ${mapPath} < ${tmpFile} > /dev/null`);
          await fs.unlink(tmpFile).catch(() => {});
        }
      }
    } catch {}
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

      // Ensure conflicting Apache web server cannot hijack ports 80/443
      try {
        await execAsync('sudo systemctl stop apache2 2>/dev/null; sudo systemctl disable apache2 2>/dev/null; sudo systemctl mask apache2 2>/dev/null || true', { timeout: 10_000 });
      } catch {}

      // Ensure Nginx service is running
      try {
        const { stdout } = await execAsync('systemctl is-active nginx', { timeout: 5000 });
        if (stdout.trim() !== 'active') {
          await execAsync('sudo systemctl enable nginx && sudo systemctl start nginx', { timeout: 15_000 });
        }
      } catch {
        await execAsync('sudo systemctl enable nginx && sudo systemctl start nginx', { timeout: 15_000 }).catch(() => {});
      }
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
      // Disable conflicting web servers like Apache first
      await execAsync('sudo systemctl stop apache2 2>/dev/null || true; sudo systemctl disable apache2 2>/dev/null || true; sudo systemctl mask apache2 2>/dev/null || true', { timeout: 15_000 }).catch(() => {});
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
    proxyPort?: number,
    proxyHost?: string,
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

    const created = await this.createVirtualHost(domain, documentRoot, phpVersion, proxyPort, proxyHost);
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
    proxyPort?: number,
    proxyHost?: string,
  ): Promise<{ success: boolean; message: string; nginxConfig?: string }> {
    const available = await this.ensureNginxAvailable();
    if (!available) {
      return { success: false, message: 'Nginx not available. Install nginx first.' };
    }

    // Auto-detect Nextcloud installations and use specialized Nextcloud configuration
    if (!proxyPort) {
      const isNextcloud =
        documentRoot.includes('/nextcloud/') ||
        (await fs.access(path.join(documentRoot, 'occ')).then(() => true).catch(() => false));
      if (isNextcloud) {
        return this.createNextcloudVirtualHost(domain, documentRoot, phpVersion);
      }
    }

    // Detect the PHP-FPM socket (per-domain when specified)
    const phpSocket = await this.resolvePhpSocket(phpVersion);

    const normalizedProxyHost = (proxyHost || '127.0.0.1').trim();

    const locationBlock = proxyPort
      ? `    # Reverse proxy to app running on localhost:${proxyPort}
    location / {
        proxy_pass http://${normalizedProxyHost}:${proxyPort};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }`
      : `    # Main location
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # PHP support (if PHP-FPM is installed)
    location ~ \\.php$ {
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        fastcgi_pass unix:${phpSocket};
        fastcgi_index index.php;
    }`;

    await this.ensureEmailAutoconfigSnippet();

    const configContent = `server {
    listen 80;
    listen [::]:80;
    server_name ${domain} www.${domain};
    
    root ${documentRoot};
    index index.html index.htm index.php;
    
    # Logging
    access_log /var/log/nginx/${domain}-access.log;
    error_log /var/log/nginx/${domain}-error.log;
    
    # Email autoconfig & Roundcube webmail
    include /etc/nginx/snippets/clearpanel-roundcube.conf;

  ${locationBlock}
    
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

  async createNextcloudVirtualHost(
    domain: string,
    documentRoot: string,
    phpVersion?: string,
  ): Promise<{ success: boolean; message: string; nginxConfig?: string }> {
    const available = await this.ensureNginxAvailable();
    if (!available) {
      return { success: false, message: 'Nginx not available. Install nginx first.' };
    }

    await this.ensureMimeTypes();
    await this.ensureNextcloudGlobalConfig();

    const phpSocket = await this.resolvePhpSocket(phpVersion);

    const certPath = `/etc/letsencrypt/live/${domain}/fullchain.pem`;
    const keyPath = `/etc/letsencrypt/live/${domain}/privkey.pem`;
    const sslExists =
      (await fs.access(certPath).then(() => true).catch(() => false)) &&
      (await fs.access(keyPath).then(() => true).catch(() => false));

    const listenBlock = sslExists
      ? `    listen [::]:443 ssl http2;
    listen 443 ssl http2;
    ssl_certificate ${certPath};
    ssl_certificate_key ${keyPath};
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;`
      : `    listen 80;
    listen [::]:80;`;

    const redirectBlock = sslExists
      ? `\nserver {
    if ($host = ${domain}) {
        return 301 https://$host$request_uri;
    }

    listen 80;
    listen [::]:80;
    server_name ${domain} www.${domain};
    return 404;
}\n`
      : '';

    const safeDomain = domain.replace(/[^a-z0-9]/gi, '_');

    const configContent = `upstream php-handler-${safeDomain} {
    server unix:${phpSocket};
}

server {
    server_name ${domain} www.${domain};

    root ${documentRoot};
    index index.php index.html /index.php$request_uri;

    access_log /var/log/nginx/${domain}-access.log;
    error_log /var/log/nginx/${domain}-error.log;

    client_max_body_size 512M;
    client_body_timeout 300s;
    client_body_buffer_size 512k;

    gzip on;
    gzip_vary on;
    gzip_comp_level 4;
    gzip_min_length 256;
    gzip_proxied expired no-cache no-store private no_last_modified no_etag auth;
    gzip_types application/atom+xml text/javascript application/javascript application/json application/ld+json application/manifest+json application/rss+xml application/vnd.geo+json application/vnd.ms-fontobject application/wasm application/x-font-ttf application/x-web-app-manifest+json application/xhtml+xml application/xml font/opentype image/bmp image/svg+xml image/x-icon text/cache-manifest text/css text/plain text/vcard text/vnd.rim.location.xloc text/vtt text/x-component text/x-cross-domain-policy;

    add_header Strict-Transport-Security "max-age=15552000; includeSubDomains" always;
    add_header Referrer-Policy "no-referrer" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Permitted-Cross-Domain-Policies "none" always;
    add_header X-Robots-Tag "noindex, nofollow" always;
    fastcgi_hide_header X-Powered-By;

    location = / {
        if ( $http_user_agent ~ ^DavClnt ) {
            return 302 /remote.php/webdav/$is_args$args;
        }
    }

    location = /robots.txt {
        allow all;
        log_not_found off;
        access_log off;
    }

    location ^~ /.well-known {
        location = /.well-known/carddav { return 301 /remote.php/dav/; }
        location = /.well-known/caldav  { return 301 /remote.php/dav/; }

        location /.well-known/acme-challenge { try_files $uri $uri/ =404; }
        location /.well-known/pki-validation { try_files $uri $uri/ =404; }

        return 301 /index.php$request_uri;
    }

    location ~ ^/(?:build|tests|config|lib|3rdparty|templates|data)(?:$|/) {
        return 404;
    }
    location ~ ^/(?:\\.|autotest|occ|issue|indie|db_|console) {
        return 404;
    }
    location ~ ^/(?:composer\\.(?:json|lock)|package(?:-lock)?\\.json|core/shipped\\.json)$ {
        return 404;
    }

    location ~ \\.php(?:$|/) {
        rewrite ^/(?!index|remote|public|cron|status|ocs\\/v[12]|ocs-provider\\/.+|core\\/ajax\\/update|updater\\/.+|.+\\/richdocumentscode(_arm64)?\\/proxy) /index.php$request_uri;

        fastcgi_split_path_info ^(.+?\\.php)(/.*)$;
        set $path_info $fastcgi_path_info;

        try_files $fastcgi_script_name =404;

        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        fastcgi_param PATH_INFO $path_info;
        fastcgi_param HTTPS on;

        fastcgi_param modHeadersAvailable true;
        fastcgi_param front_controller_active true;
        fastcgi_pass php-handler-${safeDomain};

        fastcgi_intercept_errors on;
        fastcgi_request_buffering on;

        fastcgi_buffers 64 4K;
        fastcgi_buffer_size 64k;
        fastcgi_busy_buffers_size 64k;
        fastcgi_temp_file_write_size 64k;
        fastcgi_read_timeout 300s;
        fastcgi_max_temp_file_size 0;
    }

    location ~ \\.(?:css|js|mjs|svg|gif|ico|jpg|png|webp|wasm|tflite|map|ogg|flac|mp4|webm)$ {
        try_files $uri /index.php$request_uri;

        add_header Cache-Control "public, max-age=15778463$asset_immutable";
        add_header Referrer-Policy "no-referrer" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Permitted-Cross-Domain-Policies "none" always;
        add_header X-Robots-Tag "noindex, nofollow" always;
        access_log off;
    }

    location ~ \\.(otf|woff2?)$ {
        try_files $uri /index.php$request_uri;
        expires 7d;
        access_log off;
    }

    location /remote {
        return 301 /remote.php$request_uri;
    }

    location / {
        try_files $uri $uri/ /index.php$request_uri;
    }

${listenBlock}
}${redirectBlock}`;

    const configPath = `/etc/nginx/sites-available/${domain}`;
    const symlinkPath = `/etc/nginx/sites-enabled/${domain}`;

    try {
      try {
        await fs.writeFile(configPath, configContent, { encoding: 'utf8', mode: 0o644 });
      } catch {
        const tmpFile = `/tmp/nginx-${domain}-${Date.now()}.conf`;
        await fs.writeFile(tmpFile, configContent, { encoding: 'utf8' });
        await execAsync(`sudo tee ${configPath} < ${tmpFile} > /dev/null`, { timeout: 10_000 });
        await fs.unlink(tmpFile).catch(() => {});
      }

      try {
        try { await fs.unlink(symlinkPath); } catch {}
        await fs.symlink(configPath, symlinkPath);
      } catch {
        await execAsync(`sudo ln -sf ${configPath} ${symlinkPath}`, { timeout: 10_000 });
      }

      try {
        await execAsync('sudo nginx -t', { timeout: 15_000 });
      } catch {
        try { await fs.unlink(symlinkPath); } catch {}
        try { await fs.unlink(configPath); } catch {}
        return {
          success: false,
          message: `Nginx config test failed for ${domain}. Config was removed.`,
        };
      }

      await execAsync('sudo systemctl reload nginx', { timeout: 30_000 });

      return {
        success: true,
        message: `Nextcloud virtual host created for ${domain}`,
        nginxConfig: configContent
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Failed to create Nextcloud virtual host: ${msg}.`,
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
`;
  }

  private async ensureEmailAutoconfigSnippet(): Promise<void> {
    const snippetPath = '/etc/nginx/snippets/clearpanel-roundcube.conf';
    try {
      await fs.access(snippetPath);
    } catch {
      const defaultSnippet = `# ClearPanel Email Autoconfig & ACME Challenge
location ^~ /.well-known/acme-challenge/ {
    root /var/www/certbot;
    default_type "text/plain";
    allow all;
}

# Email Autoconfig / Autodiscover proxy to ClearPanel backend
location ~* ^/(\\.well-known/autoconfig|autoconfig|autodiscover|Autodiscover|mail/autoconfig|mail/autodiscover|mail/config-v1\\.1\\.xml|autodiscover\\.xml) {
    proxy_pass http://127.0.0.1:3334;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
`;
      try {
        await fs.mkdir('/etc/nginx/snippets', { recursive: true });
        await fs.writeFile(snippetPath, defaultSnippet, { encoding: 'utf8', mode: 0o644 });
      } catch {
        const tmp = `/tmp/cp-snippet-${Date.now()}.conf`;
        try {
          await fs.writeFile(tmp, defaultSnippet, 'utf8');
          await execAsync(`sudo mkdir -p /etc/nginx/snippets && sudo cp ${tmp} ${snippetPath} && sudo chmod 644 ${snippetPath}`, { timeout: 10_000 });
          await fs.unlink(tmp);
        } catch {}
      }
    }
  }
}
