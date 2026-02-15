#!/usr/bin/env bash
# ==========================================================================
# install-roundcube.sh — Install Roundcube webmail via apt + nginx vhost
#
# Usage:  ./install-roundcube.sh <webmail-domain> [--db-type sqlite|mysql]
# Example: ./install-roundcube.sh webmail.example.com
# ==========================================================================
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <webmail-domain> [--db-type sqlite|mysql]" >&2
  exit 1
fi

WEBMAIL_DOMAIN="$1"
DB_TYPE="${2:---db-type}"
DB_TYPE="${3:-sqlite}"

SCRIPT_SOURCE="${BASH_SOURCE[0]}"
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_SOURCE")" && pwd)"

echo "=== ClearPanel Roundcube Installation ==="
echo "Webmail domain: ${WEBMAIL_DOMAIN}"
echo "Database type:  ${DB_TYPE}"

# --- Detect PHP-FPM version ---
PHP_VER=""
for ver in 8.4 8.3 8.2 8.1 8.0 7.4; do
  if [[ -S "/var/run/php/php${ver}-fpm.sock" ]] || dpkg -s "php${ver}-fpm" >/dev/null 2>&1; then
    PHP_VER="$ver"
    break
  fi
done
if [[ -z "$PHP_VER" ]]; then
  PHP_VER=$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;' 2>/dev/null || true)
fi
if [[ -z "$PHP_VER" ]]; then
  PHP_VER="8.2"
fi
echo "[✓] PHP-FPM version: ${PHP_VER}"

# --- Install Roundcube + dependencies ---
echo "Installing Roundcube and PHP ${PHP_VER} dependencies..."
export DEBIAN_FRONTEND=noninteractive

# Pre-seed debconf to skip interactive prompts
debconf-set-selections <<EOF
roundcube-core roundcube/dbconfig-install boolean true
roundcube-core roundcube/database-type select ${DB_TYPE}
roundcube-core roundcube/reconfigure-webserver multiselect
EOF

apt-get update -qq
apt-get install -y -qq \
  roundcube \
  roundcube-plugins \
  roundcube-plugins-extra

apt-get install -y -qq \
  "php${PHP_VER}-cli" \
  "php${PHP_VER}-fpm" \
  "php${PHP_VER}-mbstring" \
  "php${PHP_VER}-xml" \
  "php${PHP_VER}-intl" \
  "php${PHP_VER}-zip" \
  "php${PHP_VER}-gd" \
  "php${PHP_VER}-curl" \
  "php${PHP_VER}-ldap"

# Optional niceties for image previews/composer-style deps on some distros.
apt-get install -y -qq "php${PHP_VER}-imagick" >/dev/null 2>&1 || \
  apt-get install -y -qq php-imagick >/dev/null 2>&1 || true

phpenmod -v "${PHP_VER}" intl mbstring xml zip gd curl ldap >/dev/null 2>&1 || true

if ! php"${PHP_VER}" -r 'exit(defined("INTL_IDNA_VARIANT_UTS46") ? 0 : 1);'; then
  echo "ERROR: php${PHP_VER}-intl is missing/not enabled; Roundcube login will crash." >&2
  exit 1
fi

echo "[✓] Roundcube packages installed"

# --- Configure Roundcube ---
ROUNDCUBE_CONF="/etc/roundcube/config.inc.php"
if [[ -f "$ROUNDCUBE_CONF" ]]; then
  # Set defaults for local IMAP/SMTP submission via Postfix.
  sed -i "s|\$config\['imap_host'\].*|\$config['imap_host'] = ['localhost:143'];|" "$ROUNDCUBE_CONF" 2>/dev/null || true
  sed -i "s|\$config\['default_host'\].*|\$config['default_host'] = 'localhost';|" "$ROUNDCUBE_CONF" 2>/dev/null || true
  sed -i "s|\$config\['smtp_server'\].*|\$config['smtp_host'] = 'tls://localhost';|" "$ROUNDCUBE_CONF" 2>/dev/null || true
  sed -i "s|\$config\['smtp_host'\].*|\$config['smtp_host'] = 'tls://localhost';|" "$ROUNDCUBE_CONF" 2>/dev/null || true
  sed -i "s|\$config\['smtp_port'\].*|\$config['smtp_port'] = 587;|" "$ROUNDCUBE_CONF" 2>/dev/null || true

  if ! grep -q "\$config\['imap_host'\]" "$ROUNDCUBE_CONF"; then
    printf "\n\$config['imap_host'] = ['localhost:143'];\n" >> "$ROUNDCUBE_CONF"
  fi
  if ! grep -q "\$config\['default_host'\]" "$ROUNDCUBE_CONF"; then
    printf "\$config['default_host'] = 'localhost';\n" >> "$ROUNDCUBE_CONF"
  fi
  if ! grep -q "\$config\['smtp_host'\]" "$ROUNDCUBE_CONF"; then
    printf "\$config['smtp_host'] = 'tls://localhost';\n" >> "$ROUNDCUBE_CONF"
  fi
  if ! grep -q "\$config\['smtp_port'\]" "$ROUNDCUBE_CONF"; then
    printf "\$config['smtp_port'] = 587;\n" >> "$ROUNDCUBE_CONF"
  fi
  if ! grep -q "\$config\['smtp_conn_options'\]" "$ROUNDCUBE_CONF"; then
    cat >>"$ROUNDCUBE_CONF" <<'EOF'
$config['smtp_conn_options'] = [
    'ssl' => [
        'verify_peer' => false,
        'verify_peer_name' => false,
        'allow_self_signed' => true,
    ],
];
EOF
  fi

  # Enable useful plugins
  if ! grep -q "'managesieve'" "$ROUNDCUBE_CONF"; then
    sed -i "s|\$config\['plugins'\] = array(|\$config['plugins'] = array(\n  'managesieve',\n  'archive',\n  'zipdownload',\n  'newmail_notifier',|" "$ROUNDCUBE_CONF" 2>/dev/null || true
  fi
  echo "[✓] Roundcube configuration updated"
fi

# --- Create nginx vhost ---
NGINX_CONF="/etc/nginx/sites-available/${WEBMAIL_DOMAIN}"
cat >"$NGINX_CONF" <<NGINX
# ClearPanel — Roundcube webmail vhost
server {
    listen 80;
    listen [::]:80;
    server_name ${WEBMAIL_DOMAIN};

    root /usr/share/roundcube;
    index index.php;

    # Security headers
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy strict-origin-when-cross-origin;

    # Prevent access to sensitive files
    location ~ /\. { deny all; }
    location ~ ^/(config|temp|logs)/ { deny all; }
    location ~ /README|INSTALL|LICENSE|CHANGELOG|UPGRADING { deny all; }
    location ~ \.(md|txt|yml|yaml|ini|log|conf|sh|sql)$ { deny all; }

    location / {
        try_files \$uri \$uri/ /index.php?\$args;
    }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php${PHP_VER}-fpm.sock;
        fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
NGINX

# Enable site
ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/

# Test nginx config
if nginx -t 2>/dev/null; then
  systemctl reload nginx 2>/dev/null || true
  echo "[✓] Nginx vhost configured and reloaded"
else
  echo "WARN: Nginx config test failed — check ${NGINX_CONF}" >&2
fi

# Ensure PHP-FPM is running
systemctl enable "php${PHP_VER}-fpm" 2>/dev/null || true
systemctl restart "php${PHP_VER}-fpm" 2>/dev/null || true

# --- Set permissions ---
chown -R www-data:www-data /var/lib/roundcube 2>/dev/null || true
chown -R www-data:www-data /var/log/roundcube 2>/dev/null || true

echo ""
echo "=== Roundcube installation complete ==="
echo "Access:  http://${WEBMAIL_DOMAIN}"
echo "Config:  ${ROUNDCUBE_CONF}"
echo "Vhost:   ${NGINX_CONF}"
echo ""
echo "Next steps:"
echo "  1. Point DNS A record for ${WEBMAIL_DOMAIN} to your server IP"
echo "  2. Run 'certbot --nginx -d ${WEBMAIL_DOMAIN}' for HTTPS"
echo "  3. Users can log in with their mailbox email + password"
