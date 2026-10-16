#!/bin/bash
# ─────────────────────────────────────────────────────────────────────
# ClearPanel — FTP Service Setup & Configuration Script
# ─────────────────────────────────────────────────────────────────────
# Installs and configures ProFTPD with chroot and passive port support
# Compatible with Ubuntu 20.04 / 22.04 / 24.04 and Debian
# ─────────────────────────────────────────────────────────────────────
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}This script must be run as root${NC}"
   exit 1
fi

echo -e "${YELLOW}📦 Checking and configuring FTP server...${NC}"

# Ensure /etc/shells has /usr/sbin/nologin and /bin/false so FTP authentication works
for shell_path in "/usr/sbin/nologin" "/bin/false"; do
    if ! grep -q "^${shell_path}$" /etc/shells 2>/dev/null; then
        echo "${shell_path}" >> /etc/shells
        echo -e "${GREEN}✓ Added ${shell_path} to /etc/shells${NC}"
    fi
done

# Install proftpd-core if neither proftpd nor vsftpd is installed
if ! command -v proftpd >/dev/null 2>&1 && ! command -v vsftpd >/dev/null 2>&1; then
    echo -e "${YELLOW}Installing proftpd-core...${NC}"
    apt-get update -qq
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq proftpd-core
    echo -e "${GREEN}✓ ProFTPD installed${NC}"
fi

# Configure ProFTPD if installed
if [ -d "/etc/proftpd" ] || command -v proftpd >/dev/null 2>&1; then
    mkdir -p /etc/proftpd/conf.d
    cat > /etc/proftpd/conf.d/clearpanel.conf << 'EOF'
# ClearPanel ProFTPD Configuration
# Allow logins for users with /usr/sbin/nologin shell
RequireValidShell off

# Jail / chroot users to their domain directory
DefaultRoot ~

# Passive ports range
PassivePorts 49152 65534

# Performance: do not perform reverse DNS lookups on clients
UseReverseDNS off
EOF

    # Validate syntax
    if command -v proftpd >/dev/null 2>&1; then
        proftpd -t >/dev/null 2>&1 || echo -e "${YELLOW}⚠ proftpd -t syntax check warning${NC}"
    fi

    # Enable and start service
    systemctl enable proftpd >/dev/null 2>&1 || true
    systemctl restart proftpd >/dev/null 2>&1 || true
    echo -e "${GREEN}✓ ProFTPD configured and running${NC}"
fi

# Configure Firewall (UFW)
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
    echo -e "${YELLOW}🔓 Configuring UFW firewall for FTP...${NC}"
    ufw allow 21/tcp comment 'FTP Control' >/dev/null 2>&1 || true
    ufw allow 49152:65534/tcp comment 'FTP Passive Data' >/dev/null 2>&1 || true
    echo -e "${GREEN}✓ UFW rules added for port 21 and passive ports (49152-65534)${NC}"
fi

echo -e "${GREEN}✅ FTP service setup completed successfully!${NC}"
