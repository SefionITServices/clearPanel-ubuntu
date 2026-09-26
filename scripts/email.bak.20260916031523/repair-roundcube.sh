#!/usr/bin/env bash
# ClearPanel: Repair Roundcube Webmail
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
    exec sudo bash "$0" "$@"
fi

echo "=== ClearPanel Roundcube Repair ==="

PHP_SOCKET="/var/run/php/php8.4-fpm.sock"
if [ ! -S "$PHP_SOCKET" ]; then
    PHP_SOCKET="$(ls /var/run/php/php*-fpm.sock 2>/dev/null | sort -V | tail -n 1 || true)"
fi

# Ensure Nginx vhost exists
cat << NGINXEOF > /etc/nginx/sites-available/roundcube.conf
server {
    listen 80;
    server_name webmail.* mail.*;

    root /usr/share/roundcube;
    index index.php index.html;

    access_log /var/log/nginx/roundcube.access.log;
    error_log /var/log/nginx/roundcube.error.log;

    location / {
        try_files \$uri \$uri/ /index.php?\$args;
    }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass $PHP_SOCKET;
        fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~ ^/(README|INSTALL|LICENSE|CHANGELOG|UPGRADING)$ {
        deny all;
    }
    location ~ ^/(bin|SQL|config|temp|logs)/ {
        deny all;
    }
    location ~ /\. {
        deny all;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/roundcube.conf /etc/nginx/sites-enabled/roundcube.conf

# Ensure permissions
mkdir -p /var/log/roundcube /var/lib/roundcube/temp
chown -R www-data:www-data /var/log/roundcube /var/lib/roundcube /usr/share/roundcube 2>/dev/null || true

nginx -t && systemctl reload nginx
echo "[✓] Roundcube Nginx vhost deployed and reloaded"
echo "=== Repair complete: 1 fix(es) applied ==="
