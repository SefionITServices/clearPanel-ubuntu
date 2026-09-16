#!/usr/bin/env bash
# ClearPanel: Configure Spam Policy
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
    exec sudo bash "$0" "$@"
fi

DOMAIN="${1:-}"
POLICY_JSON="${2:-{}}"

if [ -z "$DOMAIN" ]; then
    echo "Usage: $0 <domain> [policy_json]" >&2
    exit 1
fi

mkdir -p /var/lib/clearpanel/mail/policies
echo "$POLICY_JSON" > "/var/lib/clearpanel/mail/policies/${DOMAIN}.json"
chown clearpanel:clearpanel "/var/lib/clearpanel/mail/policies/${DOMAIN}.json" 2>/dev/null || true
chmod 664 "/var/lib/clearpanel/mail/policies/${DOMAIN}.json"
echo "[ClearPanel] Spam policy saved for ${DOMAIN}."
