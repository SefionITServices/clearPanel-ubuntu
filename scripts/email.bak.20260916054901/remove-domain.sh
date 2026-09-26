#!/usr/bin/env bash
# ClearPanel: Remove Mail Domain
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

echo "[ClearPanel] Removing mail domain: ${DOMAIN}..."

sed -i "\|^${DOMAIN}$|d" /etc/clearpanel/mail/vdomains || true
sed -i "\|@${DOMAIN}|d" /etc/clearpanel/mail/vmailbox || true
sed -i "\|@${DOMAIN}|d" /etc/clearpanel/mail/dovecot-users || true
sed -i "\|@${DOMAIN}|d" /etc/opendkim/signing.table || true
sed -i "\|.${DOMAIN} |d" /etc/opendkim/key.table || true

postmap /etc/clearpanel/mail/vdomains 2>/dev/null || true
postmap /etc/clearpanel/mail/vmailbox 2>/dev/null || true

systemctl reload postfix 2>/dev/null || true
systemctl reload dovecot 2>/dev/null || true
systemctl reload opendkim 2>/dev/null || true

echo "[ClearPanel] Mail domain ${DOMAIN} removed."
