#!/bin/bash
set -e

echo "🚀 Installing clearPanel on VPS..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
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
    # Add NodeSource repository for latest Node.js
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs nginx git curl ufw bind9 bind9utils bind9-doc certbot python3-certbot-nginx
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
NODE_VERSION=$(node -v 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1 || echo "0")
if [ "$NODE_VERSION" -lt 20 ]; then
    echo -e "${RED}Node.js 20+ is required but not detected after installation. Please check NodeSource setup.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js $(node -v) detected${NC}"

# Create service user
if ! id "$SERVICE_USER" &>/dev/null; then
    echo -e "${YELLOW}👤 Creating service user: $SERVICE_USER${NC}"
    useradd -r -s /bin/false -d "$INSTALL_DIR" "$SERVICE_USER"
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

# Create data directory (outside of git)
mkdir -p "$INSTALL_DIR/data"

# Create cPanel-like user home directory for default admin user
ADMIN_USER="admin"
USER_HOME="$INSTALL_DIR/data/$ADMIN_USER"
echo -e "${YELLOW}🏠 Creating user home directory: $USER_HOME${NC}"
mkdir -p "$USER_HOME/public_html"
mkdir -p "$USER_HOME/mail"
mkdir -p "$USER_HOME/logs"
mkdir -p "$USER_HOME/tmp"
mkdir -p "$USER_HOME/etc"
mkdir -p "$USER_HOME/ssl/certs"
mkdir -p "$USER_HOME/ssl/keys"
mkdir -p "$USER_HOME/ssl/csrs"
mkdir -p "$USER_HOME/cgi-bin"
mkdir -p "$USER_HOME/.ssh"
mkdir -p "$USER_HOME/.trash"
chmod 700 "$USER_HOME/.ssh"

# Create default index.html in public_html
if [ ! -f "$USER_HOME/public_html/index.html" ]; then
    cat > "$USER_HOME/public_html/index.html" << 'INDEXEOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to clearPanel</title>
    <style>
        body { font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 100px auto; text-align: center; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; }
        .container { background: white; padding: 40px; border-radius: 10px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); }
        h1 { color: #2c3e50; } p { color: #7f8c8d; line-height: 1.6; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 clearPanel is Ready!</h1>
        <p>Your server is configured. Add a domain to get started.</p>
    </div>
</body>
</html>
INDEXEOF
fi

chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR/data"

# Ensure data directory is in .gitignore so git pull doesn't affect user data
if ! grep -q "^data/" "$INSTALL_DIR/.gitignore" 2>/dev/null; then
    echo "data/" >> "$INSTALL_DIR/.gitignore"
fi

# Set ownership
chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"

# Install backend dependencies
echo -e "${YELLOW}📦 Installing backend dependencies...${NC}"
cd "$INSTALL_DIR/backend"
sudo -u "$SERVICE_USER" npm install

# Build backend
echo -e "${YELLOW}🔧 Building backend...${NC}"
sudo -u "$SERVICE_USER" npm run build

# Install frontend dependencies and build
echo -e "${YELLOW}🎨 Building frontend...${NC}"
cd "$INSTALL_DIR/frontend"
sudo -u "$SERVICE_USER" npm install
sudo -u "$SERVICE_USER" npm run build

# Frontend vite config outputs directly to backend/public, no copy needed

# Create environment file
echo -e "${YELLOW}📝 Creating environment configuration...${NC}"
mkdir -p "$INSTALL_DIR/backend"
cat > "$INSTALL_DIR/backend/.env" << EOF
# Server Configuration
NODE_ENV=production
PORT=3334

# Session Secret (CHANGE THIS!)
SESSION_SECRET=$(openssl rand -hex 32)

# Admin Credentials (CHANGE THESE!)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

# Server IP (auto-detected, change if incorrect)
SERVER_IP=$(hostname -I | awk '{print $1}')

# File Manager Settings
ROOT_PATH=/opt/clearpanel/data
ALLOWED_EXTENSIONS=*
MAX_FILE_SIZE=104857600
EOF

chown "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR/backend/.env"
chmod 600 "$INSTALL_DIR/backend/.env"

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

# Configure BIND9 DNS server
echo -e "${YELLOW}🌐 Configuring BIND9 DNS server...${NC}"
# Create zones directory
mkdir -p /etc/bind/zones

# Add clearpanel user to bind group for zone file management
usermod -a -G bind "$SERVICE_USER" 2>/dev/null || true

# Set permissions: bind group can write, others can read
chown -R bind:bind /etc/bind/zones 2>/dev/null || chown -R root:root /etc/bind/zones
chmod 775 /etc/bind/zones
chmod g+s /etc/bind/zones  # Set group sticky bit so new files inherit group

# Also allow clearpanel to write to named.conf.local (for zone configuration)
chmod 664 /etc/bind/named.conf.local 2>/dev/null || true
chgrp bind /etc/bind/named.conf.local 2>/dev/null || true

# Configure sudoers to allow clearpanel user to reload/restart BIND9 without password
cat > /etc/sudoers.d/clearpanel-bind9 << 'EOF'
# Allow clearpanel user to manage BIND9 service
clearpanel ALL=(ALL) NOPASSWD: /bin/systemctl reload bind9
clearpanel ALL=(ALL) NOPASSWD: /bin/systemctl restart bind9
clearpanel ALL=(ALL) NOPASSWD: /bin/systemctl reload named
clearpanel ALL=(ALL) NOPASSWD: /bin/systemctl restart named
EOF
chmod 440 /etc/sudoers.d/clearpanel-bind9

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

# Start clearPanel service
echo -e "${YELLOW}🚀 Starting clearPanel service...${NC}"
systemctl start clearpanel

sleep 2

# Check status
if systemctl is-active --quiet clearpanel; then
    echo ""
    echo -e "${GREEN}✅ Installation successful!${NC}"
    echo ""
    echo -e "${GREEN}clearPanel is now running${NC}"
    echo -e "${GREEN}BIND9 DNS server is installed and ready${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  IMPORTANT NEXT STEPS:${NC}"
    echo "1. Edit /opt/clearpanel/backend/.env and change:"
    echo "   - ADMIN_USERNAME"
    echo "   - ADMIN_PASSWORD"
    echo "   - SESSION_SECRET (already generated)"
    echo ""
    echo "2. (Optional) Edit nginx config to add your domain:"
    echo "   /etc/nginx/sites-available/clearpanel (Debian/Ubuntu)"
    echo "   Replace server_name _; with your actual domain"
    echo ""
    echo "3. Restart services:"
    echo "   sudo systemctl restart clearpanel"
    echo "   sudo systemctl restart nginx"
    echo ""
    echo "4. Setup SSL with Let's Encrypt:"
    echo "   sudo ./setup-ssl.sh"
    echo "   Or manually: sudo certbot --nginx -d your-domain.com"
    echo ""
    SERVER_IP=$(hostname -I | awk '{print $1}')
    echo -e "${GREEN}Access your panel at: http://$SERVER_IP${NC}"
    echo ""
    echo "Useful commands:"
    echo "  View logs: sudo journalctl -u clearpanel -f"
    echo "  Restart: sudo systemctl restart clearpanel"
    echo "  Stop: sudo systemctl stop clearpanel"
    echo "  Update: cd /opt/clearpanel && git pull && cd backend && npm run build && sudo systemctl restart clearpanel"
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
