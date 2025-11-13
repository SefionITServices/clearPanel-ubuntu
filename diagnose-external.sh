#!/bin/bash

# clearPanel - External Access Diagnostic Tool
echo "â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—"
echo "â•‘       clearPanel External Access Troubleshooting                  â•‘"
echo "â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get network info
LOCAL_IP=$(hostname -I | awk '{print $1}')
PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || echo "Unable to detect")

echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "ðŸ“Š NETWORK INFORMATION"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "Local IP:  $LOCAL_IP"
echo "Public IP: $PUBLIC_IP"
echo "Port:      3334"
echo ""

# Check if server is running
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "ðŸ” SERVER STATUS CHECKS"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"

if lsof -i :3334 > /dev/null 2>&1; then
    echo -e "${GREEN}âœ“ Server is running on port 3334${NC}"
    BINDING=$(lsof -i :3334 | grep LISTEN | awk '{print $9}')
    echo "  Binding: $BINDING"
else
    echo -e "${RED}âœ— Server is NOT running on port 3334${NC}"
    echo "  Run: ./start-online.sh"
    exit 1
fi

# Test localhost
echo ""
echo "Testing localhost (127.0.0.1:3334)..."
if curl -s --max-time 3 http://localhost:3334/api/auth/status > /dev/null 2>&1; then
    echo -e "${GREEN}âœ“ Localhost access works${NC}"
else
    echo -e "${RED}âœ— Localhost access failed${NC}"
fi

# Test LAN IP
echo ""
echo "Testing LAN IP ($LOCAL_IP:3334)..."
if curl -s --max-time 3 http://$LOCAL_IP:3334/api/auth/status > /dev/null 2>&1; then
    echo -e "${GREEN}âœ“ LAN access works${NC}"
else
    echo -e "${RED}âœ— LAN access failed${NC}"
fi

# Check firewall
echo ""
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "ðŸ›¡ï¸  FIREWALL STATUS"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"

if command -v ufw &> /dev/null; then
    UFW_STATUS=$(sudo ufw status 2>/dev/null | grep "Status:" | awk '{print $2}')
    if [ "$UFW_STATUS" = "active" ]; then
        echo -e "${YELLOW}UFW Firewall: Active${NC}"
        if sudo ufw status | grep -q "3334"; then
            echo -e "${GREEN}âœ“ Port 3334 is allowed in UFW${NC}"
        else
            echo -e "${RED}âœ— Port 3334 is NOT allowed in UFW${NC}"
            echo "  Fix: sudo ufw allow 3334/tcp"
        fi
    else
        echo -e "${GREEN}UFW Firewall: Inactive (all ports open)${NC}"
    fi
else
    echo "UFW not installed"
fi

# Check if behind NAT
echo ""
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "ðŸŒ INTERNET CONNECTIVITY"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"

if [[ $LOCAL_IP == 192.168.* ]] || [[ $LOCAL_IP == 10.* ]] || [[ $LOCAL_IP == 172.16.* ]]; then
    echo -e "${YELLOW}âš  You are behind NAT (private IP)${NC}"
    echo "  This is normal for home networks."
    echo "  You MUST configure router port forwarding."
else
    echo -e "${GREEN}âœ“ Direct public IP${NC}"
    echo "  No router port forwarding needed."
fi

echo ""
echo "Testing external port (this requires port forwarding)..."
echo "Checking if port 3334 is open to the internet..."

# Try to check external port using online service
TIMEOUT=5
PORT_TEST=$(timeout $TIMEOUT curl -s "https://api.hackertarget.com/nmap/?q=$PUBLIC_IP" 2>/dev/null | grep "3334")

if [ ! -z "$PORT_TEST" ]; then
    if echo "$PORT_TEST" | grep -q "open"; then
        echo -e "${GREEN}âœ“ Port 3334 appears OPEN from internet${NC}"
    else
        echo -e "${RED}âœ— Port 3334 appears CLOSED from internet${NC}"
    fi
else
    echo -e "${YELLOW}âš  Unable to test external port automatically${NC}"
    echo "  Manual test required (see below)"
fi

echo ""
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "ðŸ“‹ TROUBLESHOOTING CHECKLIST"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo ""

echo -e "${BLUE}1. ROUTER PORT FORWARDING (MOST COMMON ISSUE)${NC}"
echo "   Status: ${RED}NEEDS CONFIGURATION${NC}"
echo ""
echo "   Steps:"
echo "   a) Access your router admin panel"
echo "      Common addresses: 192.168.1.1, 192.168.0.1, 10.0.0.1"
echo "      Or check: ip route | grep default"
echo ""
echo "   b) Login with router credentials"
echo ""
echo "   c) Find 'Port Forwarding' or 'Virtual Server' section"
echo ""
echo "   d) Add this rule:"
echo "      â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”"
echo "      â”‚ Service Name:    clearPanel                â”‚"
echo "      â”‚ External Port:   3334                  â”‚"
echo "      â”‚ Internal IP:     $LOCAL_IP       â”‚"
echo "      â”‚ Internal Port:   3334                  â”‚"
echo "      â”‚ Protocol:        TCP                   â”‚"
echo "      â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜"
echo ""
echo "   e) Save and apply settings"
echo ""

echo -e "${BLUE}2. ISP PORT BLOCKING${NC}"
echo "   Some ISPs block certain ports for security"
echo "   - Port 3334 is unusual and usually NOT blocked"
echo "   - Common blocked ports: 80, 25, 443 (without business plan)"
echo "   - If blocked, try a different port (e.g., 8080, 8888)"
echo ""

echo -e "${BLUE}3. DYNAMIC IP ISSUE${NC}"
echo "   Your public IP ($PUBLIC_IP) may change"
echo "   Solutions:"
echo "   - Use a Dynamic DNS service (No-IP, DuckDNS)"
echo "   - Check if your ISP offers static IP"
echo ""

echo -e "${BLUE}4. CARRIER-GRADE NAT (CGNAT)${NC}"
echo "   Some ISPs use CGNAT (double NAT)"
echo "   Check: Does your router's WAN IP match $PUBLIC_IP?"
echo "   - If NO: You're behind CGNAT (contact ISP or use tunneling)"
echo "   - If YES: Port forwarding should work"
echo ""

echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "ðŸ§ª MANUAL TESTING"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo ""
echo "After configuring port forwarding, test from OUTSIDE your network:"
echo ""
echo "Option 1: Use mobile data (turn off WiFi on phone)"
echo "   Visit: http://$PUBLIC_IP:3334"
echo ""
echo "Option 2: Use online port checker"
echo "   Visit: https://www.yougetsignal.com/tools/open-ports/"
echo "   Enter IP: $PUBLIC_IP"
echo "   Enter Port: 3334"
echo ""
echo "Option 3: From another network (friend's house, cafe)"
echo "   curl http://$PUBLIC_IP:3334/api/auth/status"
echo ""

echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "ðŸ”§ ROUTER ACCESS"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo ""
GATEWAY=$(ip route | grep default | awk '{print $3}')
echo "Your router gateway IP: $GATEWAY"
echo "Try accessing: http://$GATEWAY"
echo ""

echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "ðŸš€ ALTERNATIVE SOLUTIONS"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo ""
echo "If port forwarding doesn't work or isn't possible:"
echo ""
echo "1. ngrok (Easiest - No router config needed)"
echo "   - Provides instant HTTPS URL"
echo "   - Free tier available"
echo "   - Setup: https://ngrok.com/download"
echo "   - Run: ngrok http 3334"
echo ""
echo "2. Cloudflare Tunnel (Free, HTTPS)"
echo "   - No port forwarding needed"
echo "   - Free tier available"
echo "   - Setup: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/"
echo ""
echo "3. Tailscale (VPN mesh network)"
echo "   - Secure access without port forwarding"
echo "   - Free for personal use"
echo "   - Setup: https://tailscale.com/"
echo ""

echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "ðŸ“ž NEED HELP?"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo ""
echo "Common router brands port forwarding guides:"
echo "  â€¢ TP-Link: https://www.tp-link.com/us/support/faq/84/"
echo "  â€¢ Netgear: https://kb.netgear.com/24290/How-do-I-add-a-port-forwarding-rule"
echo "  â€¢ D-Link: https://support.dlink.com/faq/view.aspx?prod=DIR-868L&faqid=144"
echo "  â€¢ Linksys: https://www.linksys.com/support-article?articleNum=138535"
echo ""
echo "Run this script anytime: ./diagnose-external.sh"
echo ""

