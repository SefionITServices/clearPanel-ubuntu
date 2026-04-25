#!/usr/bin/env bash
# ==========================================================================
# install-roundcube.sh — Install Roundcube webmail via apt + nginx config
#
# Usage:
#   ./install-roundcube.sh                          # path mode: {server}/roundcube/
#   ./install-roundcube.sh webmail.example.com      # dedicated vhost for a domain
#   ./install-roundcube.sh --path-only              # explicit path mode
#   ./install-roundcube.sh <domain> --db-type sqlite|mysql
# ==========================================================================
set -euo pipefail

# Parse args
WEBMAIL_DOMAIN=""
DB_TYPE="sqlite"
PATH_ONLY=false

for arg in "$@"; do
  case "$arg" in
    --path-only) PATH_ONLY=true ;;
    --db-type) ;;
    sqlite|mysql) DB_TYPE="$arg" ;;
    *) [[ -z "$WEBMAIL_DOMAIN" ]] && WEBMAIL_DOMAIN="$arg" || DB_TYPE="$arg" ;;
  esac
done

# If no domain provided, default to path mode
if [[ -z "$WEBMAIL_DOMAIN" ]]; then
  PATH_ONLY=true
fi

if [[ "$PATH_ONLY" == "true" ]]; then
  echo "=== ClearPanel Roundcube Installation (path mode: /roundcube/) ==="
else
  echo "=== ClearPanel Roundcube Installation ==="
  echo "Webmail domain: ${WEBMAIL_DOMAIN}"
fi
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
  # Temporarily disable nounset — grep/sed patterns use literal $config
  # which bash would otherwise treat as an unbound variable reference
  set +u

  # Generate a secure 24-character des_key if not already set or still placeholder
  CURRENT_KEY=$(grep -oP "\\\$config\['des_key'\]\s*=\s*'\K[^']*" "$ROUNDCUBE_CONF" 2>/dev/null || true)
  if [[ -z "$CURRENT_KEY" || "$CURRENT_KEY" == *"put_some_random"* || ${#CURRENT_KEY} -lt 24 ]]; then
    DES_KEY=$(head -c 24 /dev/urandom | base64 | head -c 24)
    if grep -q "\$config\['des_key'\]" "$ROUNDCUBE_CONF"; then
      sed -i "s|\$config\['des_key'\].*|\$config['des_key'] = '${DES_KEY}';|" "$ROUNDCUBE_CONF"
    else
      printf "\n\$config['des_key'] = '%s';\n" "$DES_KEY" >> "$ROUNDCUBE_CONF"
    fi
    echo "[✓] Generated encryption key (des_key)"
  fi

  # Enable error logging so problems are visible
  if ! grep -q "\$config\['log_driver'\]" "$ROUNDCUBE_CONF"; then
    printf "\n\$config['log_driver'] = 'file';\n" >> "$ROUNDCUBE_CONF"
  fi
  if ! grep -q "\$config\['enable_logging'\]" "$ROUNDCUBE_CONF"; then
    printf "\$config['enable_logging'] = true;\n" >> "$ROUNDCUBE_CONF"
  fi
  if ! grep -q "\$config\['debug_level'\]" "$ROUNDCUBE_CONF"; then
    printf "\$config['debug_level'] = 1;\n" >> "$ROUNDCUBE_CONF"
  fi

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

  # Ensure Debian's dbconfig-common auto-generated DB config is included
  # This file contains the db_dsnw setting created during apt installation
  if [[ -f "/etc/roundcube/debian-db.php" ]]; then
    if ! grep -q "debian-db.php" "$ROUNDCUBE_CONF"; then
      # Add the include at the top of the config (after <?php)
      sed -i '1a\\nif (file_exists("/etc/roundcube/debian-db.php")) include_once("/etc/roundcube/debian-db.php");' "$ROUNDCUBE_CONF" 2>/dev/null || true
      echo "[✓] Added debian-db.php include"
    fi
  fi

  # Ensure db_dsnw is set as a fallback (SQLite default)
  if ! grep -q "\$config\['db_dsnw'\]" "$ROUNDCUBE_CONF"; then
    if [[ "$DB_TYPE" == "sqlite" ]]; then
      printf "\n\$config['db_dsnw'] = 'sqlite:////var/lib/roundcube/db/sqlite.db?mode=0646';\n" >> "$ROUNDCUBE_CONF"
      echo "[✓] Set db_dsnw to SQLite"
    fi
  fi

  # Set product_name for branding
  if ! grep -q "\$config\['product_name'\]" "$ROUNDCUBE_CONF"; then
    printf "\n\$config['product_name'] = 'ClearPanel Webmail';\n" >> "$ROUNDCUBE_CONF"
  fi

  # Ensure IMAP connection options allow self-signed certs (common on local installs)
  if ! grep -q "\$config\['imap_conn_options'\]" "$ROUNDCUBE_CONF"; then
    cat >>"$ROUNDCUBE_CONF" <<'EOF'
$config['imap_conn_options'] = [
    'ssl' => [
        'verify_peer' => false,
        'verify_peer_name' => false,
        'allow_self_signed' => true,
    ],
];
EOF
    echo "[✓] Added IMAP connection options (self-signed cert support)"
  fi

  set -u
  echo "[✓] Roundcube configuration updated"
fi

# --- Ensure database backend PHP extension is installed ---
if [[ "$DB_TYPE" == "sqlite" ]]; then
  apt-get install -y -qq "php${PHP_VER}-sqlite3" 2>/dev/null || true
elif [[ "$DB_TYPE" == "mysql" ]]; then
  apt-get install -y -qq "php${PHP_VER}-mysql" 2>/dev/null || true
fi

# --- Ensure Roundcube database is initialized ---
RC_DB_DIR="/var/lib/roundcube/db"
RC_DB_FILE="${RC_DB_DIR}/sqlite.db"
if [[ "$DB_TYPE" == "sqlite" ]]; then
  mkdir -p "$RC_DB_DIR"
  if [[ ! -f "$RC_DB_FILE" ]] || [[ ! -s "$RC_DB_FILE" ]]; then
    echo "Initializing Roundcube SQLite database..."
    # Try dbconfig-common reconfigure first
    if dpkg-reconfigure -f noninteractive roundcube-core 2>/dev/null; then
      echo "[✓] Database initialized via dbconfig-common"
    fi
    # If DB still missing, initialize from Roundcube SQL schema
    if [[ ! -f "$RC_DB_FILE" ]] || [[ ! -s "$RC_DB_FILE" ]]; then
      SCHEMA_FILE="/usr/share/roundcube/SQL/sqlite.initial.sql"
      if [[ -f "$SCHEMA_FILE" ]]; then
        sqlite3 "$RC_DB_FILE" < "$SCHEMA_FILE"
        echo "[✓] Database initialized from schema"
      else
        echo "WARN: Could not find Roundcube SQLite schema at ${SCHEMA_FILE}" >&2
      fi
    fi
    chown www-data:www-data "$RC_DB_DIR" "$RC_DB_FILE" 2>/dev/null || true
    chmod 660 "$RC_DB_FILE" 2>/dev/null || true
  fi
fi

# --- Set permissions (temp, logs, db) ---
for dir in /var/lib/roundcube /var/lib/roundcube/temp /var/log/roundcube "$RC_DB_DIR"; do
  mkdir -p "$dir" 2>/dev/null || true
  chown -R www-data:www-data "$dir" 2>/dev/null || true
done
chmod -R 770 /var/lib/roundcube/temp 2>/dev/null || true
chmod -R 770 /var/log/roundcube 2>/dev/null || true

# Ensure temp_dir is set in config
if [[ -f "$ROUNDCUBE_CONF" ]] && ! grep -q "\$config\['temp_dir'\]" "$ROUNDCUBE_CONF"; then
  printf "\n\$config['temp_dir'] = '/var/lib/roundcube/temp';\n" >> "$ROUNDCUBE_CONF"
fi

# ── Nginx config ──────────────────────────────────────────────────────────────
if [[ "$PATH_ONLY" == "true" ]]; then
  # Patch the main clearPanel nginx config to add /roundcube/ location block
  MAIN_NGINX=""
  if [ -f "/etc/nginx/sites-available/clearpanel" ]; then
    MAIN_NGINX="/etc/nginx/sites-available/clearpanel"
  elif [ -f "/etc/nginx/conf.d/clearpanel.conf" ]; then
    MAIN_NGINX="/etc/nginx/conf.d/clearpanel.conf"
  fi

  if [ -n "$MAIN_NGINX" ]; then
    # Remove any existing roundcube location blocks first (for clean re-install)
    if grep -q "location.*roundcube" "$MAIN_NGINX"; then
      echo "[~] Removing existing /roundcube/ location from nginx config..."
      # Use awk to remove the roundcube blocks
      awk '
        /# Roundcube webmail/     { skip=1; brace=0; next }
        /location = \/roundcube/  { skip=1; next }
        /location \/roundcube\//  { skip=1; brace=0 }
        skip && /{/               { brace++ }
        skip && /}/               { brace--; if(brace<=0){skip=0}; next }
        skip                      { next }
        { print }
      ' "$MAIN_NGINX" > "${MAIN_NGINX}.tmp" && mv "${MAIN_NGINX}.tmp" "$MAIN_NGINX"
    fi

    # Insert new Roundcube location before the catch-all "location /" block
    ROUNDCUBE_BLOCK="
    # Roundcube webmail
    location /roundcube/ {
        alias /usr/share/roundcube/;
        index index.php;

        # Deny access to sensitive directories and files
        location ~ ^/roundcube/(config|temp|logs|bin|SQL)/ { deny all; }
        location ~ ^/roundcube/\\\.(git|svn|ht) { deny all; }

        # Handle PHP files — explicit path construction avoids alias resolution bugs
        location ~ ^/roundcube/(.*\\.php)\$ {
            alias /usr/share/roundcube/\$1;
            include fastcgi_params;
            fastcgi_pass unix:/var/run/php/php${PHP_VER}-fpm.sock;
            fastcgi_param SCRIPT_FILENAME /usr/share/roundcube/\$1;
            fastcgi_param DOCUMENT_ROOT /usr/share/roundcube;
            fastcgi_param PATH_INFO \$2;
            fastcgi_index index.php;
            fastcgi_intercept_errors on;
        }

        # Cache static assets
        location ~* ^/roundcube/.*\\.(css|js|gif|png|jpg|jpeg|svg|ico|woff|woff2|ttf|eot)\$ {
            expires 30d;
            add_header Cache-Control \"public, immutable\";
            try_files \$uri =404;
        }
    }
    location = /roundcube { return 301 /roundcube/; }"
    # Use awk to insert before the "location /" block
    awk -v block="$ROUNDCUBE_BLOCK" '
      /^[[:space:]]+location \/ \{/ && !done {
        print block
        done=1
      }
      { print }
    ' "$MAIN_NGINX" > "${MAIN_NGINX}.tmp" && mv "${MAIN_NGINX}.tmp" "$MAIN_NGINX"
    echo "[✓] Added /roundcube/ location to main nginx config"

    if nginx -t 2>/dev/null; then
      systemctl reload nginx 2>/dev/null || true
      echo "[✓] Nginx reloaded"
    else
      echo "WARN: Nginx config test failed — check ${MAIN_NGINX}" >&2
    fi
  else
    echo "WARN: Could not find main nginx config — add /roundcube/ manually" >&2
  fi
else
  # Create dedicated vhost for the custom domain
  NGINX_CONF="/etc/nginx/sites-available/${WEBMAIL_DOMAIN}"
  cat >"$NGINX_CONF" <<NGINX
# ClearPanel — Roundcube webmail vhost
server {
    listen 80;
    listen [::]:80;
    server_name ${WEBMAIL_DOMAIN};

    root /usr/share/roundcube;
    index index.php;

    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy strict-origin-when-cross-origin;

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

  ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/
  if nginx -t 2>/dev/null; then
    systemctl reload nginx 2>/dev/null || true
    echo "[✓] Nginx vhost configured and reloaded"
  else
    echo "WARN: Nginx config test failed — check ${NGINX_CONF}" >&2
  fi
fi

# Ensure PHP-FPM is running
systemctl enable "php${PHP_VER}-fpm" 2>/dev/null || true
systemctl restart "php${PHP_VER}-fpm" 2>/dev/null || true

echo ""
echo "=== Roundcube installation complete ==="
if [[ "$PATH_ONLY" == "true" ]]; then
  echo "Access:  http://<server-ip>/roundcube/"
else
  echo "Access:  http://${WEBMAIL_DOMAIN}"
  echo "Vhost:   /etc/nginx/sites-available/${WEBMAIL_DOMAIN}"
  echo ""
  echo "Next steps:"
  echo "  1. Point DNS A record for ${WEBMAIL_DOMAIN} to your server IP"
  echo "  2. Run 'certbot --nginx -d ${WEBMAIL_DOMAIN}' for HTTPS"
fi
echo "Config:  ${ROUNDCUBE_CONF}"
echo "  3. Users can log in with their mailbox email + password"
