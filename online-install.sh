#!/bin/bash
# ──────────────────────────────────────────────────────────────────
# ClearPanel — One-Line Online Installer
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/SefionITServices/clearPanel-ubuntu/main/online-install.sh | sudo bash
#
#   or with wget:
#   wget -qO- https://raw.githubusercontent.com/SefionITServices/clearPanel-ubuntu/main/online-install.sh | sudo bash
#
# What this script does:
#   1. Validates the environment (root, Ubuntu/Debian, architecture)
#   2. Installs minimal prerequisites (git, curl)
#   3. Clones the repository to /opt/clearpanel
#   4. Hands off to the main install.sh which handles everything else
# ──────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Colors ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

REPO_URL="https://github.com/SefionITServices/clearPanel-ubuntu.git"
INSTALL_DIR="/opt/clearpanel"
MIN_RAM_MB=1024   # 1 GB minimum
MIN_DISK_MB=5120  # 5 GB minimum

# ── Banner ──
echo ""
echo -e "${CYAN}${BOLD}"
echo "   _____ _                 ____                  _ "
echo "  / ____| |               |  _ \                | |"
echo " | |    | | ___  __ _ _ __| |_) | __ _ _ __   __| |"
echo " | |    | |/ _ \/ _\` | '__|  _ < / _\` | '_ \ / _\` |"
echo " | |____| |  __/ (_| | |  | |_) | (_| | | | | (_| |"
echo "  \_____|_|\___|\__,_|_|  |____/ \__,_|_| |_|\__,_|"
echo ""
echo -e "${NC}${BOLD}  ClearPanel — Server Management Made Simple${NC}"
echo -e "  ${CYAN}https://github.com/SefionITServices/clearPanel-ubuntu${NC}"
echo ""
echo "──────────────────────────────────────────────────────"
echo ""

# ── Helper functions ──
info()    { echo -e "${CYAN}ℹ  $*${NC}"; }
success() { echo -e "${GREEN}✓  $*${NC}"; }
warn()    { echo -e "${YELLOW}⚠  $*${NC}"; }
fail()    { echo -e "${RED}✗  $*${NC}"; exit 1; }

# ── Pre-flight checks ──
echo -e "${BOLD}Running pre-flight checks...${NC}"
echo ""

# 1. Must be root
if [[ $EUID -ne 0 ]]; then
    fail "This script must be run as root. Use: curl -fsSL <url> | sudo bash"
fi
success "Running as root"

# 2. OS check — Ubuntu or Debian only
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS_NAME="${ID:-unknown}"
    OS_VERSION="${VERSION_ID:-unknown}"
    OS_PRETTY="${PRETTY_NAME:-$OS_NAME $OS_VERSION}"
else
    OS_NAME="unknown"
    OS_PRETTY="Unknown OS"
fi

case "$OS_NAME" in
    ubuntu|debian|linuxmint|zorin|pop)
        success "Supported OS detected: $OS_PRETTY"
        ;;
    *)
        fail "Unsupported OS: $OS_PRETTY. ClearPanel requires Ubuntu, Debian, or a derivative."
        ;;
esac

# 3. Architecture check
ARCH=$(uname -m)
case "$ARCH" in
    x86_64|aarch64|arm64)
        success "Architecture: $ARCH"
        ;;
    *)
        warn "Untested architecture: $ARCH — proceeding anyway"
        ;;
esac

# 4. RAM check
TOTAL_RAM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
TOTAL_RAM_MB=$((TOTAL_RAM_KB / 1024))
if [ "$TOTAL_RAM_MB" -lt "$MIN_RAM_MB" ]; then
    warn "Low RAM: ${TOTAL_RAM_MB}MB detected (recommended: ${MIN_RAM_MB}MB+)"
    warn "Installation may succeed but performance will be limited"
else
    success "RAM: ${TOTAL_RAM_MB}MB"
fi

# 5. Disk space check
AVAIL_DISK_MB=$(df -BM /opt 2>/dev/null | tail -1 | awk '{print $4}' | tr -d 'M')
if [ -n "$AVAIL_DISK_MB" ] && [ "$AVAIL_DISK_MB" -lt "$MIN_DISK_MB" ]; then
    warn "Low disk space: ${AVAIL_DISK_MB}MB available on /opt (recommended: ${MIN_DISK_MB}MB+)"
else
    success "Disk space: ${AVAIL_DISK_MB:-?}MB available on /opt"
fi

# 6. Network check
if curl -fsSL --connect-timeout 5 https://github.com > /dev/null 2>&1; then
    success "Internet connectivity OK"
elif wget -q --spider --timeout=5 https://github.com 2>/dev/null; then
    success "Internet connectivity OK (wget)"
else
    fail "Cannot reach https://github.com — check your network/DNS settings"
fi

echo ""
echo "──────────────────────────────────────────────────────"
echo ""

# ── Install prerequisites ──
info "Installing prerequisites..."
apt-get update -qq
apt-get install -y -qq git curl ca-certificates > /dev/null 2>&1
success "Prerequisites installed (git, curl)"

# ── Clone or update repository ──
if [ -d "$INSTALL_DIR/.git" ]; then
    info "Existing installation found at $INSTALL_DIR — updating..."
    cd "$INSTALL_DIR"
    git fetch origin main
    git reset --hard origin/main
    success "Repository updated to latest version"
else
    if [ -d "$INSTALL_DIR" ] && [ "$(ls -A "$INSTALL_DIR" 2>/dev/null)" ]; then
        warn "$INSTALL_DIR exists and is not empty — backing up to ${INSTALL_DIR}.bak"
        mv "$INSTALL_DIR" "${INSTALL_DIR}.bak.$(date +%Y%m%d%H%M%S)"
    fi
    info "Cloning ClearPanel to $INSTALL_DIR..."
    git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
    success "Repository cloned"
fi

# ── Verify install.sh exists ──
if [ ! -f "$INSTALL_DIR/install.sh" ]; then
    fail "install.sh not found in $INSTALL_DIR — download may be corrupt"
fi

echo ""
echo "──────────────────────────────────────────────────────"
echo ""
info "Handing off to main installer..."
echo ""

# ── Fix the repo URL in install.sh to use HTTPS (so re-runs also work without SSH keys) ──
sed -i 's|git@github.com:SefionITServices/clearPanel-ubuntu.git|https://github.com/SefionITServices/clearPanel-ubuntu.git|g' "$INSTALL_DIR/install.sh"

# ── Run the main installer ──
cd "$INSTALL_DIR"
exec bash "$INSTALL_DIR/install.sh"
