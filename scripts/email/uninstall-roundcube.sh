#!/usr/bin/env bash
# ==========================================================================
# uninstall-roundcube.sh — Remove Roundcube webmail
#
# Usage:  ./uninstall-roundcube.sh <webmail-domain>
# ==========================================================================
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <webmail-domain>" >&2
  exit 1
fi

WEBMAIL_DOMAIN="$1"

echo "=== ClearPanel Roundcube Removal ==="

# Remove nginx vhost
rm -f "/etc/nginx/sites-enabled/${WEBMAIL_DOMAIN}" 2>/dev/null || true
rm -f "/etc/nginx/sites-available/${WEBMAIL_DOMAIN}" 2>/dev/null || true
if nginx -t 2>/dev/null; then
  systemctl reload nginx 2>/dev/null || true
fi
echo "[✓] Nginx vhost removed"

# Remove Roundcube packages
export DEBIAN_FRONTEND=noninteractive
apt-get remove -y -qq roundcube roundcube-core roundcube-plugins roundcube-plugins-extra 2>/dev/null || true
apt-get autoremove -y -qq 2>/dev/null || true
echo "[✓] Roundcube packages removed"

# Optionally clean data
if [[ "${2:-}" == "--purge" ]]; then
  apt-get purge -y -qq roundcube roundcube-core 2>/dev/null || true
  rm -rf /var/lib/roundcube 2>/dev/null || true
  rm -rf /var/log/roundcube 2>/dev/null || true
  rm -rf /etc/roundcube 2>/dev/null || true
  echo "[✓] Roundcube data purged"
fi

echo ""
echo "=== Roundcube removal complete ==="
