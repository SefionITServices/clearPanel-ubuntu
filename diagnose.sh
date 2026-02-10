#!/bin/bash
# ─────────────────────────────────────────────────────────────
# ClearPanel Diagnostic Report
# Run:  sudo bash diagnose.sh
# Copy the entire output and share it for troubleshooting.
# ─────────────────────────────────────────────────────────────

LOG="/tmp/clearpanel-diagnose-$(date +%Y%m%d-%H%M%S).log"

# tee everything to file + stdout
exec > >(tee -a "$LOG") 2>&1

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
SEP="════════════════════════════════════════════════════════════════"

ok()   { echo -e "  ${GREEN}✓ $1${NC}"; }
warn() { echo -e "  ${YELLOW}⚠ $1${NC}"; }
fail() { echo -e "  ${RED}✗ $1${NC}"; }
header() { echo -e "\n${CYAN}${SEP}\n  $1\n${SEP}${NC}"; }

header "ClearPanel Diagnostic Report  —  $(date)"
echo "  Hostname : $(hostname)"
echo "  IP       : $(hostname -I 2>/dev/null | awk '{print $1}')"
echo "  OS       : $(lsb_release -ds 2>/dev/null || cat /etc/os-release 2>/dev/null | head -1)"
echo "  Kernel   : $(uname -r)"
echo "  Node     : $(node -v 2>/dev/null || echo 'NOT INSTALLED')"
echo "  npm      : $(npm -v 2>/dev/null || echo 'NOT INSTALLED')"

# ── 1. Core Services ─────────────────────────────────────────
header "1. Service Status"

SERVICES=(
  "clearpanel:ClearPanel Backend"
  "nginx:Nginx Web Server"
  "bind9:BIND9 DNS"
  "named:BIND9 DNS (alt)"
  "postfix:Postfix SMTP"
  "dovecot:Dovecot IMAP"
  "rspamd:Rspamd Spam Filter"
  "clamav-daemon:ClamAV Antivirus"
  "opendkim:OpenDKIM"
  "redis-server:Redis"
  "php8.1-fpm:PHP-FPM 8.1"
  "php8.2-fpm:PHP-FPM 8.2"
  "php8.3-fpm:PHP-FPM 8.3"
  "mysql:MySQL"
  "mariadb:MariaDB"
)

for entry in "${SERVICES[@]}"; do
  svc="${entry%%:*}"
  label="${entry##*:}"
  if systemctl list-unit-files "${svc}.service" &>/dev/null; then
    if systemctl is-active --quiet "$svc" 2>/dev/null; then
      ok "$label ($svc) — running"
    else
      fail "$label ($svc) — STOPPED"
      echo "      $(systemctl is-enabled "$svc" 2>/dev/null || echo 'not found')"
    fi
  fi
done

# ── 2. ClearPanel Backend ────────────────────────────────────
header "2. ClearPanel Backend"

if [[ -d /opt/clearpanel ]]; then
  ok "Install directory exists"
else
  fail "/opt/clearpanel does NOT exist"
fi

if [[ -f /opt/clearpanel/backend/dist/main.js ]]; then
  ok "Backend built (dist/main.js exists)"
else
  fail "Backend NOT built — dist/main.js missing"
fi

if [[ -f /opt/clearpanel/backend/.env ]]; then
  ok ".env file exists"
else
  warn ".env file missing — setup wizard not completed?"
fi

# Test API
echo ""
echo "  Testing API endpoint..."
API_RESP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3334/api/auth/status 2>/dev/null)
if [[ "$API_RESP" == "200" || "$API_RESP" == "401" ]]; then
  ok "API responding (HTTP $API_RESP)"
else
  fail "API not responding (HTTP $API_RESP)"
fi

# Last 20 lines of journal
echo ""
echo "  Last 20 journal lines:"
echo "  ──────────────────────"
journalctl -u clearpanel -n 20 --no-pager 2>/dev/null | sed 's/^/    /'

# ── 3. Nginx ─────────────────────────────────────────────────
header "3. Nginx"

if nginx -t 2>&1 | grep -q "successful"; then
  ok "Config syntax OK"
else
  fail "Nginx config has errors:"
  nginx -t 2>&1 | sed 's/^/    /'
fi

# Check if clearpanel site is enabled
if [[ -f /etc/nginx/sites-enabled/clearpanel ]] || [[ -f /etc/nginx/sites-enabled/clearpanel.conf ]]; then
  ok "ClearPanel site enabled"
else
  warn "No clearpanel site in /etc/nginx/sites-enabled/"
  echo "      Listing enabled sites:"
  ls -la /etc/nginx/sites-enabled/ 2>/dev/null | sed 's/^/        /'
fi

echo ""
echo "  Listening ports (nginx):"
ss -tulpn 2>/dev/null | grep nginx | sed 's/^/    /' || echo "    (none)"

echo ""
echo "  Nginx error log (last 15 lines):"
echo "  ──────────────────────"
tail -n 15 /var/log/nginx/error.log 2>/dev/null | sed 's/^/    /' || echo "    (no log)"

# ── 4. PHP-FPM (phpMyAdmin) ──────────────────────────────────
header "4. PHP-FPM / phpMyAdmin"

# Find active PHP-FPM
PHP_FPM_FOUND=""
for ver in 8.3 8.2 8.1 8.0 7.4; do
  svc="php${ver}-fpm"
  if systemctl list-unit-files "${svc}.service" &>/dev/null; then
    PHP_FPM_FOUND="$svc"
    if systemctl is-active --quiet "$svc" 2>/dev/null; then
      ok "$svc is running"
    else
      fail "$svc is STOPPED"
      echo "      Try: sudo systemctl start $svc"
    fi
    # Check socket
    SOCK="/run/php/php${ver}-fpm.sock"
    if [[ -S "$SOCK" ]]; then
      ok "Socket exists: $SOCK"
    else
      fail "Socket missing: $SOCK"
    fi
    break
  fi
done

if [[ -z "$PHP_FPM_FOUND" ]]; then
  fail "No PHP-FPM version found installed"
  echo "      Try: sudo apt install php-fpm"
fi

# Check phpMyAdmin installation
if [[ -d /usr/share/phpmyadmin ]]; then
  ok "phpMyAdmin installed at /usr/share/phpmyadmin"
elif [[ -d /var/www/phpmyadmin ]]; then
  ok "phpMyAdmin installed at /var/www/phpmyadmin"
else
  warn "phpMyAdmin directory not found in usual locations"
fi

# Check nginx phpmyadmin config
PMA_CONF=""
for f in /etc/nginx/sites-enabled/*phpmyadmin* /etc/nginx/sites-enabled/*pma*; do
  [[ -f "$f" ]] && PMA_CONF="$f" && break
done
# Also check if it's included inside another config
if [[ -z "$PMA_CONF" ]]; then
  PMA_HIT=$(grep -rl "phpmyadmin\|phpMyAdmin" /etc/nginx/sites-enabled/ 2>/dev/null | head -1)
  [[ -n "$PMA_HIT" ]] && PMA_CONF="$PMA_HIT"
fi
if [[ -n "$PMA_CONF" ]]; then
  ok "phpMyAdmin nginx config: $PMA_CONF"
else
  warn "No phpMyAdmin nginx config found in sites-enabled"
fi

# PHP-FPM error log
PHP_VER="${PHP_FPM_FOUND//php/}"; PHP_VER="${PHP_VER//-fpm/}"
if [[ -f "/var/log/php${PHP_VER}-fpm.log" ]]; then
  echo ""
  echo "  PHP-FPM log (last 10 lines):"
  echo "  ──────────────────────"
  tail -n 10 "/var/log/php${PHP_VER}-fpm.log" 2>/dev/null | sed 's/^/    /'
fi

# ── 5. Mail Stack ────────────────────────────────────────────
header "5. Mail Stack"

# Postfix
echo -e "  ${CYAN}── Postfix ──${NC}"
if command -v postconf &>/dev/null; then
  ok "Postfix installed"
  echo "    myhostname = $(postconf -h myhostname 2>/dev/null)"
  echo "    mydomain   = $(postconf -h mydomain 2>/dev/null)"
  echo "    inet_interfaces = $(postconf -h inet_interfaces 2>/dev/null)"

  # Check if Postfix is actually listening
  if ss -tulpn 2>/dev/null | grep -q ":25 "; then
    ok "Listening on port 25 (SMTP)"
  else
    fail "NOT listening on port 25"
  fi
  if ss -tulpn 2>/dev/null | grep -q ":587 "; then
    ok "Listening on port 587 (Submission)"
  else
    fail "NOT listening on port 587"
  fi
else
  fail "Postfix not installed"
fi

echo ""
echo "  Postfix log (last 15 lines):"
echo "  ──────────────────────"
grep -i "postfix\|smtp\|submission" /var/log/mail.log 2>/dev/null | tail -n 15 | sed 's/^/    /' || \
  journalctl -u postfix -n 15 --no-pager 2>/dev/null | sed 's/^/    /' || echo "    (no log)"

# Dovecot
echo ""
echo -e "  ${CYAN}── Dovecot ──${NC}"
if command -v doveconf &>/dev/null; then
  ok "Dovecot installed"
  if ss -tulpn 2>/dev/null | grep -q ":993 "; then
    ok "Listening on port 993 (IMAPS)"
  else
    fail "NOT listening on port 993"
  fi
  if ss -tulpn 2>/dev/null | grep -q ":143 "; then
    ok "Listening on port 143 (IMAP)"
  else
    warn "Not listening on port 143 (non-TLS IMAP)"
  fi
else
  fail "Dovecot not installed"
fi

echo ""
echo "  Dovecot log (last 10 lines):"
echo "  ──────────────────────"
grep -i "dovecot" /var/log/mail.log 2>/dev/null | tail -n 10 | sed 's/^/    /' || \
  journalctl -u dovecot -n 10 --no-pager 2>/dev/null | sed 's/^/    /' || echo "    (no log)"

# Rspamd
echo ""
echo -e "  ${CYAN}── Rspamd ──${NC}"
if command -v rspamc &>/dev/null; then
  ok "Rspamd installed"
  rspamc stat 2>/dev/null | head -5 | sed 's/^/    /' || warn "rspamc stat failed"
else
  warn "Rspamd not installed"
fi

# ClamAV
echo ""
echo -e "  ${CYAN}── ClamAV ──${NC}"
if systemctl is-active --quiet clamav-daemon 2>/dev/null; then
  ok "ClamAV daemon running"
elif systemctl is-active --quiet clamd 2>/dev/null; then
  ok "ClamAV daemon running (clamd)"
else
  warn "ClamAV daemon not running (may still be loading signatures)"
  echo "    Status: $(systemctl is-active clamav-daemon 2>/dev/null || echo 'not found')"
fi

# Mail domains & mailboxes on disk
echo ""
echo -e "  ${CYAN}── Mail Data ──${NC}"
if [[ -d /var/vmail ]]; then
  ok "/var/vmail exists"
  echo "    Domains on disk:"
  ls -1 /var/vmail/ 2>/dev/null | sed 's/^/      /' || echo "      (empty)"
else
  warn "/var/vmail does not exist (no mail domains provisioned yet)"
fi

# ClearPanel mail state
if [[ -d /var/lib/clearpanel/mail-state ]]; then
  ok "Mail state dir exists"
  echo "    Domain state files:"
  ls -1 /var/lib/clearpanel/mail-state/domains/ 2>/dev/null | sed 's/^/      /' || echo "      (empty)"
fi

# ── 6. Firewall ──────────────────────────────────────────────
header "6. Firewall (UFW)"

ufw status verbose 2>/dev/null | head -30 | sed 's/^/    /'

# ── 7. Listening Ports ───────────────────────────────────────
header "7. All Listening Ports"

ss -tulpn 2>/dev/null | sed 's/^/    /'

# ── 8. Disk & Memory ────────────────────────────────────────
header "8. System Resources"

echo "  Disk:"
df -h / /opt 2>/dev/null | sed 's/^/    /'
echo ""
echo "  Memory:"
free -h 2>/dev/null | sed 's/^/    /'
echo ""
echo "  Swap:"
swapon --show 2>/dev/null | sed 's/^/    /' || echo "    (no swap)"

# ── 9. Roundcube ─────────────────────────────────────────────
header "9. Roundcube Webmail"

if [[ -f /etc/roundcube/config.inc.php ]]; then
  ok "Roundcube config exists"
  echo "    default_host: $(grep 'default_host' /etc/roundcube/config.inc.php 2>/dev/null | head -1 | sed 's/^/    /')"
  echo "    smtp_server:  $(grep 'smtp_server' /etc/roundcube/config.inc.php 2>/dev/null | head -1 | sed 's/^/    /')"
else
  warn "Roundcube config not found"
fi

if [[ -d /var/lib/roundcube/plugins/clearpanel_sso ]]; then
  ok "SSO plugin installed"
else
  warn "SSO plugin not found"
fi

# Check Roundcube nginx vhost
RC_CONF=$(grep -rl "roundcube" /etc/nginx/sites-enabled/ 2>/dev/null | head -1)
if [[ -n "$RC_CONF" ]]; then
  ok "Roundcube nginx config: $RC_CONF"
else
  warn "No Roundcube nginx vhost enabled"
fi

# ── 10. Recent Errors (system-wide) ─────────────────────────
header "10. Recent Errors in System Logs"

echo "  /var/log/syslog errors (last 15):"
echo "  ──────────────────────"
grep -iE "error|fail|fatal|panic" /var/log/syslog 2>/dev/null | tail -n 15 | sed 's/^/    /' || echo "    (none)"

echo ""
echo "  /var/log/mail.log errors (last 15):"
echo "  ──────────────────────"
grep -iE "error|fail|fatal|reject|warning" /var/log/mail.log 2>/dev/null | tail -n 15 | sed 's/^/    /' || echo "    (none)"

echo ""
echo "  Nginx error.log (last 15):"
echo "  ──────────────────────"
grep -iE "error|crit|alert|emerg" /var/log/nginx/error.log 2>/dev/null | tail -n 15 | sed 's/^/    /' || echo "    (none)"

# ── 11. Config Checks ───────────────────────────────────────
header "11. Key Config Checks"

# Postfix main.cf sanity
if [[ -f /etc/postfix/main.cf ]]; then
  ok "Postfix main.cf exists"
  VIRT_TRANSPORT=$(postconf -h virtual_transport 2>/dev/null)
  echo "    virtual_transport = $VIRT_TRANSPORT"
  VIRT_MBOX=$(postconf -h virtual_mailbox_domains 2>/dev/null)
  echo "    virtual_mailbox_domains = $VIRT_MBOX"
  VIRT_MAPS=$(postconf -h virtual_mailbox_maps 2>/dev/null)
  echo "    virtual_mailbox_maps = $VIRT_MAPS"
  MILTER=$(postconf -h smtpd_milters 2>/dev/null)
  echo "    smtpd_milters = $MILTER"
else
  fail "Postfix main.cf missing"
fi

# Dovecot config check
if command -v doveconf &>/dev/null; then
  DOVE_ERR=$(doveconf 2>&1 >/dev/null)
  if [[ -z "$DOVE_ERR" ]]; then
    ok "Dovecot config OK"
  else
    fail "Dovecot config errors:"
    echo "$DOVE_ERR" | sed 's/^/      /'
  fi
fi

# ── Summary ──────────────────────────────────────────────────
header "Done — Report saved to $LOG"
echo ""
echo -e "  ${YELLOW}Copy the full output above, or run:${NC}"
echo -e "  ${GREEN}cat $LOG${NC}"
echo ""
echo -e "  ${YELLOW}Quick sharing:${NC}"
echo -e "  ${GREEN}cat $LOG | nc termbin.com 9999${NC}"
echo ""
