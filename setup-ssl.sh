#!/bin/bash
# SSL Certificate Setup Script for clearPanel
# This script installs Let's Encrypt SSL certificates for your domain

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}This script must be run as root${NC}"
   echo "Usage: sudo ./setup-ssl.sh"
   exit 1
fi

echo -e "${YELLOW}🔒 SSL Certificate Setup for clearPanel${NC}"
echo ""

# Check if certbot is installed
if ! command -v certbot &> /dev/null; then
    echo -e "${YELLOW}Installing certbot...${NC}"
    apt-get update
    apt-get install -y certbot python3-certbot-nginx
fi

# Get domain name
read -p "Enter your domain name (e.g., panel.yourdomain.com): " DOMAIN

if [ -z "$DOMAIN" ]; then
    echo -e "${RED}Domain name is required${NC}"
    exit 1
fi

# Ask if they want www subdomain
read -p "Include www subdomain? (y/n) [n]: " INCLUDE_WWW
INCLUDE_WWW=${INCLUDE_WWW:-n}

# Prepare certbot command
CERTBOT_CMD="certbot --nginx -d $DOMAIN"

if [ "$INCLUDE_WWW" = "y" ] || [ "$INCLUDE_WWW" = "Y" ]; then
    WWW_DOMAIN="www.$DOMAIN"
    CERTBOT_CMD="$CERTBOT_CMD -d $WWW_DOMAIN"
    echo -e "${YELLOW}Will install certificate for: $DOMAIN and $WWW_DOMAIN${NC}"
else
    echo -e "${YELLOW}Will install certificate for: $DOMAIN${NC}"
fi

echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: Before proceeding, ensure:${NC}"
echo "1. Your domain DNS points to this server's IP address"
echo "2. Port 80 is open in your firewall"
echo "3. Nginx is running and accessible on port 80"
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."

# Run certbot
echo ""
echo -e "${YELLOW}Running certbot...${NC}"
$CERTBOT_CMD

# Check if certificate was installed successfully
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ SSL certificate installed successfully!${NC}"
    echo ""
    echo -e "${GREEN}Your site is now accessible at: https://$DOMAIN${NC}"
    echo ""
    echo -e "${YELLOW}Certificate auto-renewal is configured automatically.${NC}"
    echo ""
    echo "Test renewal with:"
    echo "  sudo certbot renew --dry-run"
    echo ""
    echo "View certificate info:"
    echo "  sudo certbot certificates"
    echo ""
else
    echo ""
    echo -e "${RED}❌ Certificate installation failed${NC}"
    echo ""
    echo "Common issues:"
    echo "1. DNS not pointing to this server"
    echo "2. Port 80 blocked by firewall"
    echo "3. Domain already has a certificate"
    echo ""
    echo "Check logs:"
    echo "  sudo tail -f /var/log/letsencrypt/letsencrypt.log"
    exit 1
fi

