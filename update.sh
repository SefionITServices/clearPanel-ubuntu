#!/bin/bash
# ─────────────────────────────────────────────────────────────────────
# clearPanel — Safe Production Update Script
# ─────────────────────────────────────────────────────────────────────
# This script updates clearPanel code WITHOUT touching any user data,
# configuration, or setup state.  Safe to run on a live production server.
#
# What it does:
#   1. Backs up critical data files (just-in-case snapshot)
#   2. Pulls the latest code from git
#   3. Installs / updates npm dependencies
#   4. Rebuilds backend + frontend
#   5. Restarts the clearPanel service
#
# What it does NOT touch:
#   - .env file (admin creds, DATA_DIR, session secret)
#   - setup-status.json (setup wizard state)
#   - domains.json, dns.json, server-settings.json
#   - mail-domains.json, mail-automation-history.json
#   - mail-state/, mail-policies/ directories
#   - /home/<user>/ website files
#   - nginx vhosts, BIND9 zones, TLS certs
#   - MySQL/PostgreSQL databases
# ─────────────────────────────────────────────────────────────────────
set -e

# ── Delegate to CLI if available ─────────────────────────────────────
if [ -x "/usr/local/bin/clearpanel" ] || [ -x "/opt/clearpanel/bin/clearpanel" ]; then
    CLI="${CLEARPANEL_CLI:-$(command -v clearpanel 2>/dev/null || echo /opt/clearpanel/bin/clearpanel)}"
    echo "Delegating to ClearPanel CLI: $CLI update"
    exec "$CLI" update
fi

# ── Configuration ────────────────────────────────────────────────────
INSTALL_DIR="/opt/clearpanel"
BACKEND_DIR="$INSTALL_DIR/backend"
FRONTEND_DIR="$INSTALL_DIR/frontend"
SERVICE_NAME="clearpanel"
SERVICE_USER="clearpanel"
BACKUP_DIR="$INSTALL_DIR/backups"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

# ── Pre-flight checks ───────────────────────────────────────────────
# Ensure we have root/sudo privileges (needed for systemctl, chown, sudo -u)
if [[ $EUID -ne 0 ]]; then
    echo -e "${YELLOW}This script needs root privileges. Re-running with sudo...${NC}"
    exec sudo bash "$0" "$@"
fi

if [[ ! -d "$INSTALL_DIR" ]]; then
    echo -e "${RED}clearPanel is not installed at $INSTALL_DIR${NC}"
    echo "Run install.sh for a first-time installation."
    exit 1
fi

# Make sure the setup wizard has been completed (i.e. not a blank install)
ENV_FILE="$BACKEND_DIR/.env"
if [[ ! -f "$ENV_FILE" ]]; then
    echo -e "${RED}.env file not found — has the setup wizard been completed?${NC}"
    exit 1
fi

# Read DATA_DIR from .env if set (production layout)
DATA_DIR=$(grep '^DATA_DIR=' "$ENV_FILE" 2>/dev/null | cut -d'=' -f2 || true)
if [[ -z "$DATA_DIR" ]]; then
    DATA_DIR="$INSTALL_DIR/data"
fi

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║    clearPanel — Safe Production Update   ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""

# ── Step 1: Backup ──────────────────────────────────────────────────
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
SNAP_DIR="$BACKUP_DIR/pre-update_$TIMESTAMP"

echo -e "${YELLOW}📦 Creating pre-update backup → $SNAP_DIR${NC}"
mkdir -p "$SNAP_DIR"

# Backup .env
cp -p "$ENV_FILE" "$SNAP_DIR/.env" 2>/dev/null || true

# Backup data dir (domains.json, dns.json, server-settings.json, etc.)
if [[ -d "$DATA_DIR" ]]; then
    cp -rp "$DATA_DIR" "$SNAP_DIR/data_dir" 2>/dev/null || true
fi

# Backup bootstrap data dir (setup-status.json)
if [[ -d "$INSTALL_DIR/data" ]]; then
    cp -rp "$INSTALL_DIR/data" "$SNAP_DIR/bootstrap_data" 2>/dev/null || true
fi

# Backup mail state + policies (may be in backend/ in dev, /etc/clearpanel/mail in prod)
for DIR in "$BACKEND_DIR/mail-state" "$BACKEND_DIR/mail-policies" "/etc/clearpanel/mail"; do
    if [[ -d "$DIR" ]]; then
        BASENAME=$(basename "$DIR")
        cp -rp "$DIR" "$SNAP_DIR/$BASENAME" 2>/dev/null || true
    fi
done

# Keep only the last 5 backups to save disk space
ls -dt "$BACKUP_DIR"/pre-update_* 2>/dev/null | tail -n +6 | xargs rm -rf 2>/dev/null || true

echo -e "${GREEN}✓ Backup complete${NC}"

# ── Step 2: Pull latest code ────────────────────────────────────────
echo ""
echo -e "${YELLOW}📥 Pulling latest code from remote...${NC}"
cd "$INSTALL_DIR"
# Ensure the service user owns the repo before git operations
chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"
sudo -u "$SERVICE_USER" git config --global --add safe.directory "$INSTALL_DIR" 2>/dev/null || true
sudo -u "$SERVICE_USER" git stash 2>/dev/null || true
sudo -u "$SERVICE_USER" git pull origin main
# Re-apply ownership for any newly created files
chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"
echo -e "${GREEN}✓ Code updated${NC}"

# ── Step 2b: Refresh sudoers (align with install.sh) ────────────────
echo -e "${YELLOW}🔐 Refreshing sudoers permissions...${NC}"
bash "$INSTALL_DIR/scripts/update-sudoers.sh"
echo -e "${GREEN}✓ Sudoers updated${NC}"

# ── Step 2c: Patch nginx config (add /socket.io block if missing) ──
echo -e "${YELLOW}🌐 Checking nginx config for WebSocket proxy...${NC}"
NGINX_CONF=""
if [ -f "/etc/nginx/sites-available/clearpanel" ]; then
    NGINX_CONF="/etc/nginx/sites-available/clearpanel"
elif [ -f "/etc/nginx/conf.d/clearpanel.conf" ]; then
    NGINX_CONF="/etc/nginx/conf.d/clearpanel.conf"
fi

if [ -n "$NGINX_CONF" ] && ! grep -q "location /socket.io" "$NGINX_CONF"; then
    echo -e "${YELLOW}  Adding /socket.io proxy block for WebSocket terminal...${NC}"
    # Insert the socket.io block before the first "location /api {" line
    sed -i '/location \/api {/i \    # Socket.IO (WebSocket terminal)\n    location /socket.io {\n        proxy_pass http://127.0.0.1:3334;\n        proxy_http_version 1.1;\n        proxy_set_header Upgrade $http_upgrade;\n        proxy_set_header Connection "upgrade";\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto $scheme;\n        proxy_read_timeout 3600;\n        proxy_send_timeout 3600;\n    }\n' "$NGINX_CONF"
    if nginx -t > /dev/null 2>&1; then
        systemctl reload nginx
        echo -e "${GREEN}✓ WebSocket proxy block added and nginx reloaded${NC}"
    else
        echo -e "${RED}⚠ Nginx config test failed after socket.io patch — check: sudo nginx -t${NC}"
    fi
else
    echo -e "${GREEN}✓ Nginx WebSocket proxy already configured${NC}"
fi

# ── Step 2d: Sanitize BIND9 named.conf.local (remove stray };) ─────
if [ -f "/etc/bind/named.conf.local" ]; then
    echo -e "${YELLOW}🔧 Checking BIND9 config for syntax errors...${NC}"
    # Remove orphaned }; lines that are outside zone blocks
    BIND_CONF="/etc/bind/named.conf.local"
    if named-checkconf > /dev/null 2>&1; then
        echo -e "${GREEN}✓ BIND9 config is valid${NC}"
    else
        echo -e "${YELLOW}  Attempting to fix BIND9 config...${NC}"
        # Use awk to remove orphaned }; (not inside a zone block)
        awk '
        BEGIN { in_zone = 0 }
        /^[[:space:]]*zone[[:space:]]+"/ { in_zone = 1 }
        /^[[:space:]]*\};/ {
            if (in_zone) { in_zone = 0; print; next }
            else { next }  # skip orphaned };
        }
        { print }
        ' "$BIND_CONF" > "${BIND_CONF}.tmp" && mv "${BIND_CONF}.tmp" "$BIND_CONF"
        chgrp bind "$BIND_CONF" 2>/dev/null || true
        chmod 664 "$BIND_CONF" 2>/dev/null || true
        if named-checkconf > /dev/null 2>&1; then
            # Restart BIND9 (try both service names)
            systemctl restart named 2>/dev/null || systemctl restart bind9 2>/dev/null || true
            echo -e "${GREEN}✓ BIND9 config fixed and reloaded${NC}"
        else
            echo -e "${RED}⚠ BIND9 config still has errors — check: sudo named-checkconf${NC}"
        fi
    fi
fi

# ── Step 3: Install dependencies ────────────────────────────────────
echo ""
echo -e "${YELLOW}📦 Installing backend dependencies...${NC}"
cd "$BACKEND_DIR"
sudo -u "$SERVICE_USER" npm install --legacy-peer-deps
echo -e "${GREEN}✓ Backend dependencies installed${NC}"

echo -e "${YELLOW}📦 Installing frontend dependencies...${NC}"
cd "$FRONTEND_DIR"
sudo -u "$SERVICE_USER" npm install --legacy-peer-deps
echo -e "${GREEN}✓ Frontend dependencies installed${NC}"

# ── Step 4: Build ───────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}🔧 Building backend...${NC}"
cd "$BACKEND_DIR"
sudo -u "$SERVICE_USER" npm run build
echo -e "${GREEN}✓ Backend built${NC}"

echo -e "${YELLOW}🎨 Building frontend...${NC}"
cd "$FRONTEND_DIR"
sudo -u "$SERVICE_USER" npm run build
echo -e "${GREEN}✓ Frontend built${NC}"

# Ensure public directory permissions
sudo chown -R "$SERVICE_USER:$SERVICE_USER" "$BACKEND_DIR/public" 2>/dev/null || true

# ── Step 5: Restart service ─────────────────────────────────────────
echo ""
echo -e "${YELLOW}♻️  Restarting clearPanel service...${NC}"
sudo systemctl restart "$SERVICE_NAME"

sleep 3

if sudo systemctl is-active --quiet "$SERVICE_NAME"; then
    echo -e "${GREEN}✅ Update successful!  clearPanel is running.${NC}"
    echo ""

    # Show version info from last commit
    cd "$INSTALL_DIR"
    LAST_COMMIT=$(git log --oneline -1 2>/dev/null || echo "unknown")
    echo -e "  ${CYAN}Latest commit:${NC} $LAST_COMMIT"
    echo -e "  ${CYAN}Backup saved:${NC}  $SNAP_DIR"
    echo ""
    echo -e "${GREEN}All user data, domains, email, and configuration preserved.${NC}"
else
    echo -e "${RED}❌ Service failed to start after update!${NC}"
    echo ""
    echo "Rolling back is possible — your pre-update backup is at:"
    echo "  $SNAP_DIR"
    echo ""
    echo "Check logs:  sudo journalctl -u $SERVICE_NAME -n 50"
    exit 1
fi
