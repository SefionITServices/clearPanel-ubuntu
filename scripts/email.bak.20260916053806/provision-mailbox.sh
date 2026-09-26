#!/usr/bin/env bash
# ClearPanel: Provision Mailbox
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
    exec sudo "$0" "$@"
fi

DOMAIN="${1:-}"
EMAIL="${2:-}"
PASS_HASH="${3:-}"
QUOTA="${4:-1024}"

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ] || [ -z "$PASS_HASH" ]; then
    echo "Usage: $0 <domain> <email> <password_hash> [quota_mb]" >&2
    exit 1
fi

SCRIPT_DIR="$(dirname "$0")"
source "${SCRIPT_DIR}/common.sh"

USER_PART="${EMAIL%@*}"
MAILDIR="/var/mail/vhosts/${DOMAIN}/${USER_PART}"

echo "[ClearPanel] Provisioning mailbox: ${EMAIL} (storage: ${MAILDIR})..."

# 1. Create mailbox directory
mkdir -p "${MAILDIR}/cur" "${MAILDIR}/new" "${MAILDIR}/tmp"
chown -R vmail:vmail "/var/mail/vhosts/${DOMAIN}" 2>/dev/null || true
chmod -R 700 "${MAILDIR}"

# 2. Update Dovecot passwd-file (/etc/clearpanel/mail/dovecot-users)
sed -i "\|^${EMAIL}:|d" /etc/clearpanel/mail/dovecot-users || true
echo "${EMAIL}:${PASS_HASH}:5000:5000::${MAILDIR}::userdb_quota_rule=*:storage=${QUOTA}M" >> /etc/clearpanel/mail/dovecot-users
chmod 644 /etc/clearpanel/mail/dovecot-users
chgrp dovecot /etc/clearpanel/mail/dovecot-users 2>/dev/null || true

# 3. Update Postfix virtual mailbox map (/etc/clearpanel/mail/vmailbox)
sed -i "\|^${EMAIL}\s|d" /etc/clearpanel/mail/vmailbox || true
echo "${EMAIL} ${DOMAIN}/${USER_PART}/" >> /etc/clearpanel/mail/vmailbox
postmap /etc/clearpanel/mail/vmailbox

# 4. Reload Postfix and Dovecot
systemctl reload postfix 2>/dev/null || true
systemctl reload dovecot 2>/dev/null || true

echo "[ClearPanel] Mailbox ${EMAIL} successfully provisioned."
