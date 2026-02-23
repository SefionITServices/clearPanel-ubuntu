#!/bin/bash
# ==========================================================================
# uninstall.sh — Complete ClearPanel removal from VPS
#
# Usage:  sudo bash uninstall.sh [options]
#
# Options:
#   --purge         Also remove ALL user data: mail (/var/vmail), website
#                   files (/home/<user>/public_html), backups, databases,
#                   Let's Encrypt certificates, DNS zone data
#   --remove-pkgs   Also purge apt packages (postfix, dovecot, rspamd,
#                   nginx, bind9, nodejs, php, roundcube, mysql, etc.)
#   --keep-nginx    Don't uninstall/remove nginx (other sites use it)
#   --keep-bind     Don't uninstall/remove BIND9 (other zones use it)
#   --keep-node     Don't uninstall Node.js (other apps use it)
#   --keep-php      Don't uninstall PHP (other apps use it)
#   --keep-mysql    Don't uninstall MySQL/MariaDB (other apps use it)
#   --keep-postgres Don't uninstall PostgreSQL (other apps use it)
#   --yes           Skip confirmation prompt
#   --help          Show this help
#
# By default (no flags) this removes all ClearPanel-specific files,
# configs, services, and users but keeps installed apt packages and
# user data intact. Use --purge --remove-pkgs for a total wipe.
# ==========================================================================
set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ── Defaults ──────────────────────────────────────────────────────
PURGE_DATA=false
REMOVE_PKGS=false
KEEP_NGINX=false
KEEP_BIND=false
KEEP_NODE=false
KEEP_PHP=false
KEEP_MYSQL=false
KEEP_POSTGRES=false
AUTO_YES=false

# ── Parse arguments ───────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --purge)        PURGE_DATA=true ;;
    --remove-pkgs)  REMOVE_PKGS=true ;;
    --keep-nginx)   KEEP_NGINX=true ;;
    --keep-bind)    KEEP_BIND=true ;;
    --keep-node)    KEEP_NODE=true ;;
    --keep-php)     KEEP_PHP=true ;;
    --keep-mysql)   KEEP_MYSQL=true ;;
    --keep-postgres) KEEP_POSTGRES=true ;;
    --yes|-y)       AUTO_YES=true ;;
    --help|-h)
      head -25 "$0" | tail -21
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $arg${NC}" >&2
      echo "Use --help for usage info"
      exit 1
      ;;
  esac
done

# ── Must be root ──────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  echo -e "${RED}This script must be run as root${NC}"
  echo "Usage: sudo bash uninstall.sh [--purge] [--remove-pkgs] [--yes]"
  exit 1
fi

# ── Detect admin user (for DATA_DIR) ─────────────────────────────
ADMIN_USER=""
DATA_DIR=""
if [[ -f /opt/clearpanel/backend/.env ]]; then
  DATA_DIR=$(grep "^DATA_DIR=" /opt/clearpanel/backend/.env 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'" || true)
  ADMIN_USER=$(grep "^ADMIN_USERNAME=" /opt/clearpanel/backend/.env 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'" || true)
fi

# ── Banner ────────────────────────────────────────────────────────
echo ""
echo -e "${RED}${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}${BOLD}║           ClearPanel — Complete Uninstallation              ║${NC}"
echo -e "${RED}${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}This will remove:${NC}"
echo "  • ClearPanel application (/opt/clearpanel)"
echo "  • ClearPanel systemd service"
echo "  • ClearPanel system user, groups, ACLs, and sudoers"
echo "  • ClearPanel CLI tools (/usr/local/bin/clearpanel, quota-warning.sh)"
echo "  • ClearPanel mail configs (/etc/clearpanel)"
echo "  • ClearPanel state data (/var/lib/clearpanel)"
echo "  • Nginx ClearPanel + domain vhosts + snippets"
echo "  • Postfix ClearPanel configs (postscreen, sasl, rate-limit)"
echo "  • Dovecot ClearPanel configs (10-clearpanel.conf, SSO master, quota)"
echo "  • Rspamd ClearPanel configs (DKIM, DMARC, ARC, antivirus)"
echo "  • OpenDKIM keys and tables"
echo "  • Roundcube SSO plugin"
echo "  • BIND9 ClearPanel zone files"
echo "  • Certbot ClearPanel renewal hooks"
echo "  • UFW firewall rules added by ClearPanel"
echo "  • ClearPanel cron jobs"
echo "  • PHP-FPM custom pool configs"
if [[ -n "$DATA_DIR" ]]; then
  echo "  • Panel data directory ($DATA_DIR)"
fi
if $PURGE_DATA; then
  echo ""
  echo -e "  ${RED}${BOLD}--purge: ALSO removing:${NC}"
  echo -e "  ${RED}  • ALL mail data in /var/vmail${NC}"
  echo -e "  ${RED}  • ALL website files in /home/*/public_html${NC}"
  echo -e "  ${RED}  • ALL backup archives in /home/backups/clearpanel${NC}"
  echo -e "  ${RED}  • ALL Roundcube data and logs${NC}"
  echo -e "  ${RED}  • vmail user/group${NC}"
fi
if $REMOVE_PKGS; then
  echo ""
  echo -e "  ${RED}${BOLD}--remove-pkgs: ALSO purging APT packages:${NC}"
  echo -e "  ${RED}  • postfix, dovecot, rspamd, clamav, opendkim, postsrsd${NC}"
  echo -e "  ${RED}  • roundcube, redis-server, certbot${NC}"
  $KEEP_NGINX    || echo -e "  ${RED}  • nginx${NC}"
  $KEEP_BIND     || echo -e "  ${RED}  • bind9${NC}"
  $KEEP_NODE     || echo -e "  ${RED}  • nodejs (+ NodeSource repo)${NC}"
  $KEEP_PHP      || echo -e "  ${RED}  • php*${NC}"
  $KEEP_MYSQL    || echo -e "  ${RED}  • mysql-server / mariadb-server${NC}"
  $KEEP_POSTGRES || echo -e "  ${RED}  • postgresql${NC}"
  echo -e "  ${RED}  • phpmyadmin, pgadmin4-web, fail2ban, mailman3${NC}"
fi
echo ""

if ! $AUTO_YES; then
  read -rp "Are you sure you want to continue? (type YES to confirm): " CONFIRM
  if [[ "$CONFIRM" != "YES" ]]; then
    echo "Aborted."
    exit 0
  fi
fi

echo ""

# ── Helpers ───────────────────────────────────────────────────────
REMOVED=0
WARNED=0
log()  { echo -e "${GREEN}  [✓]${NC} $*"; REMOVED=$((REMOVED + 1)); }
warn() { echo -e "${YELLOW}  [!]${NC} $*"; WARNED=$((WARNED + 1)); }
step() { echo -e "\n${CYAN}${BOLD}── $* ──${NC}"; }

safe_rm() {
  for p in "$@"; do
    if [[ -e "$p" || -L "$p" ]]; then
      rm -rf "$p" && log "Removed $p" || warn "Failed to remove $p"
    fi
  done
}

# ══════════════════════════════════════════════════════════════════
#  1. Stop and disable ClearPanel service
# ══════════════════════════════════════════════════════════════════
step "1/19  Stopping ClearPanel service"

systemctl stop clearpanel 2>/dev/null || true
systemctl disable clearpanel 2>/dev/null || true
safe_rm /etc/systemd/system/clearpanel.service
systemctl daemon-reload 2>/dev/null || true
log "ClearPanel service stopped and removed"

# ══════════════════════════════════════════════════════════════════
#  2. Stop mail and related services
# ══════════════════════════════════════════════════════════════════
step "2/19  Stopping mail and related services"

for svc in postfix dovecot rspamd clamav-daemon clamav-freshclam opendkim postsrsd redis-server; do
  if systemctl is-active --quiet "$svc" 2>/dev/null; then
    systemctl stop "$svc" 2>/dev/null || true
  fi
  if $REMOVE_PKGS; then
    systemctl disable "$svc" 2>/dev/null || true
  fi
done
log "Mail services stopped"

# ══════════════════════════════════════════════════════════════════
#  3. Remove ClearPanel application directory
# ══════════════════════════════════════════════════════════════════
step "3/19  Removing ClearPanel application"

safe_rm /opt/clearpanel
log "Application directory removed"

# ══════════════════════════════════════════════════════════════════
#  4. Remove ClearPanel CLI tools
# ══════════════════════════════════════════════════════════════════
step "4/19  Removing CLI tools"

safe_rm /usr/local/bin/clearpanel
safe_rm /usr/local/bin/quota-warning.sh

# App-store CLI tools (only if --remove-pkgs)
if $REMOVE_PKGS; then
  safe_rm /usr/local/bin/composer
  safe_rm /usr/local/bin/wp
fi

# ══════════════════════════════════════════════════════════════════
#  5. Remove system user, groups, sudoers, ACLs, cron
# ══════════════════════════════════════════════════════════════════
step "5/19  Removing system user and permissions"

# Remove cron jobs for clearpanel user
crontab -r -u clearpanel 2>/dev/null || true
log "Removed clearpanel cron jobs"

# Remove ACL on /home
setfacl -x u:clearpanel /home 2>/dev/null || true
log "Removed ACL entry on /home"

# Remove all sudoers files
safe_rm /etc/sudoers.d/clearpanel
safe_rm /etc/sudoers.d/clearpanel-nginx
safe_rm /etc/sudoers.d/clearpanel-bind9
safe_rm /etc/sudoers.d/clearpanel-ssl
safe_rm /etc/sudoers.d/clearpanel-mysql
safe_rm /etc/sudoers.d/clearpanel-database

# Remove user (also removes home dir and mail spool)
if id clearpanel &>/dev/null; then
  userdel -r clearpanel 2>/dev/null || userdel clearpanel 2>/dev/null || true
  log "User 'clearpanel' removed"
fi

# ══════════════════════════════════════════════════════════════════
#  6. Remove ClearPanel data and state directories
# ══════════════════════════════════════════════════════════════════
step "6/19  Removing ClearPanel data and state"

# Panel state (stack.json, DKIM state, domain metadata)
safe_rm /var/lib/clearpanel

# Panel data directory (setup-status, JSON configs from .env DATA_DIR)
if [[ -n "$DATA_DIR" && -d "$DATA_DIR" ]]; then
  safe_rm "$DATA_DIR"
fi

# ClearPanel mail config directory
safe_rm /etc/clearpanel

# ══════════════════════════════════════════════════════════════════
#  7. Remove Nginx ClearPanel configurations
# ══════════════════════════════════════════════════════════════════
step "7/19  Removing Nginx configurations"

# ClearPanel main configs
safe_rm /etc/nginx/sites-enabled/clearpanel
safe_rm /etc/nginx/sites-available/clearpanel
safe_rm /etc/nginx/conf.d/clearpanel.conf

# ClearPanel nginx snippets (app-store installed)
safe_rm /etc/nginx/snippets/phpmyadmin.conf
safe_rm /etc/nginx/snippets/pgadmin.conf

# ClearPanel-created domain vhosts (matching marker comment)
for vhost in /etc/nginx/sites-available/*; do
  [[ -f "$vhost" ]] || continue
  VHOST_NAME="$(basename "$vhost")"
  # Skip system defaults
  case "$VHOST_NAME" in
    default|default.conf) continue ;;
  esac
  # Remove if it contains ClearPanel markers
  if grep -qi "clearpanel\|# Managed by ClearPanel" "$vhost" 2>/dev/null; then
    safe_rm "/etc/nginx/sites-enabled/$VHOST_NAME"
    safe_rm "$vhost"
  fi
done

# Webmail vhosts
for vhost in /etc/nginx/sites-available/webmail.* /etc/nginx/sites-available/mail.*; do
  [[ -f "$vhost" ]] || continue
  VHOST_NAME="$(basename "$vhost")"
  if grep -qi "roundcube\|clearpanel" "$vhost" 2>/dev/null; then
    safe_rm "/etc/nginx/sites-enabled/$VHOST_NAME"
    safe_rm "$vhost"
  fi
done

# ClearPanel domain-specific nginx logs
for logf in /var/log/nginx/*-access.log /var/log/nginx/*-error.log; do
  [[ -f "$logf" ]] || continue
  DOMAIN=$(basename "$logf" | sed 's/-\(access\|error\)\.log$//')
  if [[ "$DOMAIN" != "access" && "$DOMAIN" != "error" ]]; then
    safe_rm "$logf"
  fi
done

# Restore nginx directory ownership to root
if [[ -d /etc/nginx/sites-available ]]; then
  chown -R root:root /etc/nginx/sites-available 2>/dev/null || true
  chown -R root:root /etc/nginx/sites-enabled 2>/dev/null || true
  log "Nginx ownership restored to root"
fi

# Restore default site if it was removed
if [[ -f /etc/nginx/sites-available/default ]] && [[ ! -e /etc/nginx/sites-enabled/default ]]; then
  ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default 2>/dev/null || true
  log "Restored default nginx site"
fi

# Reload nginx if it's still running
if systemctl is-active --quiet nginx 2>/dev/null; then
  nginx -t 2>/dev/null && systemctl reload nginx 2>/dev/null || true
  log "Nginx reloaded"
fi

# ══════════════════════════════════════════════════════════════════
#  8. Remove Postfix ClearPanel configurations
# ══════════════════════════════════════════════════════════════════
step "8/19  Removing Postfix ClearPanel configurations"

safe_rm /etc/postfix/postscreen_access.cidr
safe_rm /etc/postfix/sasl_passwd
safe_rm /etc/postfix/sasl_passwd.db
safe_rm /etc/postfix/sender_rate_limit
safe_rm /etc/postfix/rate-limit-policy.sh
safe_rm /var/spool/postfix/rate-counters
safe_rm /var/lib/postfix/postscreen_cache
safe_rm /var/lib/postfix/postscreen_cache.db

# Clean master.cf backup files
for bak in /etc/postfix/master.cf.bak.*; do
  [[ -f "$bak" ]] && safe_rm "$bak"
done

# Restore master.cf from most recent backup if available
MASTER_BAK=$(ls -t /etc/postfix/master.cf.bak.* 2>/dev/null | head -1 || true)
if [[ -n "$MASTER_BAK" && -f "$MASTER_BAK" ]]; then
  cp "$MASTER_BAK" /etc/postfix/master.cf 2>/dev/null || true
  log "Restored master.cf from backup: $MASTER_BAK"
elif [[ -f /etc/postfix/master.cf ]]; then
  # Remove ClearPanel-added submission and postscreen blocks
  sed -i '/^submission inet/,/^[^ ]/{ /^submission inet/d; /^  -o /d; }' /etc/postfix/master.cf 2>/dev/null || true
  sed -i '/^# ClearPanel/d' /etc/postfix/master.cf 2>/dev/null || true
  sed -i '/^smtp.*postscreen$/d; /^smtpd.*pass$/d; /^tlsproxy.*unix$/d; /^dnsblog.*unix$/d' /etc/postfix/master.cf 2>/dev/null || true
  log "Cleaned ClearPanel entries from master.cf"
fi

# Reset ClearPanel-specific main.cf settings
if command -v postconf &>/dev/null && [[ -f /etc/postfix/main.cf ]]; then
  for setting in \
    virtual_mailbox_domains virtual_mailbox_maps virtual_alias_maps \
    virtual_mailbox_base virtual_uid_maps virtual_gid_maps virtual_transport \
    smtpd_milters non_smtpd_milters \
    postscreen_dnsbl_sites postscreen_dnsbl_threshold \
    postscreen_greet_action postscreen_access_list \
    postscreen_cache_map postscreen_dnsbl_action \
    sender_canonical_maps recipient_canonical_maps \
    relayhost smtp_sasl_auth_enable smtp_sasl_password_maps \
    smtp_sasl_security_options smtp_tls_security_level \
    smtpd_sender_restrictions smtpd_relay_restrictions \
    smtpd_tls_cert_file smtpd_tls_key_file smtpd_tls_chain_files \
    milter_default_action milter_protocol \
    smtpd_recipient_restrictions; do
    postconf -X "$setting" 2>/dev/null || true
  done
  log "ClearPanel Postfix settings removed from main.cf"
fi

# ══════════════════════════════════════════════════════════════════
#  9. Remove Dovecot ClearPanel configurations
# ══════════════════════════════════════════════════════════════════
step "9/19  Removing Dovecot ClearPanel configurations"

safe_rm /etc/dovecot/conf.d/10-clearpanel.conf
safe_rm /etc/dovecot/conf.d/auth-master.conf.ext
safe_rm /etc/dovecot/conf.d/90-quota.conf
safe_rm /etc/dovecot/master-users
safe_rm /etc/dovecot/sieve-before.d

# Clean master-user and SSO entries from 10-auth.conf
if [[ -f /etc/dovecot/conf.d/10-auth.conf ]]; then
  sed -i '/^auth_master_user_separator/d' /etc/dovecot/conf.d/10-auth.conf 2>/dev/null || true
  sed -i '/auth-master\.conf\.ext/d' /etc/dovecot/conf.d/10-auth.conf 2>/dev/null || true
  log "Cleaned ClearPanel entries from Dovecot 10-auth.conf"
fi

# Restore original 10-ssl.conf if backup exists
if [[ -f /etc/dovecot/conf.d/10-ssl.conf.bak ]]; then
  cp /etc/dovecot/conf.d/10-ssl.conf.bak /etc/dovecot/conf.d/10-ssl.conf 2>/dev/null || true
  safe_rm /etc/dovecot/conf.d/10-ssl.conf.bak
  log "Restored original Dovecot SSL config"
fi

# ══════════════════════════════════════════════════════════════════
# 10. Remove Rspamd ClearPanel configurations
# ══════════════════════════════════════════════════════════════════
step "10/19  Removing Rspamd ClearPanel configurations"

safe_rm /etc/rspamd/local.d/dkim_signing.conf
safe_rm /etc/rspamd/local.d/milter_headers.conf
safe_rm /etc/rspamd/local.d/antivirus.conf
safe_rm /etc/rspamd/local.d/dmarc.conf
safe_rm /etc/rspamd/local.d/arc.conf
safe_rm /etc/rspamd/local.d/redis.conf

# ══════════════════════════════════════════════════════════════════
# 11. Remove OpenDKIM keys and tables
# ══════════════════════════════════════════════════════════════════
step "11/19  Removing OpenDKIM keys"

safe_rm /etc/opendkim/keys
safe_rm /etc/opendkim/key.table
safe_rm /etc/opendkim/signing.table

# ══════════════════════════════════════════════════════════════════
# 12. Remove Roundcube SSO plugin and ClearPanel config modifications
# ══════════════════════════════════════════════════════════════════
step "12/19  Removing Roundcube SSO plugin"

safe_rm /usr/share/roundcube/plugins/clearpanel_sso

# Remove ClearPanel-injected lines from Roundcube config
ROUNDCUBE_CONF="/etc/roundcube/config.inc.php"
if [[ -f "$ROUNDCUBE_CONF" ]]; then
  sed -i "/'clearpanel_sso',/d" "$ROUNDCUBE_CONF" 2>/dev/null || true
  log "Removed SSO plugin from Roundcube config"
fi

# ══════════════════════════════════════════════════════════════════
# 13. Remove BIND9 ClearPanel zone files
# ══════════════════════════════════════════════════════════════════
step "13/19  Removing BIND9 zone files"

if ! $KEEP_BIND; then
  if [[ -d /etc/bind/zones ]]; then
    rm -rf /etc/bind/zones/* 2>/dev/null || true
    log "Removed ClearPanel zone files from /etc/bind/zones"
  fi

  if [[ -f /etc/bind/named.conf.local ]]; then
    sed -i '/\/\/ ClearPanel zone/,/^};/d' /etc/bind/named.conf.local 2>/dev/null || true
    chown root:root /etc/bind/named.conf.local 2>/dev/null || true
    chmod 644 /etc/bind/named.conf.local 2>/dev/null || true
    log "Cleaned named.conf.local"
  fi

  if [[ -d /etc/bind/zones ]]; then
    chown -R root:root /etc/bind/zones 2>/dev/null || true
    chmod 755 /etc/bind/zones 2>/dev/null || true
  fi
else
  warn "Keeping BIND9 zone files (--keep-bind)"
fi

# ══════════════════════════════════════════════════════════════════
# 14. Remove Certbot renewal hooks
# ══════════════════════════════════════════════════════════════════
step "14/19  Removing Certbot renewal hooks"

safe_rm /etc/letsencrypt/renewal-hooks/deploy/clearpanel-mail-tls.sh

# ══════════════════════════════════════════════════════════════════
# 15. Remove PHP-FPM custom pool configs
# ══════════════════════════════════════════════════════════════════
step "15/19  Removing PHP-FPM custom pool configs"

for pooldir in /etc/php/*/fpm/pool.d; do
  [[ -d "$pooldir" ]] || continue
  for pool in "$pooldir"/*.conf; do
    [[ -f "$pool" ]] || continue
    POOL_NAME="$(basename "$pool")"
    # Skip the default www pool
    [[ "$POOL_NAME" == "www.conf" ]] && continue
    # Remove pools that contain ClearPanel markers
    if grep -qi "clearpanel\|; ClearPanel" "$pool" 2>/dev/null; then
      safe_rm "$pool"
    fi
  done
done

# ══════════════════════════════════════════════════════════════════
# 16. Remove UFW firewall rules
# ══════════════════════════════════════════════════════════════════
step "16/19  Removing ClearPanel firewall rules"

# ClearPanel panel port
ufw delete allow 3334/tcp 2>/dev/null || true

# Mail ports
for port in 25/tcp 587/tcp 993/tcp 143/tcp 4190/tcp; do
  ufw delete allow "$port" 2>/dev/null || true
done

# Web ports (keep if nginx is kept)
if ! $KEEP_NGINX; then
  ufw delete allow 80/tcp 2>/dev/null || true
  ufw delete allow 443/tcp 2>/dev/null || true
fi

# DNS ports (keep if BIND9 is kept)
if ! $KEEP_BIND; then
  ufw delete allow 53/tcp 2>/dev/null || true
  ufw delete allow 53/udp 2>/dev/null || true
fi

log "Firewall rules cleaned"

# ══════════════════════════════════════════════════════════════════
# 17. Purge user data (--purge)
# ══════════════════════════════════════════════════════════════════
if $PURGE_DATA; then
  step "17/19  Purging all user data (--purge)"

  # Mail data
  safe_rm /var/vmail
  log "Removed /var/vmail (all mailbox data)"

  # Roundcube data and logs
  safe_rm /var/lib/roundcube
  safe_rm /var/log/roundcube

  # Remove vmail user/group
  if id vmail &>/dev/null; then
    userdel vmail 2>/dev/null || true
    log "Removed vmail user"
  fi
  if getent group vmail &>/dev/null; then
    groupdel vmail 2>/dev/null || true
    log "Removed vmail group"
  fi

  # Backups
  safe_rm /home/backups/clearpanel
  log "Removed backup directory"

  # Website files — only delete public_html dirs, not entire user homes
  if [[ -n "$ADMIN_USER" && -d "/home/$ADMIN_USER/public_html" ]]; then
    safe_rm "/home/$ADMIN_USER/public_html"
    safe_rm "/home/$ADMIN_USER/etc/clearpanel"
    log "Removed admin website files and panel data for $ADMIN_USER"
  fi

  # Warn about databases (don't auto-drop — too dangerous)
  if command -v mysql &>/dev/null && mysqladmin ping &>/dev/null 2>&1; then
    SYSTEM_DBS="information_schema|mysql|performance_schema|sys|phpmyadmin"
    DBS=$(mysql -N -B -e "SHOW DATABASES" 2>/dev/null | grep -Ev "^($SYSTEM_DBS)$" || true)
    if [[ -n "$DBS" ]]; then
      warn "Found non-system MySQL databases: $(echo "$DBS" | tr '\n' ', ')"
      warn "These are NOT automatically dropped. To remove manually:"
      for db in $DBS; do
        echo "        mysql -e \"DROP DATABASE \\\`$db\\\`;\""
      done
    fi
    # Drop phpmyadmin database (app-store created)
    mysql -e "DROP DATABASE IF EXISTS phpmyadmin;" 2>/dev/null || true
    mysql -e "DROP USER IF EXISTS 'phpmyadmin'@'localhost';" 2>/dev/null || true
  fi

  if command -v psql &>/dev/null && sudo -u postgres psql -c "" &>/dev/null 2>&1; then
    warn "PostgreSQL databases are NOT automatically dropped."
    warn "To remove manually: sudo -u postgres psql -c \"DROP DATABASE <name>;\""
  fi

  # Let's Encrypt certificates
  if [[ -d /etc/letsencrypt ]]; then
    warn "Let's Encrypt certificates NOT automatically removed."
    warn "To remove: sudo certbot delete --cert-name <domain>"
    warn "Or completely: sudo rm -rf /etc/letsencrypt"
  fi
else
  step "17/19  Preserving user data"
  warn "Mail data preserved in /var/vmail (use --purge to remove)"
  if [[ -d /home/backups/clearpanel ]]; then
    warn "Backups preserved in /home/backups/clearpanel (use --purge to remove)"
  fi
  if [[ -n "$ADMIN_USER" && -d "/home/$ADMIN_USER/public_html" ]]; then
    warn "Website files preserved in /home/$ADMIN_USER/public_html (use --purge to remove)"
  fi
fi

# ══════════════════════════════════════════════════════════════════
# 18. Purge APT packages (--remove-pkgs)
# ══════════════════════════════════════════════════════════════════
if $REMOVE_PKGS; then
  step "18/19  Purging APT packages (--remove-pkgs)"

  export DEBIAN_FRONTEND=noninteractive

  # Mail stack
  apt-get purge -y -qq \
    postfix postfix-pcre \
    dovecot-core dovecot-imapd dovecot-lmtpd dovecot-sieve dovecot-managesieved \
    rspamd \
    clamav clamav-daemon clamav-freshclam \
    opendkim opendkim-tools \
    postsrsd \
    2>/dev/null || true
  log "Mail packages purged"

  # Roundcube
  apt-get purge -y -qq roundcube roundcube-core roundcube-plugins roundcube-plugins-extra 2>/dev/null || true
  safe_rm /var/lib/roundcube
  safe_rm /var/log/roundcube
  safe_rm /etc/roundcube
  log "Roundcube purged"

  # Redis
  apt-get purge -y -qq redis-server redis-tools 2>/dev/null || true
  log "Redis purged"

  # App store packages
  apt-get purge -y -qq phpmyadmin pgadmin4-web fail2ban mailman3-full 2>/dev/null || true
  log "App store packages purged"

  # Certbot
  apt-get purge -y -qq certbot python3-certbot-nginx 2>/dev/null || true
  snap remove certbot 2>/dev/null || true
  log "Certbot purged"

  # Nginx (unless kept)
  if ! $KEEP_NGINX; then
    apt-get purge -y -qq nginx nginx-common nginx-full nginx-core 2>/dev/null || true
    safe_rm /etc/nginx
    log "Nginx purged"
  fi

  # BIND9 (unless kept)
  if ! $KEEP_BIND; then
    apt-get purge -y -qq bind9 bind9utils bind9-doc bind9-dnsutils 2>/dev/null || true
    log "BIND9 purged"
  fi

  # Node.js (unless kept)
  if ! $KEEP_NODE; then
    apt-get purge -y -qq nodejs 2>/dev/null || true
    safe_rm /etc/apt/sources.list.d/nodesource.list
    safe_rm /etc/apt/keyrings/nodesource.gpg
    safe_rm /usr/share/keyrings/nodesource.gpg
    log "Node.js and NodeSource repo purged"
  fi

  # PHP (unless kept)
  if ! $KEEP_PHP; then
    for ver in 7.4 8.0 8.1 8.2 8.3 8.4; do
      apt-get purge -y -qq \
        "php${ver}-cli" "php${ver}-fpm" "php${ver}-common" \
        "php${ver}-mbstring" "php${ver}-xml" "php${ver}-intl" \
        "php${ver}-zip" "php${ver}-gd" "php${ver}-curl" \
        "php${ver}-ldap" "php${ver}-imagick" "php${ver}-sqlite3" \
        "php${ver}-mysql" "php${ver}-pgsql" "php${ver}-redis" \
        2>/dev/null || true
    done
    apt-get purge -y -qq php-imagick php-common 2>/dev/null || true
    log "PHP packages purged"
  fi

  # MySQL / MariaDB (unless kept)
  if ! $KEEP_MYSQL; then
    apt-get purge -y -qq \
      mysql-server mysql-client mysql-common \
      mariadb-server mariadb-client mariadb-common \
      2>/dev/null || true
    log "MySQL/MariaDB purged"
  fi

  # PostgreSQL (unless kept)
  if ! $KEEP_POSTGRES; then
    apt-get purge -y -qq \
      postgresql postgresql-client postgresql-contrib postgresql-common \
      2>/dev/null || true
    log "PostgreSQL purged"
  fi

  # Remove Rspamd APT repo
  safe_rm /etc/apt/sources.list.d/rspamd.list
  safe_rm /etc/apt/trusted.gpg.d/rspamd.gpg

  # Autoremove orphaned dependencies
  apt-get autoremove -y -qq 2>/dev/null || true
  apt-get clean 2>/dev/null || true
  log "Orphaned packages cleaned up"
else
  step "18/19  Preserving APT packages"
  warn "Packages kept (use --remove-pkgs to purge)"
fi

# ══════════════════════════════════════════════════════════════════
# 19. Restart remaining services if not purged
# ══════════════════════════════════════════════════════════════════
step "19/19  Restarting remaining services"

if ! $REMOVE_PKGS; then
  for svc in postfix dovecot rspamd; do
    if systemctl is-enabled --quiet "$svc" 2>/dev/null; then
      systemctl restart "$svc" 2>/dev/null || true
    fi
  done

  if ! $KEEP_BIND; then
    systemctl restart bind9 2>/dev/null || systemctl restart named 2>/dev/null || true
  fi
fi

systemctl daemon-reload 2>/dev/null || true

# ══════════════════════════════════════════════════════════════════
#  Summary
# ══════════════════════════════════════════════════════════════════
echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║           ClearPanel has been uninstalled                   ║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Removed:${NC} ${REMOVED} items"
if [[ $WARNED -gt 0 ]]; then
  echo -e "  ${BOLD}Warnings:${NC} ${WARNED}"
fi
echo ""
echo "  Summary:"
echo "  • ClearPanel application & service:       removed"
echo "  • ClearPanel user, sudoers, ACLs, cron:   removed"
echo "  • CLI tools (clearpanel, quota-warning):   removed"
echo "  • Mail configs (Postfix/Dovecot/Rspamd):  removed"
echo "  • Roundcube SSO plugin:                    removed"
echo "  • Nginx ClearPanel + domain vhosts:        removed"
echo "  • Nginx snippets (phpmyadmin, pgadmin):    removed"
echo "  • PHP-FPM custom pools:                    cleaned"
echo "  • BIND9 zone files:                        $(! $KEEP_BIND && echo 'removed' || echo 'kept (--keep-bind)')"
echo "  • UFW firewall rules:                      cleaned"
echo "  • Certbot renewal hooks:                   removed"
if $PURGE_DATA; then
  echo -e "  • Mail data (/var/vmail):                  ${RED}deleted${NC}"
  echo -e "  • Backups (/home/backups/clearpanel):       ${RED}deleted${NC}"
fi
if $REMOVE_PKGS; then
  echo -e "  • APT packages:                            ${RED}purged${NC}"
else
  echo "  • APT packages:                            kept"
fi
if ! $PURGE_DATA; then
  echo "  • User data (mail, websites, backups):     preserved"
fi
echo ""
echo "  To reinstall ClearPanel:"
echo "    curl -fsSL https://raw.githubusercontent.com/SefionITServices/clearPanel-ubuntu/main/install-online.sh | sudo bash"
echo ""
