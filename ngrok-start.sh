#!/bin/bash

# Quick Internet Access using ngrok (No Port Forwarding Required!)
echo "=============================================================="
echo "clearPanel - Quick Internet Access with ngrok"
echo "=============================================================="
echo ""

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo -e "${YELLOW}ngrok is not installed. Installing...${NC}"
    echo ""
    
    # Download ngrok
    cd /tmp
    wget -q https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
    tar xvzf ngrok-v3-stable-linux-amd64.tgz
    sudo mv ngrok /usr/local/bin/
    rm ngrok-v3-stable-linux-amd64.tgz
    
    echo -e "${GREEN}ngrok installed${NC}"
    echo ""
fi

# Check if server is running
if ! lsof -i :3334 > /dev/null 2>&1; then
    echo -e "${YELLOW}Starting clearPanel server...${NC}"
    cd /home/hasim/Documents/project/clearPanel/backend
    nohup node dist/main.js > ../logs/backend.log 2>&1 &
    sleep 2
fi

echo "--------------------------------------------------------------"
echo "SETUP STEPS"
echo "--------------------------------------------------------------"
echo ""
echo "1. Sign up for free ngrok account at: https://ngrok.com/signup"
echo ""
echo "2. Get your auth token from: https://dashboard.ngrok.com/get-started/your-authtoken"
echo ""
echo "3. Configure ngrok with your token:"
echo -e "   ${YELLOW}ngrok config add-authtoken YOUR_TOKEN_HERE${NC}"
echo ""
echo "4. Run this script again after adding your token"
echo ""
echo "--------------------------------------------------------------"
echo "STARTING NGROK TUNNEL"
echo "--------------------------------------------------------------"
echo ""
echo "This will create a public URL for your clearPanel server..."
echo "Press Ctrl+C to stop the tunnel"
echo ""

# Start ngrok
ngrok http 3334

