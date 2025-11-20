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

# Install Node.js 20+ if not present
NODE_VERSION=$(node -v 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1 || echo "0")
if [ "$NODE_VERSION" -lt 20 ]; then
    echo -e "${YELLOW}📦 Installing Node.js 20 LTS...${NC}"
    if [ "$PKG_MANAGER" = "apt-get" ]; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
    else
        curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
        dnf install -y nodejs
    fi
fi

# Create service user
if ! id "$SERVICE_USER" &>/dev/null; then
    echo -e "${YELLOW}👤 Creating service user: $SERVICE_USER${NC}"
    useradd -r -s /bin/false -d "$INSTALL_DIR" "$SERVICE_USER"
fi

# Create installation directory
echo -e "${YELLOW}📁 Creating installation directory...${NC}"
mkdir -p "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR/data"
mkdir -p "$INSTALL_DIR/data/domains"

# Copy current directory to install location (if not already there)
if [ "$PWD" != "$INSTALL_DIR" ]; then
    echo -e "${YELLOW}📋 Copying application files...${NC}"
    cp -r backend "$INSTALL_DIR/" 2>/dev/null || true
    cp -r frontend "$INSTALL_DIR/" 2>/dev/null || true
    cp clearpanel.service "$INSTALL_DIR/" 2>/dev/null || true
    cp nginx.conf.example "$INSTALL_DIR/" 2>/dev/null || true
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

# File Manager Settings
ROOT_PATH=/opt/clearpanel/data
DOMAINS_ROOT=/opt/clearpanel/data/domains
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

# Enable and start BIND9
systemctl enable bind9
systemctl start bind9

# Verify BIND9 is running
if systemctl is-active --quiet bind9; then
    echo -e "${GREEN}✓ BIND9 DNS server is running${NC}"
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
    echo "2. Edit nginx config:"
    echo "   /etc/nginx/sites-available/clearpanel (Debian/Ubuntu)"
    echo "   /etc/nginx/conf.d/clearpanel.conf (CentOS/RHEL)"
    echo "   Replace 'your-domain.com' with your actual domain"
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
