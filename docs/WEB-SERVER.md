# Web Server Setup on AlmaLinux (Nginx vs Apache)

This guide helps you choose and set up a web server on AlmaLinux for clearPanel. It includes complete commands, configs, SSL, PHP-FPM, and reverse proxy to the clearPanel backend (port 3334).

## Recommendation in short
- Use Nginx as the default. Itâ€™s fast, memoryâ€‘efficient, and pairs well with Node/Nest (clearPanel backend).
- Use Apache only if you need heavy .htaccess usage or per-directory overrides for many legacy PHP apps.
- Hybrid is possible: Nginx in front, Apache behind (for .htaccess) â€“ advanced setup.

clearPanel currently automates Nginx vhosts. Apache works, but automation is manual unless extended.

---

## Nginx on AlmaLinux

### 1) Install and enable
```bash
sudo dnf install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
sudo systemctl status nginx --no-pager
```

### 2) Firewall
```bash
sudo firewall-cmd --add-service=http --permanent
sudo firewall-cmd --add-service=https --permanent
sudo firewall-cmd --reload
```

### 3) Reverse proxy to clearPanel (port 3334)
Create a site config:
```bash
sudo tee /etc/nginx/conf.d/clearPanel.conf > /dev/null <<'NGINX'
server {
    listen 80;
    server_name panel.yourdomain.com;  # or your server IP temporarily

    # Increase timeouts for larger uploads/editing
    client_max_body_size 100m;
    proxy_read_timeout 300;
    proxy_connect_timeout 300;
    proxy_send_timeout 300;

    location / {
        proxy_pass http://127.0.0.1:3334;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX
```
Test and reload:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

Note: You also have `nginx.conf.example` in the repo you can reference for broader templates.

### 4) Host a PHP site with PHPâ€‘FPM (optional)
Install PHP and PHP-FPM:
```bash
sudo dnf module reset php -y
sudo dnf module enable php:8.2 -y
sudo dnf install -y php php-fpm php-mysqlnd php-gd php-xml php-mbstring php-cli
sudo systemctl enable php-fpm
sudo systemctl start php-fpm
```

Create a server block for a domain (replace domain):
```bash
sudo tee /etc/nginx/conf.d/mywebsite.conf > /dev/null <<'NGINX'
server {
    listen 80;
    server_name mywebsite.com www.mywebsite.com;
    root /home/sefion/Domains/mywebsite.com;
    index index.php index.html;

    location / {
        try_files $uri $uri/ /index.php?$args;
    }

    location ~ \.php$ {
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        fastcgi_pass unix:/run/php-fpm/www.sock;  # default PHP-FPM socket on AlmaLinux
    }

    location ~* \.(css|js|jpg|jpeg|png|gif|ico|webp|svg)$ {
        expires 7d;
        access_log off;
    }
}
NGINX
sudo nginx -t && sudo systemctl reload nginx
```

### 5) SSL (Letâ€™s Encrypt)
Install Certbot for AlmaLinux (via EPEL):
```bash
sudo dnf install -y epel-release
sudo dnf install -y certbot python3-certbot-nginx
```
Issue certificate:
```bash
sudo certbot --nginx -d panel.yourdomain.com
# For websites
sudo certbot --nginx -d mywebsite.com -d www.mywebsite.com
```
Autoâ€‘renewal is created by Certbot. Test:
```bash
sudo certbot renew --dry-run
```

### 6) Common commands
```bash
# Nginx service
sudo systemctl status nginx --no-pager
sudo systemctl reload nginx
sudo systemctl restart nginx

# Logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

---

## Apache (httpd) on AlmaLinux

Choose Apache if you need .htaccess and per-directory overrides.

### 1) Install and enable
```bash
sudo dnf install -y httpd
sudo systemctl enable httpd
sudo systemctl start httpd
sudo systemctl status httpd --no-pager
```

### 2) Firewall
```bash
sudo firewall-cmd --add-service=http --permanent
sudo firewall-cmd --add-service=https --permanent
sudo firewall-cmd --reload
```

### 3) Reverse proxy to clearPanel (port 3334)
Install proxy modules:
```bash
sudo dnf install -y mod_ssl
# The base httpd package includes core proxy modules, ensure they are loaded
# You can explicitly load if needed inside /etc/httpd/conf.modules.d/00-proxy.conf
```

Create vhost:
```bash
sudo tee /etc/httpd/conf.d/clearPanel.conf > /dev/null <<'APACHE'
<VirtualHost *:80>
    ServerName panel.yourdomain.com

    ProxyPreserveHost On
    ProxyRequests Off
    ProxyPass "/" "http://127.0.0.1:3334/"
    ProxyPassReverse "/" "http://127.0.0.1:3334/"

    # WebSocket support
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} =websocket [NC]
    RewriteRule /(.*)           ws://127.0.0.1:3334/$1  [P,L]
    RewriteCond %{HTTP:Upgrade} !=websocket [NC]
    RewriteRule /(.*)           http://127.0.0.1:3334/$1 [P,L]

    ErrorLog  "/var/log/httpd/clearPanel_error.log"
    CustomLog "/var/log/httpd/clearPanel_access.log" combined
</VirtualHost>
APACHE
sudo apachectl configtest
sudo systemctl reload httpd
```

If Rewrite/WebSocket proxying errors occur, ensure these modules are loaded:
- proxy, proxy_http, proxy_wstunnel, rewrite

### 4) PHP with Apache via PHPâ€‘FPM (recommended)
Install PHP + FPM:
```bash
sudo dnf module reset php -y
sudo dnf module enable php:8.2 -y
sudo dnf install -y php php-fpm php-mysqlnd php-gd php-xml php-mbstring php-cli
sudo systemctl enable php-fpm
sudo systemctl start php-fpm
```

VHost for a domain using PHPâ€‘FPM (no mod_php):
```bash
sudo tee /etc/httpd/conf.d/mywebsite.conf > /dev/null <<'APACHE'
<VirtualHost *:80>
    ServerName mywebsite.com
    ServerAlias www.mywebsite.com
    DocumentRoot /home/sefion/Domains/mywebsite.com

    <Directory "/home/sefion/Domains/mywebsite.com">
        AllowOverride All
        Require all granted
    </Directory>

    # PHP-FPM via proxy_fcgi
    <FilesMatch \.php$>
        SetHandler "proxy:unix:/run/php-fpm/www.sock|fcgi://localhost/"
    </FilesMatch>

    ErrorLog  "/var/log/httpd/mywebsite_error.log"
    CustomLog "/var/log/httpd/mywebsite_access.log" combined
</VirtualHost>
APACHE
sudo apachectl configtest
sudo systemctl reload httpd
```

### 5) SSL (Letâ€™s Encrypt)
```bash
sudo dnf install -y epel-release
sudo dnf install -y certbot python3-certbot-apache

# For panel
sudo certbot --apache -d panel.yourdomain.com

# For websites
sudo certbot --apache -d mywebsite.com -d www.mywebsite.com

# Verify renewal
sudo certbot renew --dry-run
```

### 6) Common commands
```bash
# Apache service
sudo systemctl status httpd --no-pager
sudo systemctl reload httpd
sudo systemctl restart httpd

# Logs
sudo tail -f /var/log/httpd/access_log
sudo tail -f /var/log/httpd/error_log
```

---

## Nginx vs Apache quick comparison
- Performance: Nginx generally faster for static + proxy; Apache flexible with .htaccess
- Memory: Nginx uses less under high concurrency (event model)
- Config model: Apache supports per-directory .htaccess; Nginx central configs only
- PHP: Prefer PHPâ€‘FPM with both; avoid mod_php on modern setups
- clearPanel integration: Nginx automation exists; Apache would require manual or added automation

## Security hardening tips
- Always enable HTTPS (Certbot) and redirect HTTP â†’ HTTPS
- Keep packages updated: `sudo dnf update -y`
- Limit server tokens: hide versions in headers (Nginx: `server_tokens off;`, Apache: `ServerTokens Prod` and `ServerSignature Off`)
- Use strong ciphers and TLS 1.2/1.3 only
- For PHPâ€‘FPM, run as a dedicated user per site if multi-tenant
- File permissions: owned by site user, readable by web server

## Troubleshooting
- Check syntax: `sudo nginx -t` or `sudo apachectl configtest`
- See logs for details (paths above)
- SELinux: If enforcing, label custom web roots:
```bash
# Allow Nginx/Apache to read home directories like /home/sefion/Domains
sudo chcon -R -t httpd_sys_content_t /home/sefion/Domains
# For PHP-FPM writing (uploads), add write type where needed
sudo chcon -R -t httpd_sys_rw_content_t /home/sefion/Domains/mywebsite.com/uploads
```
- Ports busy: ensure nothing else binds to 80/443
- Firewall: verify with `sudo firewall-cmd --list-all`

## Where configs live on AlmaLinux
- Nginx: `/etc/nginx/nginx.conf`, site files `/etc/nginx/conf.d/*.conf`
- Apache: `/etc/httpd/conf/httpd.conf`, vhosts `/etc/httpd/conf.d/*.conf`
- PHP-FPM: `/etc/php-fpm.d/www.conf`, socket `/run/php-fpm/www.sock`

---

Need equivalent Apache automation in clearPanel? I can add an Apache WebServerService that mirrors our Nginx vhost creation/deletion. Let me know and Iâ€™ll wire it up.
