#!/usr/bin/env bash
# ClearPanel Email Common Utilities
set -euo pipefail

# Self-elevate to root via sudo if invoked by non-root user
if [ "$(id -u)" -ne 0 ]; then
    exec sudo "$0" "$@"
fi

MAIL_MODE="${MAIL_MODE:-production}"

SERVER_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
if [ -z "$SERVER_IP" ]; then
    SERVER_IP="$(ip -4 addr show scope global 2>/dev/null | grep inet | awk '{print $2}' | cut -d/ -f1 | head -n 1 || true)"
fi
if [ -z "$SERVER_IP" ]; then
    SERVER_IP="127.0.0.1"
fi

# Configuration paths
MAIL_CONFIG_DIR="/etc/clearpanel/mail"
VMAIL_HOME="/var/mail/vhosts"
VMAIL_USER="vmail"
VMAIL_GROUP="vmail"
VMAIL_UID="${VMAIL_UID:-5000}"
VMAIL_GID="${VMAIL_GID:-5000}"

POSTFIX_VDOMAINS="$MAIL_CONFIG_DIR/vdomains"
POSTFIX_VMAILBOX="$MAIL_CONFIG_DIR/vmailbox"
POSTFIX_VALIAS="$MAIL_CONFIG_DIR/valias"
DOVECOT_USERS="$MAIL_CONFIG_DIR/dovecot-users"
DOVECOT_PASSWD="$DOVECOT_USERS"

STATE_ROOT="${MAIL_STATE_DIR:-/var/lib/clearpanel/mail}"
DOMAINS_DIR="$STATE_ROOT/domains"
MAILBOX_DIR="$STATE_ROOT/mailboxes"
ALIASES_DIR="$STATE_ROOT/aliases"
LOG_DIR="$STATE_ROOT/logs"
POLICY_DIR="$STATE_ROOT/policies"

OPENDKIM_KEYS_DIR="/etc/opendkim/keys"
OPENDKIM_KEY_TABLE="/etc/opendkim/key.table"
OPENDKIM_SIGNING_TABLE="/etc/opendkim/signing.table"
OPENDKIM_TRUSTED_HOSTS="/etc/opendkim/trusted.hosts"
DKIM_KEYS_DIR="$OPENDKIM_KEYS_DIR"
DKIM_PUBLIC_DIR="$MAIL_CONFIG_DIR/dkim/public"

RSPAMD_LOCAL_DIR="/etc/rspamd/local.d"
RSPAMD_OVERRIDE_DIR="/etc/rspamd/override.d"

ensure_state_root() {
    mkdir -p "$STATE_ROOT" "$DOMAINS_DIR" "$MAILBOX_DIR" "$ALIASES_DIR" \
        "$DKIM_KEYS_DIR" "$DKIM_PUBLIC_DIR" "$LOG_DIR" "$POLICY_DIR" \
        "$MAIL_CONFIG_DIR" "$VMAIL_HOME" "$OPENDKIM_KEYS_DIR"

    if ! id "$VMAIL_USER" &>/dev/null; then
        groupadd -g "$VMAIL_GID" "$VMAIL_GROUP" 2>/dev/null || true
        useradd -u "$VMAIL_UID" -g "$VMAIL_GID" -d "$VMAIL_HOME" -s /usr/sbin/nologin "$VMAIL_USER" 2>/dev/null || true
    fi
    chown -R "${VMAIL_USER}:${VMAIL_GROUP}" "$VMAIL_HOME" 2>/dev/null || true
    chmod 770 "$VMAIL_HOME" 2>/dev/null || true

    touch "$POSTFIX_VDOMAINS" "$POSTFIX_VMAILBOX" "$POSTFIX_VALIAS" "$DOVECOT_USERS" \
        "$OPENDKIM_KEY_TABLE" "$OPENDKIM_SIGNING_TABLE" "$OPENDKIM_TRUSTED_HOSTS" 2>/dev/null || true
    chmod 644 "$POSTFIX_VDOMAINS" "$POSTFIX_VMAILBOX" "$POSTFIX_VALIAS" "$DOVECOT_USERS" 2>/dev/null || true
    chgrp dovecot "$DOVECOT_USERS" 2>/dev/null || true
}

ensure_state_root

# Return success when first column contains the exact key.
map_has_key() {
    local key="$1"
    local mapfile="$2"
    [[ -f "$mapfile" ]] || return 1
    awk -v key="$key" '$1 == key { found = 1; exit } END { exit found ? 0 : 1 }' "$mapfile"
}

# Remove rows where first column matches key exactly.
remove_map_entry_by_key() {
    local key="$1"
    local mapfile="$2"
    local tmpfile
    [[ -f "$mapfile" ]] || return 0
    tmpfile="$(mktemp)"
    awk -v key="$key" '$1 != key { print }' "$mapfile" >"$tmpfile"
    cat "$tmpfile" >"$mapfile"
    rm -f "$tmpfile"
}

# Remove rows where first column ends with the provided suffix.
remove_map_entries_by_key_suffix() {
    local suffix="$1"
    local mapfile="$2"
    local tmpfile
    [[ -f "$mapfile" ]] || return 0
    tmpfile="$(mktemp)"
    awk -v suffix="$suffix" '
        {
            key = $1
            if (key != "" && length(key) >= length(suffix) &&
                substr(key, length(key) - length(suffix) + 1) == suffix) {
                next
            }
            print
        }
    ' "$mapfile" >"$tmpfile"
    cat "$tmpfile" >"$mapfile"
    rm -f "$tmpfile"
}

# Remove a single passwd-file user (first colon-separated field).
remove_passwd_entry_by_user() {
    local user="$1"
    local passwd_file="$2"
    local tmpfile
    [[ -f "$passwd_file" ]] || return 0
    tmpfile="$(mktemp)"
    awk -F: -v user="$user" '$1 != user { print }' "$passwd_file" >"$tmpfile"
    cat "$tmpfile" >"$passwd_file"
    rm -f "$tmpfile"
}

# Remove all passwd-file users belonging to a domain.
remove_passwd_entries_by_domain() {
    local domain="$1"
    local passwd_file="$2"
    local suffix="@${domain}"
    local tmpfile
    [[ -f "$passwd_file" ]] || return 0
    tmpfile="$(mktemp)"
    awk -F: -v suffix="$suffix" '
        {
            user = $1
            if (user != "" && length(user) >= length(suffix) &&
                substr(user, length(user) - length(suffix) + 1) == suffix) {
                next
            }
            print
        }
    ' "$passwd_file" >"$tmpfile"
    cat "$tmpfile" >"$passwd_file"
    rm -f "$tmpfile"
}

postmap_rebuild() {
    local mapfile="$1"
    if command -v postmap >/dev/null 2>&1; then
        postmap "$mapfile" 2>/dev/null || true
    fi
}

postfix_reload() {
    if command -v postfix >/dev/null 2>&1; then
        postfix reload 2>/dev/null || true
    fi
}

dovecot_reload() {
    if command -v doveadm >/dev/null 2>&1; then
        doveadm reload 2>/dev/null || true
    fi
}

rspamd_reload() {
    if command -v rspamadm >/dev/null 2>&1; then
        systemctl reload rspamd 2>/dev/null || true
    fi
}

normalize_mailbox_local_part() {
    local mailbox="$1"
    local domain="$2"
    if [[ "$mailbox" == *"@"* ]]; then
        printf '%s\n' "${mailbox%@*}"
    else
        printf '%s\n' "$mailbox"
    fi
}

generate_dkim_key() {
    local DOMAIN="$1"
    local SELECTOR="${2:-default}"
    local KEY_DIR="/etc/opendkim/keys/${DOMAIN}"
    local PUB_EXPORT_DIR="/etc/clearpanel/mail/dkim/public/${DOMAIN}"

    mkdir -p "$KEY_DIR" "$PUB_EXPORT_DIR"
    chmod 750 "$KEY_DIR"
    chown -R opendkim:opendkim "$KEY_DIR" 2>/dev/null || true

    if [ ! -f "${KEY_DIR}/${SELECTOR}.private" ]; then
        echo "[DKIM] Generating new 2048-bit key pair for ${DOMAIN} (selector: ${SELECTOR})..."
        opendkim-genkey -b 2048 -D "$KEY_DIR" -d "$DOMAIN" -s "$SELECTOR"
        chown opendkim:opendkim "${KEY_DIR}/${SELECTOR}.private" "${KEY_DIR}/${SELECTOR}.txt" 2>/dev/null || true
        chmod 600 "${KEY_DIR}/${SELECTOR}.private"
        chmod 644 "${KEY_DIR}/${SELECTOR}.txt"
    fi

    # Update OpenDKIM tables
    sed -i "\|^${SELECTOR}._domainkey.${DOMAIN} |d" /etc/opendkim/key.table || true
    echo "${SELECTOR}._domainkey.${DOMAIN} ${DOMAIN}:${SELECTOR}:${KEY_DIR}/${SELECTOR}.private" >> /etc/opendkim/key.table

    sed -i "\|\*@${DOMAIN} |d" /etc/opendkim/signing.table || true
    echo "*@${DOMAIN} ${SELECTOR}._domainkey.${DOMAIN}" >> /etc/opendkim/signing.table

    grep -qxF "${DOMAIN}" /etc/opendkim/trusted.hosts || echo "${DOMAIN}" >> /etc/opendkim/trusted.hosts
    grep -qxF "*.${DOMAIN}" /etc/opendkim/trusted.hosts || echo "*.${DOMAIN}" >> /etc/opendkim/trusted.hosts

    # Export clean, untruncated DNS TXT string using OpenSSL
    local DKIM_B64=""
    if [ -f "${KEY_DIR}/${SELECTOR}.private" ]; then
        DKIM_B64="$(openssl rsa -in "${KEY_DIR}/${SELECTOR}.private" -pubout -outform DER 2>/dev/null | base64 -w 0 2>/dev/null | tr -d ' \t\r\n"' || true)"
    fi
    if [ -z "$DKIM_B64" ] && [ -f "${KEY_DIR}/${SELECTOR}.txt" ]; then
        DKIM_B64="$(grep -v '^;' "${KEY_DIR}/${SELECTOR}.txt" | tr -d ' \t\r\n"' | grep -o 'p=[^);]*' | cut -d= -f2 || true)"
    fi
    if [ -n "$DKIM_B64" ]; then
        echo "v=DKIM1; k=rsa; p=${DKIM_B64}" > "${PUB_EXPORT_DIR}/${SELECTOR}.txt"
        chmod 644 "${PUB_EXPORT_DIR}/${SELECTOR}.txt"
    else
        echo "[DKIM] Warning: Failed to extract valid base64 public key for ${DOMAIN} (selector: ${SELECTOR})" >&2
    fi

    systemctl reload opendkim 2>/dev/null || systemctl restart opendkim 2>/dev/null || true
    echo "${PUB_EXPORT_DIR}/${SELECTOR}.txt"
}

update_bind_dns() {
    local DOMAIN="$1"
    local DKIM_SELECTOR="${2:-default}"
    local ZONE_FILE=""

    # 1. First, search BIND config files (named.conf.local, named.conf, etc.) for the exact zone file
    for conf in /etc/bind/named.conf.local /etc/bind/named.conf /etc/named.conf /etc/bind/zones.conf; do
        if [ -f "$conf" ]; then
            local matched_file
            matched_file="$(awk -v dom="${DOMAIN}" '
                $0 ~ "zone[[:space:]]+\"" dom "\"" { in_zone=1 }
                in_zone && /file[[:space:]]+/ {
                    for(i=1;i<=NF;i++) {
                        if ($i ~ /file/) {
                            f=$(i+1);
                            gsub(/[";]/, "", f);
                            print f;
                            exit;
                        }
                    }
                }
                in_zone && /};/ { in_zone=0 }
            ' "$conf" || true)"
            if [ -n "$matched_file" ] && [ -f "$matched_file" ]; then
                ZONE_FILE="$matched_file"
                echo "[DNS] Found zone file declared in ${conf}: ${ZONE_FILE}"
                break
            fi
        fi
    done

    # 2. If not found in config, scan disk for existing zone files mentioning the domain
    if [ -z "$ZONE_FILE" ]; then
        for cand in \
            "/etc/bind/zones/db.${DOMAIN}" \
            "/etc/bind/zones/${DOMAIN}.db" \
            "/etc/bind/zones/${DOMAIN}" \
            "/var/cache/bind/db.${DOMAIN}" \
            "/var/cache/bind/${DOMAIN}.db" \
            "/var/lib/bind/db.${DOMAIN}" \
            "/var/lib/bind/${DOMAIN}.db" \
            "/etc/bind/db.${DOMAIN}" \
            "/var/named/${DOMAIN}.db"; do
            if [ -f "$cand" ]; then
                ZONE_FILE="$cand"
                echo "[DNS] Found zone file on disk: ${ZONE_FILE}"
                break
            fi
        done
    fi

    # 3. If still not found, search files containing SOA for this domain
    if [ -z "$ZONE_FILE" ]; then
        local found_soa
        found_soa="$(grep -rl "SOA.*${DOMAIN}" /etc/bind/ /var/cache/bind/ /var/lib/bind/ 2>/dev/null | head -n 1 || true)"
        if [ -n "$found_soa" ] && [ -f "$found_soa" ]; then
            ZONE_FILE="$found_soa"
            echo "[DNS] Located zone file via SOA match: ${ZONE_FILE}"
        fi
    fi

    # 4. If completely missing, create new in /etc/bind/zones/
    if [ -z "$ZONE_FILE" ]; then
        ZONE_FILE="/etc/bind/zones/db.${DOMAIN}"
        mkdir -p /etc/bind/zones
        echo "[DNS] Initializing new zone file at ${ZONE_FILE}..."
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
        if [ -f /etc/bind/named.conf.local ] && ! grep -q "zone \"${DOMAIN}\"" /etc/bind/named.conf.local; then
            cat << CONFEOF >> /etc/bind/named.conf.local

zone "${DOMAIN}" {
    type master;
    file "${ZONE_FILE}";
};
CONFEOF
        fi
    fi

    # Read DKIM public key
    local DKIM_PUB=""
    if [ -f "/etc/clearpanel/mail/dkim/public/${DOMAIN}/${DKIM_SELECTOR}.txt" ]; then
        DKIM_PUB="$(tr -d '\r\n' < "/etc/clearpanel/mail/dkim/public/${DOMAIN}/${DKIM_SELECTOR}.txt" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    fi

    echo "[DNS] Updating mail records in ${ZONE_FILE}..."
    # Clean old mail records
    sed -i "/^mail\.${DOMAIN}\./d" "$ZONE_FILE" || true
    sed -i "/^mail\s\+/d" "$ZONE_FILE" || true
    sed -i "/^webmail\.${DOMAIN}\./d" "$ZONE_FILE" || true
    sed -i "/^webmail\s\+/d" "$ZONE_FILE" || true
    sed -i "/^smtp\.${DOMAIN}\./d" "$ZONE_FILE" || true
    sed -i "/^smtp\s\+/d" "$ZONE_FILE" || true
    sed -i "/^imap\.${DOMAIN}\./d" "$ZONE_FILE" || true
    sed -i "/^imap\s\+/d" "$ZONE_FILE" || true
    sed -i "/^pop\.${DOMAIN}\./d" "$ZONE_FILE" || true
    sed -i "/^pop\s\+/d" "$ZONE_FILE" || true
    sed -i "/^autoconfig\.${DOMAIN}\./d" "$ZONE_FILE" || true
    sed -i "/^autoconfig\s\+/d" "$ZONE_FILE" || true
    sed -i "/^autodiscover\.${DOMAIN}\./d" "$ZONE_FILE" || true
    sed -i "/^autodiscover\s\+/d" "$ZONE_FILE" || true
    sed -i "/IN\s\+MX/d" "$ZONE_FILE" || true
    sed -i "/v=spf1/d" "$ZONE_FILE" || true
    sed -i "/_dmarc/d" "$ZONE_FILE" || true
    sed -i "/_domainkey/d" "$ZONE_FILE" || true

    # Append fresh, complete records
    cat << RECIEVE >> "$ZONE_FILE"
mail.${DOMAIN}.      IN  A       ${SERVER_IP}
webmail.${DOMAIN}.   IN  A       ${SERVER_IP}
smtp.${DOMAIN}.      IN  CNAME   mail.${DOMAIN}.
imap.${DOMAIN}.      IN  CNAME   mail.${DOMAIN}.
pop.${DOMAIN}.       IN  CNAME   mail.${DOMAIN}.
autoconfig.${DOMAIN}. IN CNAME   mail.${DOMAIN}.
autodiscover.${DOMAIN}. IN CNAME mail.${DOMAIN}.
${DOMAIN}.           IN  MX  10  mail.${DOMAIN}.
${DOMAIN}.           IN  TXT     "v=spf1 mx a ip4:${SERVER_IP} ~all"
_dmarc.${DOMAIN}.    IN  TXT     "v=DMARC1; p=none; rua=mailto:admin@${DOMAIN}; fo=1"
RECIEVE

    if [ -n "$DKIM_PUB" ] && [[ "$DKIM_PUB" =~ p=[A-Za-z0-9+/]{20,} ]]; then
        # Format for BIND9: chunk into <=200 character strings inside parentheses to comply with RFC 1035 (255 byte max string)
        local DKIM_CHUNKS
        DKIM_CHUNKS="$(echo "$DKIM_PUB" | fold -w 200 | sed 's/.*/"&"/' | tr '\n' ' ')"
        echo "${DKIM_SELECTOR}._domainkey.${DOMAIN}. IN TXT ( ${DKIM_CHUNKS} )" >> "$ZONE_FILE"
    fi

    # Increment SOA serial
    local SERIAL_LINE
    SERIAL_LINE="$(grep -n -i 'serial' "$ZONE_FILE" | head -n 1 | cut -d: -f1 || true)"
    if [ -n "$SERIAL_LINE" ]; then
        local CUR_SERIAL
        CUR_SERIAL="$(sed -n "${SERIAL_LINE}p" "$ZONE_FILE" | grep -oE '[0-9]+' | head -n 1 || true)"
        if [ -n "$CUR_SERIAL" ]; then
            local TODAY_PREFIX="$(date +%Y%m%d)"
            local NEW_SERIAL
            if [[ "$CUR_SERIAL" =~ ^${TODAY_PREFIX}[0-9]{2}$ ]]; then
                NEW_SERIAL="$((CUR_SERIAL + 1))"
            else
                NEW_SERIAL="${TODAY_PREFIX}01"
            fi
            sed -i "${SERIAL_LINE}s/${CUR_SERIAL}/${NEW_SERIAL}/" "$ZONE_FILE"
            echo "[DNS] Updated serial to ${NEW_SERIAL} on line ${SERIAL_LINE}"
        fi
    else
        local CUR_SERIAL
        CUR_SERIAL="$(grep -oE '[0-9]{10}' "$ZONE_FILE" | head -n 1 || true)"
        if [ -n "$CUR_SERIAL" ]; then
            local NEW_SERIAL="$((CUR_SERIAL + 1))"
            sed -i "s/${CUR_SERIAL}/${NEW_SERIAL}/" "$ZONE_FILE"
            echo "[DNS] Incremented serial from ${CUR_SERIAL} to ${NEW_SERIAL}"
        fi
    fi

    # Validate zone with named-checkzone
    if command -v named-checkzone >/dev/null 2>&1; then
        if ! named-checkzone "${DOMAIN}" "$ZONE_FILE"; then
            echo "[DNS] ERROR: Zone validation failed for ${DOMAIN} in ${ZONE_FILE}!" >&2
            return 1
        fi
    fi

    # Reload BIND9
    rndc reload "${DOMAIN}" 2>/dev/null || rndc reload 2>/dev/null || systemctl reload named 2>/dev/null || systemctl reload bind9 2>/dev/null || true
    rndc flush 2>/dev/null || true
    echo "[DNS] Zone updated & reloaded for ${DOMAIN}"
}

sync_mail_ssl() {
    local TARGET_DOMAIN="${1:-}"
    echo "[SSL] Synchronizing SSL/TLS certificates for Postfix and Dovecot..."

    mkdir -p /var/www/certbot/.well-known/acme-challenge
    chown -R www-data:www-data /var/www/certbot 2>/dev/null || true
    chmod -R 755 /var/www/certbot 2>/dev/null || true

    mkdir -p /etc/clearpanel/mail/ssl
    chmod 755 /etc/clearpanel/mail/ssl
    usermod -a -G postfix dovecot 2>/dev/null || true

    # Attempt to request Let's Encrypt certificate for mail.$TARGET_DOMAIN if specified and missing
    if [ -n "$TARGET_DOMAIN" ] && command -v certbot >/dev/null 2>&1; then
        if [ ! -d "/etc/letsencrypt/live/mail.${TARGET_DOMAIN}" ] && [ -d "/etc/letsencrypt/live/${TARGET_DOMAIN}" ]; then
            echo "[SSL] Requesting certificate for mail.${TARGET_DOMAIN}..."
            certbot certonly --webroot -w /var/www/certbot -d "mail.${TARGET_DOMAIN}" --non-interactive --agree-tos --register-unsafely-without-email 2>/dev/null || true
        fi
    fi

    # Find primary certificate
    local PRIMARY_DOMAIN=""
    if [ -n "$TARGET_DOMAIN" ] && [ -f "/etc/letsencrypt/live/${TARGET_DOMAIN}/fullchain.pem" ]; then
        PRIMARY_DOMAIN="$TARGET_DOMAIN"
    fi
    if [ -z "$PRIMARY_DOMAIN" ] && [ -n "$TARGET_DOMAIN" ] && [ -f "/etc/letsencrypt/live/mail.${TARGET_DOMAIN}/fullchain.pem" ]; then
        PRIMARY_DOMAIN="mail.${TARGET_DOMAIN}"
    fi
    if [ -z "$PRIMARY_DOMAIN" ]; then
        for live_dir in /etc/letsencrypt/live/*; do
            [ -d "$live_dir" ] || continue
            local dname="$(basename "$live_dir")"
            [ "$dname" = "README" ] && continue
            if [ -f "${live_dir}/fullchain.pem" ]; then
                PRIMARY_DOMAIN="$dname"
                break
            fi
        done
    fi

    local DOVECOT_SSL_CONF="/etc/dovecot/conf.d/99-clearpanel-ssl.conf"
    local POSTFIX_SNI="/etc/postfix/sni"

    mkdir -p /etc/dovecot/conf.d
    cat << 'EOF' > "$DOVECOT_SSL_CONF"
# ClearPanel Automated Dovecot SSL & SNI Configuration
ssl = yes
ssl_prefer_server_ciphers = yes
EOF

    > "$POSTFIX_SNI"

    if [ -n "$PRIMARY_DOMAIN" ] && [ -f "/etc/letsencrypt/live/${PRIMARY_DOMAIN}/fullchain.pem" ]; then
        echo "[SSL] Primary certificate set to: ${PRIMARY_DOMAIN}"
        mkdir -p "/etc/clearpanel/mail/ssl/${PRIMARY_DOMAIN}"
        cp -L "/etc/letsencrypt/live/${PRIMARY_DOMAIN}/fullchain.pem" "/etc/clearpanel/mail/ssl/${PRIMARY_DOMAIN}/fullchain.pem"
        cp -L "/etc/letsencrypt/live/${PRIMARY_DOMAIN}/privkey.pem" "/etc/clearpanel/mail/ssl/${PRIMARY_DOMAIN}/privkey.pem"
        chown -R root:postfix "/etc/clearpanel/mail/ssl/${PRIMARY_DOMAIN}" 2>/dev/null || true
        chmod 750 "/etc/clearpanel/mail/ssl/${PRIMARY_DOMAIN}" 2>/dev/null || true
        chmod 640 "/etc/clearpanel/mail/ssl/${PRIMARY_DOMAIN}"/* 2>/dev/null || true

        echo "ssl_cert = </etc/clearpanel/mail/ssl/${PRIMARY_DOMAIN}/fullchain.pem" >> "$DOVECOT_SSL_CONF"
        echo "ssl_key = </etc/clearpanel/mail/ssl/${PRIMARY_DOMAIN}/privkey.pem" >> "$DOVECOT_SSL_CONF"

        postconf -e "smtpd_tls_cert_file = /etc/clearpanel/mail/ssl/${PRIMARY_DOMAIN}/fullchain.pem" 2>/dev/null || true
        postconf -e "smtpd_tls_key_file = /etc/clearpanel/mail/ssl/${PRIMARY_DOMAIN}/privkey.pem" 2>/dev/null || true
        postconf -e "smtpd_tls_security_level = may" 2>/dev/null || true
    fi

    # Helper function to add SNI mapping
    add_sni() {
        local name="$1"
        local cert_domain="$2"
        if [ -f "/etc/clearpanel/mail/ssl/${cert_domain}/fullchain.pem" ] && [ -f "/etc/clearpanel/mail/ssl/${cert_domain}/privkey.pem" ]; then
            if ! grep -q "^${name} " "$POSTFIX_SNI"; then
                echo "${name} /etc/clearpanel/mail/ssl/${cert_domain}/privkey.pem /etc/clearpanel/mail/ssl/${cert_domain}/fullchain.pem" >> "$POSTFIX_SNI"
            fi
            if ! grep -q "local_name \"${name}\"" "$DOVECOT_SSL_CONF"; then
                cat << DOVEOF >> "$DOVECOT_SSL_CONF"
local_name "${name}" {
  ssl_cert = </etc/clearpanel/mail/ssl/${cert_domain}/fullchain.pem
  ssl_key = </etc/clearpanel/mail/ssl/${cert_domain}/privkey.pem
}
DOVEOF
            fi
        fi
    }

    # First copy all live certs
    for live_dir in /etc/letsencrypt/live/*; do
        [ -d "$live_dir" ] || continue
        local dname="$(basename "$live_dir")"
        [ "$dname" = "README" ] && continue
        if [ -f "${live_dir}/fullchain.pem" ] && [ -f "${live_dir}/privkey.pem" ]; then
            mkdir -p "/etc/clearpanel/mail/ssl/${dname}"
            cp -L "${live_dir}/fullchain.pem" "/etc/clearpanel/mail/ssl/${dname}/fullchain.pem"
            cp -L "${live_dir}/privkey.pem" "/etc/clearpanel/mail/ssl/${dname}/privkey.pem"
            chown -R root:postfix "/etc/clearpanel/mail/ssl/${dname}" 2>/dev/null || true
            chmod 750 "/etc/clearpanel/mail/ssl/${dname}" 2>/dev/null || true
            chmod 640 "/etc/clearpanel/mail/ssl/${dname}"/* 2>/dev/null || true
        fi
    done

    # Priority 1: dedicated mail.* certs
    for live_dir in /etc/letsencrypt/live/mail.*; do
        [ -d "$live_dir" ] || continue
        local dname="$(basename "$live_dir")"
        add_sni "$dname" "$dname"
    done

    # Priority 2: base domain certs
    for live_dir in /etc/letsencrypt/live/*; do
        [ -d "$live_dir" ] || continue
        local dname="$(basename "$live_dir")"
        [ "$dname" = "README" ] && continue
        [[ "$dname" =~ ^mail\. ]] && continue
        add_sni "$dname" "$dname"
        add_sni "mail.${dname}" "$dname"
        add_sni "smtp.${dname}" "$dname"
        add_sni "imap.${dname}" "$dname"
    done

    # Build Postfix SNI hash map
    postconf -e "tls_server_sni_maps = hash:/etc/postfix/sni" 2>/dev/null || true
    postmap -F "$POSTFIX_SNI" 2>/dev/null || postmap "$POSTFIX_SNI" 2>/dev/null || true

    systemctl reload dovecot 2>/dev/null || true
    systemctl reload postfix 2>/dev/null || true
    echo "[SSL] Dovecot and Postfix SSL/SNI synchronization complete."
}

