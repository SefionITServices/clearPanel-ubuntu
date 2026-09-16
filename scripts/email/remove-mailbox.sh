#!/usr/bin/env bash
# ClearPanel: Remove Mailbox
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
    exec sudo "$0" "$@"
fi

DOMAIN="${1:-}"
EMAIL="${2:-}"

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
    echo "Usage: $0 <domain> <email>" >&2
    exit 1
fi

SCRIPT_DIR="$(dirname "$0")"
source "${SCRIPT_DIR}/common.sh"

echo "[ClearPanel] Removing mailbox: ${EMAIL}..."

sed -i "\|^${EMAIL}:|d" /etc/clearpanel/mail/dovecot-users || true
sed -i "\|^${EMAIL}\s|d" /etc/clearpanel/mail/vmailbox || true
postmap /etc/clearpanel/mail/vmailbox 2>/dev/null || true

USER_PART="${EMAIL%@*}"
MAILDIR="/var/mail/vhosts/${DOMAIN}/${USER_PART}"
if [ -d "$MAILDIR" ]; then
    mv "$MAILDIR" "${MAILDIR}.deleted.$(date +%s)" 2>/dev/null || true
fi

systemctl reload postfix 2>/dev/null || true
systemctl reload dovecot 2>/dev/null || true
echo "[ClearPanel] Mailbox ${EMAIL} removed."
