#!/usr/bin/env bash
set -euo pipefail

# Install cloudflared and provide quick helpers for tunnel setup on Debian/Ubuntu/Zorin

if ! command -v curl >/dev/null 2>&1; then
  sudo apt-get update -y
  sudo apt-get install -y curl
fi

# Install via Cloudflare repo (recommended)
if ! command -v cloudflared >/dev/null 2>&1; then
  echo "Installing cloudflared..."
  curl -fsSL https://pkg.cloudflare.com/install.sh | sudo bash
  sudo apt-get install -y cloudflared
fi

echo "cloudflared version: $(cloudflared --version | head -n1)"

echo "\nNext steps:"
echo "1) Run: cloudflared tunnel login   # Authorize this machine in your browser"
echo "2) Run: cloudflared tunnel create clearPanel   # Create a named tunnel"
echo "3) Copy cloudflared/config.yml.example to ~/.cloudflared/config.yml and edit YOUR_TUNNEL_ID and hostname"
echo "4) Route DNS (if your domain is on Cloudflare): cloudflared tunnel route dns clearPanel panel.example.com"
echo "5) Start: cloudflared tunnel run clearPanel   or: sudo cloudflared service install"

