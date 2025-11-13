#!/bin/bash

# clearPanel Quick Start Script for Internet Access
set -e

echo "========================================="
echo "clearPanel - Making Server Accessible Online"
echo "========================================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get IPs
LOCAL_IP=$(hostname -I | awk '{print $1}')
PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || echo "Unable to detect")

echo ""
echo -e "${YELLOW}Network Information:${NC}"
echo "  Local IP:  $LOCAL_IP"
echo "  Public IP: $PUBLIC_IP"
echo "  Port:      3334"
echo ""

# Check if servers are running
if lsof -ti:3334 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend is already running on port 3334${NC}"
else
    echo -e "${YELLOW}Starting backend server...${NC}"
    BACKEND_DIR="/home/hasim/Documents/project/clearPanel/backend"
    cd "$BACKEND_DIR"
    nohup node dist/main.js > /home/hasim/Documents/project/clearPanel/logs/backend.log 2>&1 &
    sleep 2
    if lsof -ti:3334 > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Backend started successfully${NC}"
    else
        echo -e "${RED}✗ Failed to start backend. Check logs.${NC}"
    fi
fi

if lsof -ti:8081 > /dev/null 2>&1 || lsof -ti:8080 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Frontend dev server is running${NC}"
else
    echo -e "${YELLOW}Note: For production, build frontend and serve from backend${NC}"
fi

echo ""
echo "========================================="
echo -e "${GREEN}Server is now accessible at:${NC}"
echo "========================================="
echo ""
echo -e "${GREEN}Local Network:${NC}"
echo "  http://$LOCAL_IP:3334"
echo ""
echo -e "${YELLOW}Internet (requires port forwarding):${NC}"
echo "  http://$PUBLIC_IP:3334"
echo ""
echo "========================================="
echo -e "${YELLOW}⚠️  IMPORTANT NEXT STEPS:${NC}"
echo "========================================="
echo ""
echo "1. ${YELLOW}Router Port Forwarding:${NC}"
echo "   - Access your router admin panel"
echo "   - Forward external port 3334 to $LOCAL_IP:3334"
echo ""
echo "2. ${YELLOW}Firewall Configuration:${NC}"
echo "   - Allow port 3334:"
if command -v ufw &> /dev/null; then
    echo "     sudo ufw allow 3334/tcp"
fi
echo ""
echo "3. ${YELLOW}Security (CRITICAL):${NC}"
echo "   - Change default admin password in backend/.env"
echo "   - Update SESSION_SECRET in backend/.env"
echo "   - Consider setting up HTTPS with SSL certificate"
echo ""
echo "4. ${YELLOW}Test External Access:${NC}"
echo "   - From external network, visit: http://$PUBLIC_IP:3334"
echo "   - Or use: curl http://$PUBLIC_IP:3334/api/auth/status"
echo ""
echo "5. ${YELLOW}Production Deployment (Recommended):${NC}"
echo "   - Use nginx as reverse proxy (see nginx.conf.example)"
echo "   - Set up SSL with Let's Encrypt"
echo "   - Use PM2 or systemd for process management"
echo ""

# Check firewall status
if command -v ufw &> /dev/null; then
    echo "Current firewall status:"
    sudo ufw status numbered | grep 3334 || echo "  Port 3334 not configured in UFW"
    echo ""
fi

echo "View logs: tail -f /home/hasim/Documents/project/clearPanel/logs/backend.log"
echo ""
