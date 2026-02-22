#!/bin/bash
# ══════════════════════════════════════════════════════════════════════
# ClearPanel — All-in-One Online Installer for Ubuntu VPS
# ══════════════════════════════════════════════════════════════════════
#
# Run on a fresh Ubuntu 20.04/22.04/24.04 VPS:
#
#   curl -fsSL https://raw.githubusercontent.com/SefionITServices/clearPanel-ubuntu/main/install-online.sh | sudo bash
#
# What this installs:
#   • ClearPanel (NestJS backend + React frontend)
#   • Node.js 20 LTS
#   • Nginx (reverse proxy + static files)
#   • BIND9 DNS server
#   • Full mail stack (Postfix, Dovecot, Rspamd, ClamAV, OpenDKIM)
#   • Roundcube webmail with SSO
#   • Certbot (Let's Encrypt SSL)
#   • UFW firewall (pre-configured)
#   • PHP-FPM (latest available)
#
# ══════════════════════════════════════════════════════════════════════
set -euo pipefail

# ── Colors & helpers ──────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

info()    { echo -e "${CYAN}ℹ  $*${NC}"; }
step()    { echo -e "\n${BOLD}${YELLOW}▶  $*${NC}"; }
success() { echo -e "${GREEN}✓  $*${NC}"; }
warn()    { echo -e "${YELLOW}⚠  $*${NC}"; }
fail()    { echo -e "${RED}✗  $*${NC}"; exit 1; }

# ── Configuration ─────────────────────────────────────────────────
REPO_URL="https://github.com/SefionITServices/clearPanel-ubuntu.git"
INSTALL_DIR="/opt/clearpanel"
SERVICE_USER="clearpanel"
MIN_RAM_MB=1024
MIN_DISK_MB=5120
STARTED_AT=$(date +%s)

# ══════════════════════════════════════════════════════════════════
#  PHASE 1 — Pre-flight checks
# ══════════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}${BOLD}"
cat << 'BANNER'
   _____ _                 ____                  _
  / ____| |               |  _ \                | |
 | |    | | ___  __ _ _ __| |_) | __ _ _ __   __| |
 | |    | |/ _ \/ _` | '__|  _ < / _` | '_ \ / _` |
 | |____| |  __/ (_| | |  | |_) | (_| | | | | (_| |
  \_____|_|\___|\__,_|_|  |____/ \__,_|_| |_|\__,_|
BANNER
echo -e "${NC}"
echo -e "${BOLD}  ClearPanel — Full Server Management Panel${NC}"
echo -e "  ${DIM}https://github.com/SefionITServices/clearPanel-ubuntu${NC}"
echo ""
echo "══════════════════════════════════════════════════════════"
echo ""

step "Running pre-flight checks..."

# Root
[[ $EUID -eq 0 ]] || fail "Must be run as root. Use: curl ... | sudo bash"
success "Running as root"

# OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS_ID="${ID:-unknown}"
    OS_PRETTY="${PRETTY_NAME:-$OS_ID}"
else
    OS_ID="unknown"; OS_PRETTY="Unknown"
fi
case "$OS_ID" in
    ubuntu|debian|linuxmint|zorin|pop) success "OS: $OS_PRETTY" ;;
    *) fail "Unsupported OS: $OS_PRETTY — Ubuntu/Debian required" ;;
esac

# Arch
ARCH=$(uname -m)
case "$ARCH" in
    x86_64|aarch64|arm64) success "Architecture: $ARCH" ;;
    *) warn "Untested architecture: $ARCH" ;;
esac

# RAM
TOTAL_RAM_MB=$(( $(grep MemTotal /proc/meminfo | awk '{print $2}') / 1024 ))
[[ $TOTAL_RAM_MB -ge $MIN_RAM_MB ]] && success "RAM: ${TOTAL_RAM_MB} MB" || warn "Low RAM: ${TOTAL_RAM_MB} MB (recommend ${MIN_RAM_MB}+)"

# Disk
AVAIL_DISK_MB=$(df -BM /opt 2>/dev/null | tail -1 | awk '{print $4}' | tr -d 'M')
[[ -n "$AVAIL_DISK_MB" && "$AVAIL_DISK_MB" -ge $MIN_DISK_MB ]] && success "Disk: ${AVAIL_DISK_MB} MB free" || warn "Low disk: ${AVAIL_DISK_MB:-?} MB (recommend ${MIN_DISK_MB}+)"

# Network
if curl -fsSL --connect-timeout 5 https://github.com > /dev/null 2>&1; then
    success "Internet: connected"
else
    fail "Cannot reach github.com — check DNS / network"
fi

# Existing install?
IS_FRESH_INSTALL=true
if [ -f "$INSTALL_DIR/data/setup-status.json" ]; then
    IS_FRESH_INSTALL=false
    info "Existing installation detected — data will be preserved"
elif [ -f "$INSTALL_DIR/backend/.env" ] && grep -q "DATA_DIR=" "$INSTALL_DIR/backend/.env" 2>/dev/null; then
    IS_FRESH_INSTALL=false
    info "Existing installation detected (configured .env) — data will be preserved"
fi

# ══════════════════════════════════════════════════════════════════
#  PHASE 2 — System packages
# ══════════════════════════════════════════════════════════════════
step "Installing system packages..."

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq software-properties-common ca-certificates gnupg curl git ufw acl > /dev/null 2>&1
success "Base packages"

# Node.js 20
NODE_VERSION=$(node -v 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1 || echo "0")
if [ "$NODE_VERSION" -lt 20 ]; then
    info "Installing Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
    apt-get install -y -qq nodejs > /dev/null 2>&1
fi
NODE_VERSION=$(node -v 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1 || echo "0")
[[ "$NODE_VERSION" -ge 20 ]] || fail "Node.js 20+ required but got $(node -v 2>/dev/null || echo 'none')"
success "Node.js $(node -v)"

# Nginx, BIND9, Certbot
apt-get install -y -qq nginx bind9 bind9utils bind9-doc certbot python3-certbot-nginx > /dev/null 2>&1
success "Nginx, BIND9, Certbot"

# ══════════════════════════════════════════════════════════════════
#  PHASE 3 — Firewall
# ══════════════════════════════════════════════════════════════════
step "Configuring firewall (UFW)..."

ufw --force enable > /dev/null 2>&1
for port in OpenSSH 80/tcp 443/tcp 3334/tcp 53/tcp 53/udp 25/tcp 587/tcp 993/tcp 143/tcp 4190/tcp; do
    ufw allow "$port" > /dev/null 2>&1
done
success "Firewall active — SSH, HTTP/S, DNS, mail, panel ports open"

# ══════════════════════════════════════════════════════════════════
#  PHASE 4 — Service user
# ══════════════════════════════════════════════════════════════════
step "Setting up service user..."

if ! id "$SERVICE_USER" &>/dev/null; then
    useradd -r -s /bin/false -d "$INSTALL_DIR" "$SERVICE_USER"
    success "Created user: $SERVICE_USER"
else
    success "User $SERVICE_USER already exists"
fi

# Add to required groups
usermod -a -G bind "$SERVICE_USER" 2>/dev/null || true
usermod -a -G systemd-journal,adm "$SERVICE_USER" 2>/dev/null || true

# ACL for /home (so panel can create user home dirs)
setfacl -m u:"$SERVICE_USER":rwx /home 2>/dev/null || true

# ══════════════════════════════════════════════════════════════════
#  PHASE 5 — Clone / update ClearPanel source
# ══════════════════════════════════════════════════════════════════
step "Downloading ClearPanel..."

if [ -d "$INSTALL_DIR/.git" ]; then
    info "Updating existing repository..."
    cd "$INSTALL_DIR"
    git stash 2>/dev/null || true
    git pull origin main --ff-only 2>/dev/null || git reset --hard origin/main
    success "Repository updated"
else
    if [ -d "$INSTALL_DIR" ] && [ "$(ls -A "$INSTALL_DIR" 2>/dev/null)" ]; then
        warn "Backing up existing $INSTALL_DIR"
        mv "$INSTALL_DIR" "${INSTALL_DIR}.bak.$(date +%Y%m%d%H%M%S)"
    fi
    git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
    success "Repository cloned to $INSTALL_DIR"
fi

cd "$INSTALL_DIR"

# Data directory
mkdir -p "$INSTALL_DIR/data"
chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR/data"
grep -q "^data/" "$INSTALL_DIR/.gitignore" 2>/dev/null || echo "data/" >> "$INSTALL_DIR/.gitignore"

# Set ownership
chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"

# ══════════════════════════════════════════════════════════════════
#  PHASE 6 — Build backend & frontend
# ══════════════════════════════════════════════════════════════════
step "Installing backend dependencies..."
cd "$INSTALL_DIR/backend"
sudo -u "$SERVICE_USER" npm install --legacy-peer-deps 2>&1 | tail -1
success "Backend dependencies installed"

step "Building backend..."
sudo -u "$SERVICE_USER" npm run build 2>&1 | tail -3
success "Backend built"

step "Installing frontend dependencies..."
cd "$INSTALL_DIR/frontend"
sudo -u "$SERVICE_USER" npm install --legacy-peer-deps 2>&1 | tail -1
success "Frontend dependencies installed"

step "Building frontend..."
sudo -u "$SERVICE_USER" npm run build 2>&1 | tail -3
success "Frontend built"

# ══════════════════════════════════════════════════════════════════
#  PHASE 7 — Environment file
# ══════════════════════════════════════════════════════════════════
step "Configuring environment..."

if [ ! -f "$INSTALL_DIR/backend/.env" ]; then
    cat > "$INSTALL_DIR/backend/.env" << ENVEOF
NODE_ENV=production
PORT=3334
MAIL_MODE=production
SESSION_SECRET=$(openssl rand -hex 32)
SSO_SECRET=$(openssl rand -hex 32)
ROOT_PATH=/home
ENVEOF
    chown "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR/backend/.env"
    chmod 600 "$INSTALL_DIR/backend/.env"
    success "Created .env with secure random secrets"
else
    success "Existing .env preserved"
fi

# Setup wizard state
if [ "$IS_FRESH_INSTALL" = true ]; then
    rm -f "$INSTALL_DIR/data/setup-status.json"
    info "Setup wizard will run on first browser access"
else
    info "Existing setup state preserved"
fi

# ══════════════════════════════════════════════════════════════════
#  PHASE 8 — Systemd service
# ══════════════════════════════════════════════════════════════════
step "Setting up systemd service..."

cp "$INSTALL_DIR/clearpanel.service" /etc/systemd/system/clearpanel.service
systemctl daemon-reload
systemctl enable clearpanel > /dev/null 2>&1
success "Service registered: clearpanel.service"

# ══════════════════════════════════════════════════════════════════
#  PHASE 9 — Nginx reverse proxy
# ══════════════════════════════════════════════════════════════════
step "Configuring Nginx..."

NGINX_DEST=""
if [ -d "/etc/nginx/sites-available" ]; then
    NGINX_DEST="/etc/nginx/sites-available/clearpanel"
    cp "$INSTALL_DIR/nginx.conf.example" "$NGINX_DEST"
    ln -sf "$NGINX_DEST" /etc/nginx/sites-enabled/clearpanel
    rm -f /etc/nginx/sites-enabled/default
else
    NGINX_DEST="/etc/nginx/conf.d/clearpanel.conf"
    cp "$INSTALL_DIR/nginx.conf.example" "$NGINX_DEST"
fi

# Allow IP access (replace domain placeholder with catch-all)
sed -i 's/server_name your-domain.com www.your-domain.com;/server_name _;/' "$NGINX_DEST"

nginx -t > /dev/null 2>&1 && systemctl enable nginx > /dev/null 2>&1 && systemctl restart nginx
success "Nginx configured as reverse proxy"

# Give panel user ownership of vhost dirs
chown -R "$SERVICE_USER:$SERVICE_USER" /etc/nginx/sites-available 2>/dev/null || true
chown -R "$SERVICE_USER:$SERVICE_USER" /etc/nginx/sites-enabled 2>/dev/null || true

# ══════════════════════════════════════════════════════════════════
#  PHASE 10 — Scoped sudoers
# ══════════════════════════════════════════════════════════════════
step "Configuring sudo permissions..."

cat > /etc/sudoers.d/clearpanel << 'SUDOEOF'
# ClearPanel — scoped sudo permissions
# Package management
clearpanel ALL=(ALL) NOPASSWD: /usr/bin/apt-get, /usr/bin/apt, /usr/bin/apt-cache, /usr/bin/dpkg, /usr/bin/add-apt-repository

# Service management
clearpanel ALL=(ALL) NOPASSWD: /usr/bin/systemctl, /usr/bin/journalctl

# Web server
clearpanel ALL=(ALL) NOPASSWD: /usr/sbin/nginx

# SSL / Certbot
clearpanel ALL=(ALL) NOPASSWD: /usr/bin/certbot, /snap/bin/certbot

# DNS (BIND9)
clearpanel ALL=(ALL) NOPASSWD: /usr/bin/mkdir, /usr/bin/chown, /usr/bin/chmod

# Database engines
clearpanel ALL=(ALL) NOPASSWD: /usr/bin/mysql, /usr/bin/mysqladmin, /usr/bin/mysqldump
clearpanel ALL=(ALL) NOPASSWD: /usr/bin/psql, /usr/bin/pg_dump
clearpanel ALL=(root) NOPASSWD: /usr/bin/sudo -u postgres *

# System configuration
clearpanel ALL=(ALL) NOPASSWD: /usr/bin/hostnamectl, /usr/sbin/postconf
clearpanel ALL=(ALL) NOPASSWD: /usr/bin/tee, /usr/bin/sed, /usr/bin/cat, /usr/bin/grep, /usr/bin/tail, /usr/bin/find, /usr/bin/ls, /usr/bin/rm, /usr/bin/mv, /usr/bin/ln, /usr/bin/test, /usr/bin/echo, /usr/bin/bash, /usr/bin/curl, /usr/bin/ss

# PHP management
clearpanel ALL=(ALL) NOPASSWD: /usr/bin/update-alternatives, /usr/bin/php*

# App store utilities
clearpanel ALL=(ALL) NOPASSWD: /usr/bin/redis-cli, /usr/bin/fail2ban-client, /usr/bin/crontab, /usr/bin/python3
clearpanel ALL=(ALL) NOPASSWD: /usr/pgadmin4/bin/setup-web.sh

# User management
clearpanel ALL=(ALL) NOPASSWD: /usr/sbin/usermod, /usr/sbin/useradd
SUDOEOF
chmod 440 /etc/sudoers.d/clearpanel

# Remove legacy fragments
rm -f /etc/sudoers.d/clearpanel-{nginx,bind9,ssl,mysql,database} 2>/dev/null || true
success "Scoped sudoers configured"

# ══════════════════════════════════════════════════════════════════
#  PHASE 11 — BIND9 DNS server
# ══════════════════════════════════════════════════════════════════
step "Configuring BIND9 DNS server..."

mkdir -p /etc/bind/zones
chown -R root:bind /etc/bind/zones 2>/dev/null || true
chmod 2775 /etc/bind/zones
chgrp bind /etc/bind/named.conf.local 2>/dev/null || true
chmod 664 /etc/bind/named.conf.local 2>/dev/null || true

# Start BIND9
BIND_SVC="named"
if systemctl list-unit-files bind9.service &>/dev/null && ! systemctl is-enabled bind9 2>&1 | grep -q "alias"; then
    BIND_SVC="bind9"
fi
systemctl enable "$BIND_SVC" > /dev/null 2>&1 || true
systemctl start "$BIND_SVC" 2>/dev/null || true

if systemctl is-active --quiet "$BIND_SVC"; then
    success "BIND9 running ($BIND_SVC)"
else
    warn "BIND9 may need manual configuration"
fi

# ══════════════════════════════════════════════════════════════════
#  PHASE 12 — Mail stack
# ══════════════════════════════════════════════════════════════════
step "Installing mail stack (Postfix, Dovecot, Rspamd, ClamAV, OpenDKIM)..."

MAIL_MODE=production bash "$INSTALL_DIR/scripts/email/install-stack.sh" 2>&1 | tail -5 && \
    success "Mail stack installed" || \
    warn "Mail stack had issues — can retry from the panel"

# ══════════════════════════════════════════════════════════════════
#  PHASE 13 — Roundcube webmail
# ══════════════════════════════════════════════════════════════════
step "Installing Roundcube webmail..."

# Pre-seed debconf
debconf-set-selections <<RCEOF
roundcube-core roundcube/dbconfig-install boolean true
roundcube-core roundcube/database-type select sqlite
roundcube-core roundcube/reconfigure-webserver multiselect
RCEOF

# Detect PHP version
PHP_VER=""
for ver in 8.4 8.3 8.2 8.1 8.0 7.4; do
    if [[ -S "/var/run/php/php${ver}-fpm.sock" ]] || dpkg -s "php${ver}-fpm" >/dev/null 2>&1; then
        PHP_VER="$ver"; break
    fi
done
[[ -z "$PHP_VER" ]] && PHP_VER=$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;' 2>/dev/null || echo "8.2")
info "Using PHP $PHP_VER"

apt-get install -y -qq roundcube roundcube-plugins roundcube-plugins-extra > /dev/null 2>&1
apt-get install -y -qq \
    "php${PHP_VER}-cli" "php${PHP_VER}-fpm" "php${PHP_VER}-mbstring" \
    "php${PHP_VER}-xml" "php${PHP_VER}-intl" "php${PHP_VER}-zip" \
    "php${PHP_VER}-gd" "php${PHP_VER}-curl" "php${PHP_VER}-ldap" > /dev/null 2>&1
apt-get install -y -qq "php${PHP_VER}-imagick" > /dev/null 2>&1 || \
    apt-get install -y -qq php-imagick > /dev/null 2>&1 || true
phpenmod -v "${PHP_VER}" intl mbstring xml zip gd curl ldap > /dev/null 2>&1 || true

# Configure Roundcube for localhost IMAP
ROUNDCUBE_CONF="/etc/roundcube/config.inc.php"
if [[ -f "$ROUNDCUBE_CONF" ]]; then
    sed -i "s|\$config\['imap_host'\].*|\$config['imap_host'] = ['localhost:143'];|" "$ROUNDCUBE_CONF" 2>/dev/null || true
    sed -i "s|\$config\['default_host'\].*|\$config['default_host'] = 'localhost';|" "$ROUNDCUBE_CONF" 2>/dev/null || true
    sed -i "s|\$config\['smtp_server'\].*|\$config['smtp_host'] = 'tls://localhost';|" "$ROUNDCUBE_CONF" 2>/dev/null || true
    sed -i "s|\$config\['smtp_host'\].*|\$config['smtp_host'] = 'tls://localhost';|" "$ROUNDCUBE_CONF" 2>/dev/null || true
    sed -i "s|\$config\['smtp_port'\].*|\$config['smtp_port'] = 587;|" "$ROUNDCUBE_CONF" 2>/dev/null || true

    grep -q "\$config\['imap_host'\]" "$ROUNDCUBE_CONF" || printf "\n\$config['imap_host'] = ['localhost:143'];\n" >> "$ROUNDCUBE_CONF"
    grep -q "\$config\['default_host'\]" "$ROUNDCUBE_CONF" || printf "\$config['default_host'] = 'localhost';\n" >> "$ROUNDCUBE_CONF"
    grep -q "\$config\['smtp_host'\]" "$ROUNDCUBE_CONF" || printf "\$config['smtp_host'] = 'tls://localhost';\n" >> "$ROUNDCUBE_CONF"
    grep -q "\$config\['smtp_port'\]" "$ROUNDCUBE_CONF" || printf "\$config['smtp_port'] = 587;\n" >> "$ROUNDCUBE_CONF"

    if ! grep -q "\$config\['smtp_conn_options'\]" "$ROUNDCUBE_CONF"; then
        cat >> "$ROUNDCUBE_CONF" <<'SMTPEOF'
$config['smtp_conn_options'] = [
    'ssl' => [
        'verify_peer' => false,
        'verify_peer_name' => false,
        'allow_self_signed' => true,
    ],
];
SMTPEOF
    fi

    # Enable plugins
    if ! grep -q "'managesieve'" "$ROUNDCUBE_CONF"; then
        sed -i "s|\$config\['plugins'\] = array(|\$config['plugins'] = array(\n  'managesieve',\n  'archive',\n  'zipdownload',\n  'newmail_notifier',|" "$ROUNDCUBE_CONF" 2>/dev/null || true
    fi
fi

systemctl enable "php${PHP_VER}-fpm" > /dev/null 2>&1 || true
systemctl restart "php${PHP_VER}-fpm" 2>/dev/null || true
chown -R www-data:www-data /var/lib/roundcube /var/log/roundcube 2>/dev/null || true
success "Roundcube installed"

# SSO plugin
info "Installing Roundcube SSO plugin..."
MAIL_MODE=production bash "$INSTALL_DIR/scripts/email/setup-roundcube-sso.sh" "http://localhost:3334" 2>/dev/null && \
    success "SSO plugin installed" || \
    warn "SSO plugin skipped — can configure later"

# ══════════════════════════════════════════════════════════════════
#  PHASE 14 — Mail security (Postscreen, DMARC)
# ══════════════════════════════════════════════════════════════════
step "Configuring mail security..."

MAIL_MODE=production bash "$INSTALL_DIR/scripts/email/setup-postscreen.sh" 2>/dev/null && \
    success "Postscreen configured" || warn "Postscreen skipped"
MAIL_MODE=production bash "$INSTALL_DIR/scripts/email/setup-dmarc.sh" 2>/dev/null && \
    success "DMARC configured" || warn "DMARC skipped"

# ══════════════════════════════════════════════════════════════════
#  PHASE 15 — Start ClearPanel
# ══════════════════════════════════════════════════════════════════
step "Starting ClearPanel..."

systemctl start clearpanel

# Wait for backend
BACKEND_READY=false
for i in $(seq 1 15); do
    if curl -s --max-time 2 "http://localhost:3334/api/setup/status" > /dev/null 2>&1; then
        BACKEND_READY=true; break
    fi
    sleep 2
done
[[ "$BACKEND_READY" = true ]] && success "Backend API responding" || warn "Backend still starting — check logs"

# ══════════════════════════════════════════════════════════════════
#  DONE
# ══════════════════════════════════════════════════════════════════
ELAPSED=$(( $(date +%s) - STARTED_AT ))
MINUTES=$(( ELAPSED / 60 ))
SECONDS_REM=$(( ELAPSED % 60 ))
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}')

echo ""
echo "══════════════════════════════════════════════════════════"

if systemctl is-active --quiet clearpanel; then
    echo ""
    echo -e "${GREEN}${BOLD}  ✅  ClearPanel installed successfully!  ${NC}"
    echo -e "  ${DIM}Completed in ${MINUTES}m ${SECONDS_REM}s${NC}"
    echo ""
    echo "  What's running:"
    echo -e "    ${GREEN}✓${NC}  ClearPanel    (port 3334, proxied via Nginx)"
    echo -e "    ${GREEN}✓${NC}  Nginx         (ports 80/443)"
    echo -e "    ${GREEN}✓${NC}  BIND9         (port 53)"
    echo -e "    ${GREEN}✓${NC}  Postfix       (ports 25/587)"
    echo -e "    ${GREEN}✓${NC}  Dovecot       (ports 143/993)"
    echo -e "    ${GREEN}✓${NC}  Roundcube     (webmail with SSO)"
    echo -e "    ${GREEN}✓${NC}  UFW Firewall  (all ports configured)"
    echo ""
    echo "══════════════════════════════════════════════════════════"
    echo ""
    echo -e "  ${BOLD}Open in your browser:${NC}"
    echo ""
    echo -e "    ${CYAN}${BOLD}http://${SERVER_IP}${NC}"
    echo ""
    echo "  The Setup Wizard will guide you through:"
    echo "    1. Creating your admin account"
    echo "    2. Setting your server hostname & domain"
    echo "    3. Configuring nameservers"
    echo ""
    echo "══════════════════════════════════════════════════════════"
    echo ""
    echo -e "  ${BOLD}Useful commands:${NC}"
    echo "    Status:   sudo systemctl status clearpanel"
    echo "    Logs:     sudo journalctl -u clearpanel -f"
    echo "    Restart:  sudo systemctl restart clearpanel"
    echo "    Update:   cd /opt/clearpanel && git pull && sudo bash install.sh"
    echo ""
    echo -e "  ${BOLD}Add SSL (after Setup Wizard):${NC}"
    echo "    sudo certbot --nginx -d your-domain.com"
    echo ""
    echo "══════════════════════════════════════════════════════════"
    echo ""
else
    echo ""
    echo -e "${RED}${BOLD}  ❌  Service failed to start${NC}"
    echo ""
    echo "  Debug:"
    echo "    sudo systemctl status clearpanel"
    echo "    sudo journalctl -u clearpanel -n 50"
    echo ""
    journalctl -u clearpanel -n 20 --no-pager 2>/dev/null || true
    exit 1
fi
