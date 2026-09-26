#!/usr/bin/env bash
# ClearPanel: Provision Mail Domain
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
    exec sudo "$0" "$@"
fi

DOMAIN="${1:-}"
if [ -z "$DOMAIN" ]; then
    echo "Usage: $0 <domain>" >&2
    exit 1
fi

SCRIPT_DIR="$(dirname "$0")"
source "${SCRIPT_DIR}/common.sh"

echo "[ClearPanel] Provisioning mail domain: ${DOMAIN}..."

# 1. Create domain storage directory
mkdir -p "/var/lib/clearpanel/mail/domains/${DOMAIN}"
mkdir -p "/var/lib/clearpanel/mail/mailboxes/${DOMAIN}"
mkdir -p "/var/mail/vhosts/${DOMAIN}"
chown -R vmail:vmail "/var/mail/vhosts/${DOMAIN}" 2>/dev/null || true

# 2. Add to Postfix virtual domains map
if ! grep -qxF "${DOMAIN}" /etc/clearpanel/mail/vdomains; then
    echo "${DOMAIN}" >> /etc/clearpanel/mail/vdomains
fi

# 3. Generate DKIM keys
generate_dkim_key "$DOMAIN" "default"

# 4. Auto-inject DNS records into BIND
update_bind_dns "$DOMAIN" "default"

# 5. Default Spam Policy
cat << POLICIES > "/var/lib/clearpanel/mail/policies/${DOMAIN}.json"
{
  "domain": "${DOMAIN}",
  "spamThreshold": 6,
  "greylistingEnabled": true,
  "greylistingDelaySeconds": 300,
  "virusScanEnabled": true
}
POLICIES

# 6. Rebuild maps & reload Postfix
postmap /etc/clearpanel/mail/vdomains 2>/dev/null || true
systemctl reload postfix 2>/dev/null || true
systemctl reload dovecot 2>/dev/null || true

echo "[ClearPanel] Domain ${DOMAIN} successfully provisioned for email."
