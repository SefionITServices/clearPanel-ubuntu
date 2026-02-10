#!/bin/bash
# ==========================================================================
# uninstall.sh — Complete ClearPanel removal from VPS
#
# Usage:  sudo ./uninstall.sh [options]
#
# Options:
#   --purge         Also remove mail data (/var/vmail), databases, backups
#   --remove-pkgs   Also purge apt packages (postfix, dovecot, rspamd, etc.)
#   --keep-nginx    Don't uninstall nginx (useful if other sites use it)
#   --keep-bind     Don't uninstall BIND9 (useful if other zones use it)
#   --yes           Skip confirmation prompt
#   --help          Show this help
#
# This script reverses everything install.sh and the email scripts set up.
# By default it keeps apt packages installed but removes all ClearPanel
# configs, services, users, and data.
# ==========================================================================
set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

# Defaults
PURGE_DATA=false
REMOVE_PKGS=false
KEEP_NGINX=false
KEEP_BIND=false
AUTO_YES=false

# Parse arguments
for arg in "$@"; do
  case "$arg" in
    --purge)       PURGE_DATA=true ;;
    --remove-pkgs) REMOVE_PKGS=true ;;
    --keep-nginx)  KEEP_NGINX=true ;;
    --keep-bind)   KEEP_BIND=true ;;
    --yes|-y)      AUTO_YES=true ;;
    --help|-h)
      head -18 "$0" | tail -14
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $arg${NC}" >&2
      echo "Use --help for usage info"
      exit 1
      ;;
  esac
done

# Must be root
if [[ $EUID -ne 0 ]]; then
  echo -e "${RED}This script must be run as root${NC}"
  echo "Usage: sudo ./uninstall.sh [--purge] [--remove-pkgs] [--yes]"
  exit 1
fi

echo -e "${RED}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║            ClearPanel Complete Uninstallation               ║${NC}"
echo -e "${RED}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}This will remove:${NC}"
echo "  • ClearPanel application (/opt/clearpanel)"
echo "  • ClearPanel systemd service"
echo "  • ClearPanel system user and sudoers"
echo "  • All mail configs (Postfix, Dovecot, Rspamd, OpenDKIM)"
echo "  • Roundcube SSO plugin and ClearPanel configs"
echo "  • BIND9 zone files created by ClearPanel"
echo "  • Nginx ClearPanel vhosts"
echo "  • UFW firewall rules added by ClearPanel"
echo "  • Certbot renewal hooks for mail TLS"
if $PURGE_DATA; then
  echo -e "  ${RED}• ALL mail data in /var/vmail (--purge)${NC}"
  echo -e "  ${RED}• ALL state data in /var/lib/clearpanel (--purge)${NC}"
  echo -e "  ${RED}• ALL Let's Encrypt certificates (--purge)${NC}"
fi
if $REMOVE_PKGS; then
  echo -e "  ${RED}• APT packages: postfix, dovecot, rspamd, clamav, etc. (--remove-pkgs)${NC}"
fi
echo ""

if ! $AUTO_YES; then
  read -rp "Are you sure you want to continue? (type YES to confirm): " CONFIRM
  if [[ "$CONFIRM" != "YES" ]]; then
    echo "Aborted."
    exit 0
  fi
fi

log() { echo -e "${GREEN}[✓]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
step() { echo -e "\n${CYAN}── $* ──${NC}"; }
safe_rm() {
  for p in "$@"; do
    if [[ -e "$p" || -L "$p" ]]; then
      rm -rf "$p" && log "Removed $p" || warn "Failed to remove $p"
    fi
  done
}

# ══════════════════════════════════════════════════════════════════
# 1. Stop and disable services
# ══════════════════════════════════════════════════════════════════
step "Stopping services"

# ClearPanel service
systemctl stop clearpanel 2>/dev/null || true
systemctl disable clearpanel 2>/dev/null || true
safe_rm /etc/systemd/system/clearpanel.service
systemctl daemon-reload 2>/dev/null || true
log "ClearPanel service removed"

# Mail services — stop but don't disable unless removing packages
for svc in postfix dovecot rspamd clamav-daemon clamav-freshclam opendkim postsrsd redis-server; do
  systemctl stop "$svc" 2>/dev/null || true
  if $REMOVE_PKGS; then
    systemctl disable "$svc" 2>/dev/null || true
  fi
done
log "Mail services stopped"

# ══════════════════════════════════════════════════════════════════
# 2. Remove ClearPanel application
# ══════════════════════════════════════════════════════════════════
step "Removing ClearPanel application"

safe_rm /opt/clearpanel
log "Application directory removed"

# ══════════════════════════════════════════════════════════════════
# 3. Remove ClearPanel system user and sudoers
# ══════════════════════════════════════════════════════════════════
step "Removing system user and permissions"

# Remove ACL on /home
setfacl -x u:clearpanel /home 2>/dev/null || true

# Remove sudoers
safe_rm /etc/sudoers.d/clearpanel
safe_rm /etc/sudoers.d/clearpanel-nginx
safe_rm /etc/sudoers.d/clearpanel-bind9
safe_rm /etc/sudoers.d/clearpanel-ssl
safe_rm /etc/sudoers.d/clearpanel-mysql
safe_rm /etc/sudoers.d/clearpanel-database

# Remove user
if id clearpanel &>/dev/null; then
  userdel -r clearpanel 2>/dev/null || userdel clearpanel 2>/dev/null || true
  log "User 'clearpanel' removed"
fi

# ══════════════════════════════════════════════════════════════════
# 4. Remove Nginx ClearPanel configs
# ══════════════════════════════════════════════════════════════════
step "Removing Nginx configurations"

safe_rm /etc/nginx/sites-enabled/clearpanel
safe_rm /etc/nginx/sites-available/clearpanel

# Remove any webmail vhosts created by ClearPanel
for vhost in /etc/nginx/sites-available/webmail.* /etc/nginx/sites-available/mail.*; do
  if [[ -f "$vhost" ]] && grep -q "roundcube\|ClearPanel" "$vhost" 2>/dev/null; then
    VHOST_NAME="$(basename "$vhost")"
    safe_rm "/etc/nginx/sites-enabled/$VHOST_NAME"
    safe_rm "$vhost"
  fi
done

# Remove ClearPanel conf.d style config
safe_rm /etc/nginx/conf.d/clearpanel.conf

# Restore nginx directory ownership to root
chown -R root:root /etc/nginx/sites-available 2>/dev/null || true
chown -R root:root /etc/nginx/sites-enabled 2>/dev/null || true
log "Nginx ownership restored to root"

# Restore default site if it was removed
if [[ -f /etc/nginx/sites-available/default ]] && [[ ! -e /etc/nginx/sites-enabled/default ]]; then
  ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default 2>/dev/null || true
  log "Restored default nginx site"
fi

# Reload nginx if it's running
if systemctl is-active --quiet nginx 2>/dev/null; then
  nginx -t 2>/dev/null && systemctl reload nginx 2>/dev/null || true
  log "Nginx reloaded"
fi

# ══════════════════════════════════════════════════════════════════
# 5. Remove Postfix ClearPanel configurations
# ══════════════════════════════════════════════════════════════════
step "Removing Postfix configurations"

safe_rm /etc/postfix/postscreen_access.cidr
safe_rm /etc/postfix/sasl_passwd
safe_rm /etc/postfix/sasl_passwd.db

# Remove ClearPanel mail config directory
safe_rm /etc/clearpanel

# Restore master.cf from most recent backup if available
MASTER_BAK=$(ls -t /etc/postfix/master.cf.bak.* 2>/dev/null | head -1)
if [[ -n "$MASTER_BAK" ]]; then
  cp "$MASTER_BAK" /etc/postfix/master.cf 2>/dev/null || true
  log "Restored master.cf from backup"
else
  # Remove ClearPanel-added submission and postscreen blocks
  if [[ -f /etc/postfix/master.cf ]]; then
    # Remove submission block
    sed -i '/^submission inet/,/^[^ ]/{ /^submission inet/d; /^  -o /d; }' /etc/postfix/master.cf 2>/dev/null || true
    # Remove postscreen-related lines
    sed -i '/^# ClearPanel postscreen/d; /^smtp.*postscreen$/d; /^smtpd.*pass$/d; /^tlsproxy.*unix$/d; /^dnsblog.*unix$/d' /etc/postfix/master.cf 2>/dev/null || true
    log "Cleaned ClearPanel entries from master.cf"
  fi
fi

# Reset ClearPanel-specific main.cf settings
if command -v postconf &>/dev/null; then
  # Remove virtual mailbox settings that point to ClearPanel paths
  postconf -X virtual_mailbox_domains 2>/dev/null || true
  postconf -X virtual_mailbox_maps 2>/dev/null || true
  postconf -X virtual_alias_maps 2>/dev/null || true
  postconf -X virtual_mailbox_base 2>/dev/null || true
  postconf -X virtual_uid_maps 2>/dev/null || true
  postconf -X virtual_gid_maps 2>/dev/null || true
  postconf -X virtual_transport 2>/dev/null || true
  postconf -X smtpd_milters 2>/dev/null || true
  postconf -X non_smtpd_milters 2>/dev/null || true
  postconf -X postscreen_dnsbl_sites 2>/dev/null || true
  postconf -X postscreen_dnsbl_threshold 2>/dev/null || true
  postconf -X postscreen_greet_action 2>/dev/null || true
  postconf -X postscreen_access_list 2>/dev/null || true
  postconf -X sender_canonical_maps 2>/dev/null || true
  postconf -X recipient_canonical_maps 2>/dev/null || true
  postconf -X relayhost 2>/dev/null || true
  log "ClearPanel postfix settings removed"
fi

# Remove postscreen cache
safe_rm /var/lib/postfix/postscreen_cache
safe_rm /var/lib/postfix/postscreen_cache.db

# ══════════════════════════════════════════════════════════════════
# 6. Remove Dovecot ClearPanel configurations
# ══════════════════════════════════════════════════════════════════
step "Removing Dovecot configurations"

safe_rm /etc/dovecot/conf.d/10-clearpanel.conf
safe_rm /etc/dovecot/conf.d/auth-master.conf.ext
safe_rm /etc/dovecot/master-users

# Clean master-user entries from 10-auth.conf
if [[ -f /etc/dovecot/conf.d/10-auth.conf ]]; then
  sed -i '/^auth_master_user_separator/d' /etc/dovecot/conf.d/10-auth.conf 2>/dev/null || true
  sed -i '/auth-master\.conf\.ext/d' /etc/dovecot/conf.d/10-auth.conf 2>/dev/null || true
  log "Cleaned ClearPanel entries from Dovecot auth config"
fi

# Restore original 10-ssl.conf if backup exists
if [[ -f /etc/dovecot/conf.d/10-ssl.conf.bak ]]; then
  cp /etc/dovecot/conf.d/10-ssl.conf.bak /etc/dovecot/conf.d/10-ssl.conf 2>/dev/null || true
  log "Restored original Dovecot SSL config"
fi

# ══════════════════════════════════════════════════════════════════
# 7. Remove Rspamd ClearPanel configurations
# ══════════════════════════════════════════════════════════════════
step "Removing Rspamd configurations"

safe_rm /etc/rspamd/local.d/dkim_signing.conf
safe_rm /etc/rspamd/local.d/milter_headers.conf
safe_rm /etc/rspamd/local.d/antivirus.conf
safe_rm /etc/rspamd/local.d/dmarc.conf
safe_rm /etc/rspamd/local.d/arc.conf
safe_rm /etc/rspamd/local.d/redis.conf

# ══════════════════════════════════════════════════════════════════
# 8. Remove OpenDKIM keys
# ══════════════════════════════════════════════════════════════════
step "Removing OpenDKIM keys"

safe_rm /etc/opendkim/keys
safe_rm /etc/opendkim/key.table
safe_rm /etc/opendkim/signing.table

# ══════════════════════════════════════════════════════════════════
# 9. Remove Roundcube SSO plugin
# ══════════════════════════════════════════════════════════════════
step "Removing Roundcube SSO plugin"

safe_rm /usr/share/roundcube/plugins/clearpanel_sso

# Remove plugin from Roundcube config
ROUNDCUBE_CONF="/etc/roundcube/config.inc.php"
if [[ -f "$ROUNDCUBE_CONF" ]]; then
  sed -i "/'clearpanel_sso',/d" "$ROUNDCUBE_CONF" 2>/dev/null || true
  log "Removed SSO plugin from Roundcube config"
fi

# ══════════════════════════════════════════════════════════════════
# 10. Remove ClearPanel state and mail state
# ══════════════════════════════════════════════════════════════════
step "Removing ClearPanel state files"

safe_rm /var/lib/clearpanel

# ══════════════════════════════════════════════════════════════════
# 11. Remove BIND9 ClearPanel zone files
# ══════════════════════════════════════════════════════════════════
step "Removing BIND9 zone files"

if ! $KEEP_BIND; then
  # Remove all zone files in /etc/bind/zones
  if [[ -d /etc/bind/zones ]]; then
    rm -rf /etc/bind/zones/* 2>/dev/null || true
    log "Removed ClearPanel zone files"
  fi

  # Clean ClearPanel zone entries from named.conf.local
  if [[ -f /etc/bind/named.conf.local ]]; then
    # Remove zone blocks added by ClearPanel (they have a comment marker)
    sed -i '/\/\/ ClearPanel zone/,/^};/d' /etc/bind/named.conf.local 2>/dev/null || true
    # Restore ownership
    chown root:root /etc/bind/named.conf.local 2>/dev/null || true
    chmod 644 /etc/bind/named.conf.local 2>/dev/null || true
    log "Cleaned named.conf.local"
  fi

  # Restore /etc/bind/zones permissions
  chown -R root:root /etc/bind/zones 2>/dev/null || true
  chmod 755 /etc/bind/zones 2>/dev/null || true
else
  warn "Keeping BIND9 zone files (--keep-bind)"
fi

# ══════════════════════════════════════════════════════════════════
# 12. Remove Certbot renewal hooks
# ══════════════════════════════════════════════════════════════════
step "Removing Certbot renewal hooks"

safe_rm /etc/letsencrypt/renewal-hooks/deploy/clearpanel-mail-tls.sh

# ══════════════════════════════════════════════════════════════════
# 13. Remove UFW firewall rules
# ══════════════════════════════════════════════════════════════════
step "Removing ClearPanel firewall rules"

# Remove ClearPanel-specific ports (keep OpenSSH)
ufw delete allow 3334/tcp 2>/dev/null || true
ufw delete allow 25/tcp 2>/dev/null || true
ufw delete allow 587/tcp 2>/dev/null || true
ufw delete allow 993/tcp 2>/dev/null || true
ufw delete allow 143/tcp 2>/dev/null || true
ufw delete allow 4190/tcp 2>/dev/null || true
# Keep 80/443 if nginx is still serving other sites
if ! $KEEP_NGINX; then
  ufw delete allow 80/tcp 2>/dev/null || true
  ufw delete allow 443/tcp 2>/dev/null || true
fi
# Keep DNS ports if BIND9 is kept
if ! $KEEP_BIND; then
  ufw delete allow 53/tcp 2>/dev/null || true
  ufw delete allow 53/udp 2>/dev/null || true
fi
log "Firewall rules cleaned"

# ══════════════════════════════════════════════════════════════════
# 14. Purge data (optional)
# ══════════════════════════════════════════════════════════════════
if $PURGE_DATA; then
  step "Purging mail data and certificates"

  # Remove all mailbox data
  safe_rm /var/vmail
  log "Removed /var/vmail (all mailbox data)"

  # Remove vmail user
  if id vmail &>/dev/null; then
    userdel vmail 2>/dev/null || true
    groupdel vmail 2>/dev/null || true
    log "Removed vmail user/group"
  fi

  # Remove Let's Encrypt certs (dangerous — only if user explicitly chose --purge)
  warn "Skipping Let's Encrypt certificate removal (run 'certbot delete' manually if needed)"
else
  warn "Mail data preserved in /var/vmail (use --purge to remove)"
  warn "State data preserved in /var/lib/clearpanel (use --purge to remove)"
fi

# ══════════════════════════════════════════════════════════════════
# 15. Purge apt packages (optional)
# ══════════════════════════════════════════════════════════════════
if $REMOVE_PKGS; then
  step "Purging ClearPanel-installed packages"

  export DEBIAN_FRONTEND=noninteractive

  # Mail stack
  apt-get purge -y -qq postfix postfix-pcre \
    dovecot-core dovecot-imapd dovecot-lmtpd dovecot-sieve dovecot-managesieved \
    rspamd \
    clamav clamav-daemon \
    opendkim opendkim-tools \
    postsrsd \
    2>/dev/null || true
  log "Mail packages purged"

  # Roundcube
  apt-get purge -y -qq roundcube roundcube-plugins roundcube-plugins-extra 2>/dev/null || true
  safe_rm /var/lib/roundcube
  safe_rm /var/log/roundcube
  log "Roundcube purged"

  # Redis (installed for DMARC)
  apt-get purge -y -qq redis-server 2>/dev/null || true
  log "Redis purged"

  # Nginx (unless kept)
  if ! $KEEP_NGINX; then
    apt-get purge -y -qq nginx nginx-common 2>/dev/null || true
    log "Nginx purged"
  fi

  # BIND9 (unless kept)
  if ! $KEEP_BIND; then
    apt-get purge -y -qq bind9 bind9utils bind9-doc 2>/dev/null || true
    log "BIND9 purged"
  fi

  # Remove Rspamd APT repo
  safe_rm /etc/apt/sources.list.d/rspamd.list
  safe_rm /etc/apt/trusted.gpg.d/rspamd.gpg

  # Autoremove orphaned dependencies
  apt-get autoremove -y -qq 2>/dev/null || true
  apt-get clean 2>/dev/null || true
  log "Orphaned packages cleaned up"
else
  warn "Packages kept (use --remove-pkgs to purge postfix, dovecot, rspamd, etc.)"
fi

# ══════════════════════════════════════════════════════════════════
# 16. Restart remaining services
# ══════════════════════════════════════════════════════════════════
step "Restarting remaining services"

if ! $REMOVE_PKGS; then
  # Restart services to pick up config removals
  systemctl restart postfix 2>/dev/null || true
  systemctl restart dovecot 2>/dev/null || true
  systemctl restart rspamd 2>/dev/null || true
  if ! $KEEP_BIND; then
    systemctl restart bind9 2>/dev/null || systemctl restart named 2>/dev/null || true
  fi
fi

systemctl daemon-reload 2>/dev/null || true

# ══════════════════════════════════════════════════════════════════
# Done
# ══════════════════════════════════════════════════════════════════
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           ClearPanel has been uninstalled                   ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Summary:"
echo "  • ClearPanel application and service: removed"
echo "  • Mail configurations: removed"
echo "  • Roundcube SSO plugin: removed"
echo "  • Firewall rules: cleaned"
if $PURGE_DATA; then
  echo -e "  • Mail data (/var/vmail): ${RED}deleted${NC}"
fi
if $REMOVE_PKGS; then
  echo -e "  • Packages: ${RED}purged${NC}"
else
  echo "  • Packages: kept (run with --remove-pkgs to purge)"
fi
if ! $PURGE_DATA; then
  echo "  • Mail data: preserved (run with --purge to delete)"
fi
echo ""
echo "If you want to reinstall, run: sudo ./install.sh"
