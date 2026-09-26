#!/usr/bin/env bash
# ClearPanel: Repair Roundcube Webmail
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
    exec sudo "$0" "$@"
fi

echo "=== ClearPanel Roundcube Repair ==="

# Clean any broken temporary files
rm -f /etc/nginx/conf.d/clearpanel-roundcube-alias.conf

# Detect PHP-FPM socket
PHP_SOCK_PATH=""
for s in "/var/run/php/php8.4-fpm.sock" "/var/run/php/php8.3-fpm.sock" "/var/run/php/php8.2-fpm.sock" "/var/run/php/php-fpm.sock"; do
    if [ -S "$s" ]; then
        PHP_SOCK_PATH="$s"
        break
    fi
done
if [ -z "$PHP_SOCK_PATH" ]; then
    PHP_SOCK_PATH="$(ls /var/run/php/php*-fpm.sock 2>/dev/null | sort -V | tail -n 1 || true)"
fi
if [ -z "$PHP_SOCK_PATH" ]; then
    PHP_SOCK_PATH="/var/run/php/php8.4-fpm.sock"
fi

# Deploy clean, self-contained Roundcube vhost
cat << NGINXEOF > /etc/nginx/sites-available/roundcube.conf
server {
    listen 80;
    server_name webmail.* roundcube.*;

    root /usr/share/roundcube;
    index index.php index.html;

    access_log /var/log/nginx/roundcube.access.log;
    error_log /var/log/nginx/roundcube.error.log;

    location / {
        try_files \$uri \$uri/ /index.php?\$args;
    }

    location ~ \.php\$ {
        include fastcgi_params;
        fastcgi_split_path_info ^(.+\.php)(/.+)\$;
        fastcgi_pass unix:${PHP_SOCK_PATH};
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
    }

    location ~ ^/(README|INSTALL|LICENSE|CHANGELOG|UPGRADING)\$ {
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

# Deploy /roundcube location snippet for HTTPS panel host (panel.mainserver.in/roundcube)
mkdir -p /etc/nginx/snippets
cat << EOF > /etc/nginx/snippets/clearpanel-roundcube.conf
# ClearPanel Roundcube Location
location ^~ /roundcube/ {
    alias /usr/share/roundcube/;
    index index.php index.html;
    try_files \$uri \$uri/ /roundcube/index.php?\$args;

    location ~ \.php\$ {
        include fastcgi_params;
        fastcgi_pass unix:${PHP_SOCK_PATH};
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME \$request_filename;
    }

    location ~ ^/roundcube/(bin|SQL|config|temp|logs)/ {
        deny all;
    }
}
location = /roundcube {
    return 301 /roundcube/;
}
EOF

# Inject snippet into panel vhost if present
for vhost in /etc/nginx/sites-available/* /etc/nginx/conf.d/*; do
    [ -f "$vhost" ] || continue
    if grep -qE "panel\.|3334|clearpanel" "$vhost" 2>/dev/null; then
        if ! grep -q "clearpanel-roundcube.conf" "$vhost"; then
            sed -i '/^[[:space:]]*location \/ {/i \    include /etc/nginx/snippets/clearpanel-roundcube.conf;\n' "$vhost" || true
        fi
    fi
done

# Ensure permissions
mkdir -p /var/log/roundcube /var/lib/roundcube/temp
chown -R www-data:www-data /var/log/roundcube /var/lib/roundcube /usr/share/roundcube 2>/dev/null || true

if nginx -t; then
    systemctl reload nginx 2>/dev/null || systemctl restart nginx 2>/dev/null || true
    echo "[✓] Roundcube Nginx vhost & /roundcube route deployed and reloaded successfully."
    echo "=== Repair complete: All fixes applied ==="
else
    echo "[!] Warning: nginx -t failed. Rolling back changes to keep Nginx running."
    rm -f /etc/nginx/sites-enabled/roundcube.conf
    for vhost in /etc/nginx/sites-available/* /etc/nginx/conf.d/*; do
        [ -f "$vhost" ] || continue
        sed -i '/clearpanel-roundcube\.conf/d' "$vhost" 2>/dev/null || true
    done
    nginx -t && systemctl reload nginx || true
fi

