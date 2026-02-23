#!/usr/bin/env bash
# ==========================================================================
# repair-roundcube.sh — Diagnose and fix common Roundcube issues
#
# Usage:  sudo bash repair-roundcube.sh
# ==========================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "  ${GREEN}[✓]${NC} $*"; }
warn() { echo -e "  ${YELLOW}[!]${NC} $*"; }
err()  { echo -e "  ${RED}[✗]${NC} $*"; }
fix()  { echo -e "  ${GREEN}[FIX]${NC} $*"; }

ROUNDCUBE_CONF="/etc/roundcube/config.inc.php"
FIXES=0

echo "=== ClearPanel Roundcube Repair ==="
echo ""

# ── 1. Check Roundcube is installed ──
if [[ ! -f /usr/share/roundcube/index.php ]]; then
  err "Roundcube is not installed"
  exit 1
fi
ok "Roundcube is installed"

# ── 2. Detect PHP-FPM version ──
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
if [[ -n "$PHP_VER" ]]; then
  ok "PHP version: ${PHP_VER}"
else
  err "Cannot detect PHP version"
  exit 1
fi

# ── 3. Check php-intl ──
if php"${PHP_VER}" -r 'exit(defined("INTL_IDNA_VARIANT_UTS46") ? 0 : 1);' 2>/dev/null; then
  ok "php${PHP_VER}-intl is loaded"
else
  warn "php${PHP_VER}-intl is missing — installing..."
  export DEBIAN_FRONTEND=noninteractive
  apt-get install -y -qq "php${PHP_VER}-intl" 2>/dev/null
  phpenmod -v "${PHP_VER}" intl 2>/dev/null || true
  systemctl restart "php${PHP_VER}-fpm" 2>/dev/null || true
  fix "Installed php${PHP_VER}-intl"
  FIXES=$((FIXES + 1))
fi

# ── 4. Check des_key ──
if [[ -f "$ROUNDCUBE_CONF" ]]; then
  CURRENT_KEY=$(grep -oP "\\\$config\['des_key'\]\s*=\s*'\K[^']*" "$ROUNDCUBE_CONF" 2>/dev/null || true)
  if [[ -z "$CURRENT_KEY" || "$CURRENT_KEY" == *"put_some_random"* || "$CURRENT_KEY" == *"rcmail-!24ByteDESkey"* || ${#CURRENT_KEY} -lt 24 ]]; then
    warn "des_key is missing or placeholder"
    DES_KEY=$(head -c 24 /dev/urandom | base64 | head -c 24)
    if grep -q "\$config\['des_key'\]" "$ROUNDCUBE_CONF"; then
      sed -i "s|\$config\['des_key'\].*|\$config['des_key'] = '${DES_KEY}';|" "$ROUNDCUBE_CONF"
    else
      printf "\n\$config['des_key'] = '%s';\n" "$DES_KEY" >> "$ROUNDCUBE_CONF"
    fi
    fix "Generated new des_key (24 chars)"
    FIXES=$((FIXES + 1))
  else
    ok "des_key is set (${#CURRENT_KEY} chars)"
  fi
else
  err "Roundcube config not found at ${ROUNDCUBE_CONF}"
  exit 1
fi

# ── 5. Check error logging ──
if grep -q "\$config\['enable_logging'\]\s*=\s*true" "$ROUNDCUBE_CONF" 2>/dev/null; then
  ok "Logging is enabled"
else
  warn "Logging not enabled — enabling..."
  if ! grep -q "\$config\['log_driver'\]" "$ROUNDCUBE_CONF"; then
    printf "\n\$config['log_driver'] = 'file';\n" >> "$ROUNDCUBE_CONF"
  fi
  if grep -q "\$config\['enable_logging'\]" "$ROUNDCUBE_CONF"; then
    sed -i "s|\$config\['enable_logging'\].*|\$config['enable_logging'] = true;|" "$ROUNDCUBE_CONF"
  else
    printf "\$config['enable_logging'] = true;\n" >> "$ROUNDCUBE_CONF"
  fi
  fix "Enabled error logging"
  FIXES=$((FIXES + 1))
fi

# ── 6. Check temp_dir ──
TEMP_DIR="/var/lib/roundcube/temp"
mkdir -p "$TEMP_DIR" 2>/dev/null || true
if [[ -w "$TEMP_DIR" ]] || sudo -u www-data test -w "$TEMP_DIR" 2>/dev/null; then
  ok "temp_dir is writable"
else
  warn "temp_dir not writable — fixing permissions..."
  chown -R www-data:www-data "$TEMP_DIR"
  chmod -R 770 "$TEMP_DIR"
  fix "Fixed temp_dir permissions"
  FIXES=$((FIXES + 1))
fi
if ! grep -q "\$config\['temp_dir'\]" "$ROUNDCUBE_CONF" 2>/dev/null; then
  printf "\n\$config['temp_dir'] = '/var/lib/roundcube/temp';\n" >> "$ROUNDCUBE_CONF"
  fix "Added temp_dir to config"
  FIXES=$((FIXES + 1))
fi

# ── 7. Check log dir ──
LOG_DIR="/var/log/roundcube"
mkdir -p "$LOG_DIR" 2>/dev/null || true
chown -R www-data:www-data "$LOG_DIR" 2>/dev/null || true
chmod -R 770 "$LOG_DIR" 2>/dev/null || true
ok "Log directory: ${LOG_DIR}"

# ── 8. Check database ──
# Detect DB type from config
DB_DSN=$(grep -oP "\\\$config\['db_dsnw'\]\s*=\s*'\K[^']*" "$ROUNDCUBE_CONF" 2>/dev/null || true)
if [[ "$DB_DSN" == *sqlite* ]]; then
  ok "Database type: SQLite"
  # Install sqlite3 PHP extension if missing
  if ! php"${PHP_VER}" -m 2>/dev/null | grep -qi sqlite; then
    warn "php${PHP_VER}-sqlite3 missing — installing..."
    export DEBIAN_FRONTEND=noninteractive
    apt-get install -y -qq "php${PHP_VER}-sqlite3" 2>/dev/null || true
    fix "Installed php${PHP_VER}-sqlite3"
    FIXES=$((FIXES + 1))
  fi
  # Check if DB file exists
  DB_PATH=$(echo "$DB_DSN" | sed 's|sqlite:///||; s|?.*||')
  if [[ -z "$DB_PATH" ]]; then
    DB_PATH="/var/lib/roundcube/db/sqlite.db"
  fi
  DB_DIR=$(dirname "$DB_PATH")
  mkdir -p "$DB_DIR" 2>/dev/null || true
  if [[ -f "$DB_PATH" && -s "$DB_PATH" ]]; then
    ok "SQLite database exists: ${DB_PATH}"
  else
    warn "SQLite database missing or empty — initializing..."
    # Try dbconfig-common
    dpkg-reconfigure -f noninteractive roundcube-core 2>/dev/null || true
    # Fallback to schema
    if [[ ! -f "$DB_PATH" || ! -s "$DB_PATH" ]]; then
      SCHEMA="/usr/share/roundcube/SQL/sqlite.initial.sql"
      if [[ -f "$SCHEMA" ]]; then
        apt-get install -y -qq sqlite3 2>/dev/null || true
        sqlite3 "$DB_PATH" < "$SCHEMA"
        fix "Initialized SQLite database from schema"
      else
        err "Cannot find schema at ${SCHEMA}"
      fi
    else
      fix "Database initialized via dbconfig-common"
    fi
    chown www-data:www-data "$DB_DIR" "$DB_PATH" 2>/dev/null || true
    chmod 660 "$DB_PATH" 2>/dev/null || true
    FIXES=$((FIXES + 1))
  fi
elif [[ "$DB_DSN" == *mysql* ]]; then
  ok "Database type: MySQL/MariaDB"
  if ! php"${PHP_VER}" -m 2>/dev/null | grep -qi mysql; then
    warn "php${PHP_VER}-mysql missing — installing..."
    export DEBIAN_FRONTEND=noninteractive
    apt-get install -y -qq "php${PHP_VER}-mysql" 2>/dev/null || true
    fix "Installed php${PHP_VER}-mysql"
    FIXES=$((FIXES + 1))
  fi
else
  warn "Could not detect database type from config (db_dsnw: ${DB_DSN:-not set})"
fi

# ── 9. Check /var/lib/roundcube ownership ──
RC_OWNER=$(stat -c '%U' /var/lib/roundcube 2>/dev/null || true)
if [[ "$RC_OWNER" != "www-data" ]]; then
  warn "Incorrect ownership on /var/lib/roundcube (${RC_OWNER})"
  chown -R www-data:www-data /var/lib/roundcube
  fix "Fixed /var/lib/roundcube ownership"
  FIXES=$((FIXES + 1))
fi
ok "/var/lib/roundcube owned by www-data"

# ── 10. Check nginx vhost ──
VHOST=$(grep -Rl "roundcube" /etc/nginx/sites-enabled/ 2>/dev/null | head -1 || true)
if [[ -n "$VHOST" ]]; then
  ok "Nginx vhost: ${VHOST}"
else
  VHOST_AVAIL=$(grep -Rl "roundcube" /etc/nginx/sites-available/ 2>/dev/null | head -1 || true)
  if [[ -n "$VHOST_AVAIL" ]]; then
    warn "Vhost found but not enabled: ${VHOST_AVAIL}"
    ln -sf "$VHOST_AVAIL" /etc/nginx/sites-enabled/
    nginx -t 2>/dev/null && systemctl reload nginx 2>/dev/null || true
    fix "Enabled nginx vhost"
    FIXES=$((FIXES + 1))
  else
    err "No Roundcube nginx vhost found"
  fi
fi

# ── 11. Check PHP-FPM socket ──
SOCK="/var/run/php/php${PHP_VER}-fpm.sock"
if [[ -S "$SOCK" ]]; then
  ok "PHP-FPM socket exists: ${SOCK}"
else
  warn "PHP-FPM socket missing — restarting..."
  systemctl restart "php${PHP_VER}-fpm" 2>/dev/null || true
  sleep 2
  if [[ -S "$SOCK" ]]; then
    fix "PHP-FPM socket restored"
    FIXES=$((FIXES + 1))
  else
    err "PHP-FPM socket still missing after restart"
  fi
fi

# ── 12. Restart services ──
if [[ $FIXES -gt 0 ]]; then
  echo ""
  echo "Restarting services after ${FIXES} fix(es)..."
  systemctl restart "php${PHP_VER}-fpm" 2>/dev/null || true
  systemctl reload nginx 2>/dev/null || true
fi

# ── 13. Show recent error log ──
echo ""
echo "--- Recent Roundcube errors ---"
if [[ -f /var/log/roundcube/errors.log ]]; then
  tail -20 /var/log/roundcube/errors.log 2>/dev/null || echo "(empty)"
elif [[ -f /var/log/roundcube/errors ]]; then
  tail -20 /var/log/roundcube/errors 2>/dev/null || echo "(empty)"
else
  echo "(no error log file found)"
fi

echo ""
echo "=== Repair complete: ${FIXES} fix(es) applied ==="
