#!/bin/bash
set -e

echo "🚀 Deploying clearPanel..."

# Configuration
PROJECT_DIR="/opt/clearpanel"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
SERVICE_NAME="clearpanel"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo -e "${RED}Do not run this script as root. Use a sudo-enabled user.${NC}"
   exit 1
fi

# Navigate to project directory
cd "$PROJECT_DIR"

echo -e "${YELLOW}📦 Pulling latest changes...${NC}"
git pull origin main || echo "Not a git repository or no remote configured"

# Backend
echo -e "${YELLOW}🔧 Building backend...${NC}"
cd "$BACKEND_DIR"
npm install --production=false
npm run build

echo -e "${YELLOW}📦 Installing backend production dependencies...${NC}"
npm install --production

# Frontend
echo -e "${YELLOW}🎨 Building frontend...${NC}"
cd "$FRONTEND_DIR"
npm install
npm run build

# Ensure public directory permissions
echo -e "${YELLOW}🔐 Setting permissions...${NC}"
sudo chown -R clearpanel:clearpanel "$BACKEND_DIR/public"
sudo chmod -R 755 "$BACKEND_DIR/public"

# Restart service
echo -e "${YELLOW}♻️  Restarting service...${NC}"
sudo systemctl restart "$SERVICE_NAME"

# Wait a moment for service to start
sleep 2

# Check service status
if sudo systemctl is-active --quiet "$SERVICE_NAME"; then
    echo -e "${GREEN}✅ Deployment successful!${NC}"
    echo -e "${GREEN}Service is running${NC}"
    sudo systemctl status "$SERVICE_NAME" --no-pager -l
else
    echo -e "${RED}❌ Deployment failed - service is not running${NC}"
    sudo journalctl -u "$SERVICE_NAME" -n 50 --no-pager
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 clearPanel deployed successfully!${NC}"
echo ""
