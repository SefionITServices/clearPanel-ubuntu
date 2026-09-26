#!/usr/bin/env bash
# ClearPanel Email Common Utilities
set -euo pipefail

# Self-elevate to root via sudo if invoked by non-root
if [ "$(id -u)" -ne 0 ]; then
    exec sudo bash "$0" "$@"
fi

SERVER_IP="$(hostname -I | awk '{print $1}')"
if [ -z "$SERVER_IP" ]; then
    SERVER_IP="72.61.7.15"
fi

# Ensure base paths
mkdir -p /var/lib/clearpanel/mail/domains
mkdir -p /var/lib/clearpanel/mail/mailboxes
mkdir -p /var/lib/clearpanel/mail/policies
mkdir -p /etc/clearpanel/mail
mkdir -p /etc/opendkim/keys
mkdir -p /var/mail/vhosts

# Ensure map files
touch /etc/clearpanel/mail/vdomains
touch /etc/clearpanel/mail/vmailbox
touch /etc/clearpanel/mail/valias
touch /etc/clearpanel/mail/dovecot-users
touch /etc/opendkim/key.table
touch /etc/opendkim/signing.table
touch /etc/opendkim/trusted.hosts

generate_dkim_key() {
    local DOMAIN="$1"
    local SELECTOR="${2:-default}"
    local KEY_DIR="/etc/opendkim/keys/${DOMAIN}"
    local PUB_EXPORT_DIR="/etc/clearpanel/mail/dkim/public/${DOMAIN}"

    mkdir -p "$KEY_DIR" "$PUB_EXPORT_DIR"
    chmod 750 "$KEY_DIR"
    chown -R opendkim:opendkim "$KEY_DIR"

    if [ ! -f "${KEY_DIR}/${SELECTOR}.private" ]; then
        echo "[DKIM] Generating new key pair for ${DOMAIN} (selector: ${SELECTOR})..."
        opendkim-genkey -b 2048 -D "$KEY_DIR" -d "$DOMAIN" -s "$SELECTOR"
        chown opendkim:opendkim "${KEY_DIR}/${SELECTOR}.private" "${KEY_DIR}/${SELECTOR}.txt"
        chmod 600 "${KEY_DIR}/${SELECTOR}.private"
        chmod 644 "${KEY_DIR}/${SELECTOR}.txt"
    fi

    # Update OpenDKIM tables
    sed -i "\|^${SELECTOR}._domainkey.${DOMAIN} |d" /etc/opendkim/key.table
    echo "${SELECTOR}._domainkey.${DOMAIN} ${DOMAIN}:${SELECTOR}:${KEY_DIR}/${SELECTOR}.private" >> /etc/opendkim/key.table

    sed -i "\|\*@${DOMAIN} |d" /etc/opendkim/signing.table
    echo "*@${DOMAIN} ${SELECTOR}._domainkey.${DOMAIN}" >> /etc/opendkim/signing.table

    grep -qxF "${DOMAIN}" /etc/opendkim/trusted.hosts || echo "${DOMAIN}" >> /etc/opendkim/trusted.hosts
    grep -qxF "*.${DOMAIN}" /etc/opendkim/trusted.hosts || echo "*.${DOMAIN}" >> /etc/opendkim/trusted.hosts

    # Export clean DNS TXT string
    local DKIM_RECORD
    DKIM_RECORD="$(grep -o 'p=[^"]*' "${KEY_DIR}/${SELECTOR}.txt" | tr -d ' \n\t"')"
    echo "v=DKIM1; k=rsa; ${DKIM_RECORD}" > "${PUB_EXPORT_DIR}/${SELECTOR}.txt"
    chmod 644 "${PUB_EXPORT_DIR}/${SELECTOR}.txt"

    systemctl reload opendkim 2>/dev/null || true
    echo "${PUB_EXPORT_DIR}/${SELECTOR}.txt"
}

update_bind_dns() {
    local DOMAIN="$1"
    local DKIM_SELECTOR="${2:-default}"
    local ZONE_FILE=""

    # Locate BIND zone file for this domain
    for cand in "/etc/bind/zones/db.${DOMAIN}" "/var/cache/bind/db.${DOMAIN}" "/etc/bind/db.${DOMAIN}" "/var/named/${DOMAIN}.db"; do
        if [ -f "$cand" ]; then
            ZONE_FILE="$cand"
            break
        fi
    done

    # If zone file doesn't exist, check named.conf.local
    if [ -z "$ZONE_FILE" ]; then
        ZONE_FILE="/etc/bind/zones/db.${DOMAIN}"
        mkdir -p /etc/bind/zones
        if [ ! -f "$ZONE_FILE" ]; then
            echo "[DNS] Initializing new zone file for ${DOMAIN}..."
            local SERIAL="$(date +%Y%m%d01)"
            cat << ZONEEOF > "$ZONE_FILE"
\$TTL 3600
@   IN  SOA ns1.mainserver.in. admin.${DOMAIN}. (
            ${SERIAL} ; Serial
            3600       ; Refresh
            1800       ; Retry
            604800     ; Expire
            86400 )    ; Minimum

@       IN  NS      ns1.mainserver.in.
@       IN  NS      ns2.mainserver.in.
@       IN  A       ${SERVER_IP}
ZONEEOF
            # Ensure zone is declared in /etc/bind/named.conf.local
            if ! grep -q "zone \"${DOMAIN}\"" /etc/bind/named.conf.local 2>/dev/null; then
                cat << CONFEOF >> /etc/bind/named.conf.local

zone "${DOMAIN}" {
    type master;
    file "${ZONE_FILE}";
};
CONFEOF
            fi
        fi
    fi

    # Read DKIM public key
    local DKIM_PUB=""
    if [ -f "/etc/clearpanel/mail/dkim/public/${DOMAIN}/${DKIM_SELECTOR}.txt" ]; then
        DKIM_PUB="$(cat "/etc/clearpanel/mail/dkim/public/${DOMAIN}/${DKIM_SELECTOR}.txt")"
    fi

    echo "[DNS] Updating mail records in ${ZONE_FILE}..."
    # Clean old mail records
    sed -i "/^mail\.${DOMAIN}\./d" "$ZONE_FILE"
    sed -i "/^mail\s\+/d" "$ZONE_FILE"
    sed -i "/^webmail\.${DOMAIN}\./d" "$ZONE_FILE"
    sed -i "/^webmail\s\+/d" "$ZONE_FILE"
    sed -i "/IN\s\+MX/d" "$ZONE_FILE"
    sed -i "/v=spf1/d" "$ZONE_FILE"
    sed -i "/_dmarc/d" "$ZONE_FILE"
    sed -i "/_domainkey/d" "$ZONE_FILE"

    # Append fresh, complete records
    cat << RECIEVE >> "$ZONE_FILE"
mail.${DOMAIN}.      IN  A       ${SERVER_IP}
webmail.${DOMAIN}.   IN  A       ${SERVER_IP}
${DOMAIN}.           IN  MX  10  mail.${DOMAIN}.
${DOMAIN}.           IN  TXT     "v=spf1 mx a ip4:${SERVER_IP} ~all"
_dmarc.${DOMAIN}.    IN  TXT     "v=DMARC1; p=none; rua=mailto:admin@${DOMAIN}; fo=1"
RECIEVE

    if [ -n "$DKIM_PUB" ]; then
        echo "${DKIM_SELECTOR}._domainkey.${DOMAIN}. IN TXT \"${DKIM_PUB}\"" >> "$ZONE_FILE"
    fi

    # Increment SOA serial
    local CUR_SERIAL
    CUR_SERIAL="$(grep -oE '[0-9]{10}' "$ZONE_FILE" | head -n 1 || true)"
    if [ -n "$CUR_SERIAL" ]; then
        local NEW_SERIAL="$((CUR_SERIAL + 1))"
        sed -i "s/${CUR_SERIAL}/${NEW_SERIAL}/" "$ZONE_FILE"
    fi

    # Reload BIND9
    rndc reload "${DOMAIN}" 2>/dev/null || systemctl reload named 2>/dev/null || systemctl reload bind9 2>/dev/null || true
    echo "[DNS] Zone updated & reloaded for ${DOMAIN}"
}
