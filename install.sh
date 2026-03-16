#!/bin/bash
set -e

echo "🚀 Installing clearPanel on VPS..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
INSTALL_DIR="/opt/clearpanel"
SERVICE_USER="clearpanel"
SERVICE_FILE="clearpanel.service"
NGINX_CONF="nginx.conf.example"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}This script must be run as root${NC}"
   echo "Usage: sudo ./install.sh"
   exit 1
fi

echo -e "${YELLOW}📋 Installing system dependencies for Ubuntu/Zorin OS...${NC}"
# Ubuntu/Debian package management
if command -v apt-get &> /dev/null; then
    PKG_MANAGER="apt-get"
    apt-get update
    apt-get install -y software-properties-common
    # Clean any old Node.js / npm packages that conflict with NodeSource
    if dpkg -l nodejs 2>/dev/null | grep -q '^ii' || dpkg -l npm 2>/dev/null | grep -q '^ii'; then
        echo -e "${YELLOW}Removing old nodejs/npm packages to avoid conflicts...${NC}"
        apt-get purge -y nodejs npm 2>/dev/null || true
        apt-get autoremove -y 2>/dev/null || true
    fi
    # NodeSource deprecated setup_20.x scripts — use manual GPG key + apt repo
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
    apt-get update
    # Install Node.js (NodeSource package includes npm) and other system packages
    # NOTE: Do NOT install the separate 'npm' package — it conflicts with NodeSource's nodejs
    apt-get install -y nodejs nginx git curl ufw bind9 bind9utils bind9-doc certbot python3-certbot-nginx build-essential python3-dev
    # Refresh command hash so newly installed binaries are visible
    hash -r
    # Enable and configure UFW firewall
    ufw --force enable
    ufw allow OpenSSH
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw allow 3334/tcp
    ufw allow 53/tcp
    ufw allow 53/udp
else
    echo -e "${RED}This script is designed for Ubuntu/Zorin OS systems only${NC}"
    echo -e "${RED}Please use the AlmaLinux version for RHEL-based systems${NC}"
    exit 1
fi

# Verify Node.js 20+ is available
NODE_VERSION=$(node -v 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1)
if [ "${NODE_VERSION:-0}" -lt 20 ]; then
    echo -e "${RED}Node.js 20+ is required but not detected after installation. Please check NodeSource setup.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js $(node -v) detected${NC}"

# Create service user
if ! id "$SERVICE_USER" &>/dev/null; then
    echo -e "${YELLOW}👤 Creating service user: $SERVICE_USER${NC}"
    useradd -r -s /bin/false -d "$INSTALL_DIR" "$SERVICE_USER"
fi

# Detect if this is a re-install (panel already set up) vs fresh install
IS_FRESH_INSTALL=true
if [ -f "$INSTALL_DIR/data/setup-status.json" ]; then
    IS_FRESH_INSTALL=false
    echo -e "${CYAN}ℹ️  Existing installation detected — data will be preserved${NC}"
elif [ -f "$INSTALL_DIR/backend/.env" ] && grep -q "DATA_DIR=" "$INSTALL_DIR/backend/.env" 2>/dev/null; then
    # .env exists with DATA_DIR → setup was completed, setup-status may live in DATA_DIR
    IS_FRESH_INSTALL=false
    echo -e "${CYAN}ℹ️  Existing installation detected (configured .env) — data will be preserved${NC}"
fi

# Clone or update the repo directly in the install directory (keeps .git for easy updates)
REPO_URL="https://github.com/SefionITServices/clearPanel-ubuntu.git"

if [ -d "$INSTALL_DIR/.git" ]; then
    echo -e "${YELLOW}📥 Updating existing clearPanel installation...${NC}"
    cd "$INSTALL_DIR"
    git stash 2>/dev/null || true
    git pull origin main
elif [ -d "backend" ] && [ -d "frontend" ]; then
    # Running install.sh from inside a cloned repo — move/copy into INSTALL_DIR with git history
    echo -e "${YELLOW}📁 Setting up installation directory from local repo...${NC}"
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
    if [ "$SCRIPT_DIR" != "$INSTALL_DIR" ]; then
        mkdir -p "$INSTALL_DIR"
        # Copy everything including .git so updates work
        cp -a "$SCRIPT_DIR/." "$INSTALL_DIR/"
    fi
    cd "$INSTALL_DIR"
else
    echo -e "${YELLOW}📥 Downloading clearPanel source...${NC}"
    if command -v git &> /dev/null; then
        git clone "$REPO_URL" "$INSTALL_DIR"
        cd "$INSTALL_DIR"
    else
        echo -e "${RED}Error: git is not installed. Please install git first.${NC}"
        exit 1
    fi
fi

# Create minimal bootstrap directory (setup-status only)
# All user data will be stored in /home/<username>/etc/clearpanel/ after setup
mkdir -p "$INSTALL_DIR/data"
chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR/data"

# Grant clearpanel user permission to create user home dirs under /home
# Uses POSIX ACLs so we don't change /home ownership
echo -e "${YELLOW}🔑 Granting $SERVICE_USER write access to /home...${NC}"
apt-get install -y acl > /dev/null 2>&1 || true
setfacl -m u:"$SERVICE_USER":rwx /home

# Ensure data directory is in .gitignore so git pull doesn't affect user data
if ! grep -q "^data/" "$INSTALL_DIR/.gitignore" 2>/dev/null; then
    echo "data/" >> "$INSTALL_DIR/.gitignore"
fi

# Set ownership
chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"

# Resolve npm once so PATH is not an issue under sudo -u
# Try command -v first, then search in common paths if it fails
NPM="$(command -v npm)"
if [ -z "$NPM" ]; then
    for path in /usr/bin/npm /usr/local/bin/npm /opt/node/bin/npm; do
        if [ -x "$path" ]; then
            NPM="$path"
            break
        fi
    done
fi

if [ -z "$NPM" ]; then
    echo -e "${RED}Error: npm not found in PATH or common locations.${NC}"
    echo -e "${YELLOW}npm is bundled with NodeSource's nodejs package.${NC}"
    echo -e "${YELLOW}Try: mkdir -p /etc/apt/keyrings && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg && echo 'deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main' > /etc/apt/sources.list.d/nodesource.list && apt-get update && apt-get install -y nodejs && hash -r${NC}"
    exit 1
fi
echo -e "${GREEN}✓ npm found at: $NPM${NC}"

# Install backend dependencies
echo -e "${YELLOW}📦 Installing backend dependencies...${NC}"
cd "$INSTALL_DIR/backend"
sudo -u "$SERVICE_USER" env PATH="$PATH" "$NPM" install --legacy-peer-deps

# Build backend
echo -e "${YELLOW}🔧 Building backend...${NC}"
sudo -u "$SERVICE_USER" env PATH="$PATH" "$NPM" run build

# Install frontend dependencies and build
echo -e "${YELLOW}🎨 Building frontend...${NC}"
cd "$INSTALL_DIR/frontend"
sudo -u "$SERVICE_USER" env PATH="$PATH" "$NPM" install --legacy-peer-deps
sudo -u "$SERVICE_USER" env PATH="$PATH" "$NPM" run build

# Frontend vite config outputs directly to backend/public, no copy needed

# Create a minimal .env only if one doesn't already exist
# The setup wizard will generate the full .env with user-chosen credentials
if [ ! -f "$INSTALL_DIR/backend/.env" ]; then
    echo -e "${YELLOW}📝 Creating minimal environment for first boot...${NC}"
    cat > "$INSTALL_DIR/backend/.env" << EOF
NODE_ENV=production
PORT=3334
MAIL_MODE=production
SESSION_SECRET=$(openssl rand -hex 32)
ROOT_PATH=/home
EOF
    chown "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR/backend/.env"
    chmod 600 "$INSTALL_DIR/backend/.env"
fi

# Only clear setup-status on truly fresh installs (not re-installs / updates)
if [ "$IS_FRESH_INSTALL" = true ]; then
    rm -f "$INSTALL_DIR/data/setup-status.json"
    echo -e "${GREEN}✓ Setup wizard will run on first access${NC}"
else
    echo -e "${GREEN}✓ Existing setup state preserved — setup wizard will NOT re-run${NC}"
fi

# Setup systemd service
echo -e "${YELLOW}⚙️  Setting up systemd service...${NC}"
cp "$INSTALL_DIR/clearpanel.service" "/etc/systemd/system/clearpanel.service"
systemctl daemon-reload
systemctl enable clearpanel

# Configure nginx
echo -e "${YELLOW}🌐 Configuring nginx...${NC}"
cp "$INSTALL_DIR/nginx.conf.example" "/etc/nginx/sites-available/clearpanel" 2>/dev/null || \
    cp "$INSTALL_DIR/nginx.conf.example" "/etc/nginx/conf.d/clearpanel.conf"

# Update nginx config to work with IP access (change server_name to _ for default server)
NGINX_CONF_FILE=""
if [ -f "/etc/nginx/sites-available/clearpanel" ]; then
    NGINX_CONF_FILE="/etc/nginx/sites-available/clearpanel"
elif [ -f "/etc/nginx/conf.d/clearpanel.conf" ]; then
    NGINX_CONF_FILE="/etc/nginx/conf.d/clearpanel.conf"
fi

if [ -n "$NGINX_CONF_FILE" ]; then
    # Replace server_name with _ to allow IP access
    sed -i 's/server_name your-domain.com www.your-domain.com;/server_name _;/' "$NGINX_CONF_FILE"
fi

if [ -d "/etc/nginx/sites-enabled" ]; then
    ln -sf "/etc/nginx/sites-available/clearpanel" "/etc/nginx/sites-enabled/clearpanel"
    rm -f /etc/nginx/sites-enabled/default
fi

# Test and reload nginx
nginx -t && systemctl enable nginx && systemctl restart nginx

# Give clearpanel user ownership of nginx vhost directories
# so it can create/remove vhost configs without sudo
chown -R "$SERVICE_USER":"$SERVICE_USER" /etc/nginx/sites-available
chown -R "$SERVICE_USER":"$SERVICE_USER" /etc/nginx/sites-enabled

# Allow clearpanel user to manage services without password (used by automation)
echo -e "${YELLOW}🔐 Configuring sudoers permissions...${NC}"
bash "$INSTALL_DIR/scripts/update-sudoers.sh"

# Remove old fragmented sudoers files
rm -f /etc/sudoers.d/clearpanel-nginx 2>/dev/null || true
rm -f /etc/sudoers.d/clearpanel-bind9 2>/dev/null || true
rm -f /etc/sudoers.d/clearpanel-ssl 2>/dev/null || true
rm -f /etc/sudoers.d/clearpanel-mysql 2>/dev/null || true
rm -f /etc/sudoers.d/clearpanel-database 2>/dev/null || true

# Install CLI wrapper
echo -e "${YELLOW}🔧 Installing clearpanel CLI...${NC}"
if [ -f "$INSTALL_DIR/bin/clearpanel" ]; then
    chmod +x "$INSTALL_DIR/bin/clearpanel"
    ln -sf "$INSTALL_DIR/bin/clearpanel" /usr/local/bin/clearpanel
    echo "  CLI installed: clearpanel --help"
fi

# Configure BIND9 DNS server
echo -e "${YELLOW}🌐 Configuring BIND9 DNS server...${NC}"
# Create zones directory
mkdir -p /etc/bind/zones

# Add clearpanel user to bind group for zone file management
usermod -a -G bind "$SERVICE_USER" 2>/dev/null || true

# Add clearpanel user to journal/log groups so Log Viewer can read journalctl
usermod -a -G systemd-journal,adm "$SERVICE_USER" 2>/dev/null || true

# Set permissions so bind group can write (required for clearpanel user)
# Prefer root:bind ownership with setgid so new files inherit bind group.
chgrp -R bind /etc/bind/zones 2>/dev/null || true
chown -R root:bind /etc/bind/zones 2>/dev/null || true
chmod 2775 /etc/bind/zones

# Also allow clearpanel (via bind group) to write to named.conf.local (for zone configuration)
chgrp bind /etc/bind/named.conf.local 2>/dev/null || true
chmod 664 /etc/bind/named.conf.local 2>/dev/null || true

# (sudoers for BIND9, certbot, databases already covered by /etc/sudoers.d/clearpanel above)

# Enable and start BIND9 (handle alias: bind9 vs named)
BIND_SVC="named"
if systemctl list-unit-files bind9.service &>/dev/null && ! systemctl is-enabled bind9 2>&1 | grep -q "alias"; then
    BIND_SVC="bind9"
fi
systemctl enable "$BIND_SVC" 2>/dev/null || true
systemctl start "$BIND_SVC" 2>/dev/null || true

# Verify BIND9 is running
if systemctl is-active --quiet "$BIND_SVC"; then
    echo -e "${GREEN}✓ BIND9 DNS server is running ($BIND_SVC)${NC}"
else
    echo -e "${YELLOW}⚠ BIND9 service may need manual configuration${NC}"
fi

# ── Pre-install Mail Stack ─────────────────────────────────────────
echo -e "${YELLOW}📧 Installing mail stack (Postfix, Dovecot, Rspamd, ClamAV, OpenDKIM)...${NC}"
MAIL_MODE=production bash "$INSTALL_DIR/scripts/email/install-stack.sh" && \
    echo -e "${GREEN}✓ Mail stack installed${NC}" || \
    echo -e "${RED}⚠ Mail stack installation had issues — can retry from the panel${NC}"

# ── Pre-install TLS, Postscreen, DMARC ───────────────────────────
echo -e "${YELLOW}🛡️  Configuring mail security (Postscreen, DMARC)...${NC}"
MAIL_MODE=production bash "$INSTALL_DIR/scripts/email/setup-postscreen.sh" 2>/dev/null && \
    echo -e "${GREEN}✓ Postscreen configured${NC}" || \
    echo -e "${YELLOW}⚠ Postscreen setup skipped${NC}"
MAIL_MODE=production bash "$INSTALL_DIR/scripts/email/setup-dmarc.sh" 2>/dev/null && \
    echo -e "${GREEN}✓ DMARC configured${NC}" || \
    echo -e "${YELLOW}⚠ DMARC setup skipped${NC}"

# Open mail ports in UFW
echo -e "${YELLOW}🔓 Opening mail firewall ports...${NC}"
ufw allow 25/tcp    # SMTP
ufw allow 587/tcp   # Submission
ufw allow 993/tcp   # IMAPS
ufw allow 143/tcp   # IMAP
ufw allow 4190/tcp  # ManageSieve
echo -e "${GREEN}✓ Mail ports opened (25, 587, 993, 143, 4190)${NC}"

# Start clearPanel service
echo -e "${YELLOW}🚀 Starting clearPanel service...${NC}"
systemctl start clearpanel

# Wait for backend to be fully ready (max 30 seconds)
echo -e "${YELLOW}⏳ Waiting for backend to start...${NC}"
BACKEND_READY=false
for i in $(seq 1 15); do
    if curl -s --max-time 2 "http://localhost:3334/api/setup/status" >/dev/null 2>&1; then
        BACKEND_READY=true
        break
    fi
    sleep 2
done

if [ "$BACKEND_READY" = true ]; then
    echo -e "${GREEN}✓ Backend API is responding${NC}"
else
    echo -e "${YELLOW}⚠ Backend API not responding yet — may still be starting up${NC}"
    echo -e "${YELLOW}  Check with: curl http://localhost:3334/api/setup/status${NC}"
    echo -e "${YELLOW}  Logs: sudo journalctl -u clearpanel -n 30${NC}"
fi

# Check status
if systemctl is-active --quiet clearpanel; then
    echo ""
    echo -e "${GREEN}✅ Installation successful!${NC}"
    echo ""
    echo -e "${GREEN}clearPanel is now running${NC}"
    echo -e "${GREEN}BIND9 DNS server is installed and ready${NC}"
    echo -e "${GREEN}Mail stack (Postfix, Dovecot, Rspamd, ClamAV) is installed${NC}"
    echo -e "${GREEN}Roundcube webmail can be installed from the App Store or Email module${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  NEXT STEPS:${NC}"
    echo "1. Open the panel in your browser to complete the Setup Wizard"
    echo "   The wizard will configure your admin account, domain, and nameservers."
    echo ""
    echo "2. (Optional) Setup SSL with Let's Encrypt after wizard:"
    echo "   sudo certbot --nginx -d your-domain.com"
    echo ""
    echo "3. Install Roundcube webmail from the Email module or App Store"
    echo "   (supports /roundcube path on this server, or a custom webmail domain)"
    echo ""
    SERVER_IP=$(hostname -I | awk '{print $1}')
    echo -e "${GREEN}Access your panel at: http://$SERVER_IP${NC}"
    echo ""
    echo "Useful commands:"
    echo "  View logs: sudo journalctl -u clearpanel -f"
    echo "  Restart: sudo systemctl restart clearpanel"
    echo "  Stop: sudo systemctl stop clearpanel"
    echo "  Update: cd /opt/clearpanel && bash update.sh"
    echo ""
    echo -e "${YELLOW}🔍 Troubleshooting if panel is not accessible:${NC}"
    echo "1. Check service status: sudo systemctl status clearpanel"
    echo "2. Check if port is listening: sudo ss -tulpn | grep 3334"
    echo "3. Check firewall: sudo ufw status"
    echo "4. Check nginx: sudo systemctl status nginx"
    echo "5. Test locally: curl http://localhost:3334/api/auth/status"
    echo "6. View service logs: sudo journalctl -u clearpanel -n 50"
    echo ""
else
    echo -e "${RED}❌ Installation failed - service is not running${NC}"
    journalctl -u clearpanel -n 50 --no-pager
    exit 1
fi
