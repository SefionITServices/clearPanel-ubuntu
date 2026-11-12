#!/bin/bash
# Quick fix script to configure BIND9 permissions for clearPanel

set -e

echo "🔧 Fixing BIND9 permissions for clearPanel..."

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root"
   echo "Usage: sudo ./fix-bind9-permissions.sh"
   exit 1
fi

SERVICE_USER="clearpanel"

# Add clearpanel user to bind group
if id "$SERVICE_USER" &>/dev/null; then
    usermod -a -G bind "$SERVICE_USER"
    echo "✓ Added $SERVICE_USER to bind group"
else
    echo "⚠ User $SERVICE_USER not found. Make sure clearPanel is installed."
    exit 1
fi

# Set permissions on zones directory
mkdir -p /etc/bind/zones
chown -R root:bind /etc/bind/zones 2>/dev/null || chown -R bind:bind /etc/bind/zones 2>/dev/null || true
chmod 2775 /etc/bind/zones
chmod -R 664 /etc/bind/zones/* 2>/dev/null || true
chgrp -R bind /etc/bind/zones/* 2>/dev/null || true
echo "✓ Configured /etc/bind/zones permissions"

# Set permissions on named.conf.local
if [ -f /etc/bind/named.conf.local ]; then
    chmod 664 /etc/bind/named.conf.local
    chgrp bind /etc/bind/named.conf.local 2>/dev/null || true
    echo "✓ Configured /etc/bind/named.conf.local permissions"
fi

# Configure sudoers
cat > /etc/sudoers.d/clearpanel-bind9 << 'EOF'
# Allow clearpanel user to manage BIND9 service
clearpanel ALL=(ALL) NOPASSWD: /bin/systemctl reload bind9
clearpanel ALL=(ALL) NOPASSWD: /bin/systemctl restart bind9
clearpanel ALL=(ALL) NOPASSWD: /bin/systemctl reload named
clearpanel ALL=(ALL) NOPASSWD: /bin/systemctl restart named
EOF
chmod 440 /etc/sudoers.d/clearpanel-bind9
echo "✓ Configured sudoers for BIND9 management"

echo ""
echo "✅ Permissions fixed!"
echo ""
echo "You may need to restart the clearPanel service for changes to take effect:"
echo "  sudo systemctl restart clearpanel"
echo ""

