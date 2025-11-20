#!/bin/bash
# Quick script to install BIND9 on Ubuntu/Debian

set -e

echo "🌐 Installing BIND9 DNS Server..."

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root"
   echo "Usage: sudo ./install-bind9.sh"
   exit 1
fi

# Install BIND9
apt-get update
apt-get install -y bind9 bind9utils bind9-doc

# Create zones directory
mkdir -p /etc/bind/zones
chown -R bind:bind /etc/bind/zones 2>/dev/null || chown -R root:root /etc/bind/zones

# Configure firewall
ufw allow 53/tcp
ufw allow 53/udp
ufw reload

# Enable and start BIND9
systemctl enable bind9
systemctl start bind9

# Verify installation
if systemctl is-active --quiet bind9; then
    echo "✅ BIND9 installed and running successfully!"
    echo ""
    echo "You can now create DNS zones through the clearPanel interface."
    echo ""
    echo "Check status: sudo systemctl status bind9"
    echo "View logs: sudo journalctl -u bind9 -f"
else
    echo "❌ BIND9 installation failed. Check logs:"
    journalctl -u bind9 -n 50 --no-pager
    exit 1
fi

