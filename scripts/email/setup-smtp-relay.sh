#!/usr/bin/env bash
# setup-smtp-relay.sh — Configure Postfix outbound SMTP relay
# Usage: setup-smtp-relay.sh <action> [args...]
#   setup-smtp-relay.sh set <relay_host> <relay_port> [username] [password]
#   setup-smtp-relay.sh get
#   setup-smtp-relay.sh remove
#
# Dual-mode: MAIL_MODE=dev (JSON state) vs production (Postfix config)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

ACTION="${1:?Usage: setup-smtp-relay.sh <set|get|remove> [args...]}"
STATE_DIR="${MAIL_STATE_DIR:-$SCRIPT_DIR/../../backend/mail-state}"
mkdir -p "$STATE_DIR"

case "$ACTION" in
  set)
    RELAY_HOST="${2:?relay_host required}"
    RELAY_PORT="${3:?relay_port required}"
    RELAY_USER="${4:-}"
    RELAY_PASS="${5:-}"

    if [[ "$MAIL_MODE" == "production" ]]; then
      MAIN_CF="/etc/postfix/main.cf"
      SASL_PASSWD="/etc/postfix/sasl_passwd"

      # Set relayhost
      postconf -e "relayhost = [${RELAY_HOST}]:${RELAY_PORT}"

      if [[ -n "$RELAY_USER" && -n "$RELAY_PASS" ]]; then
        # Configure SASL authentication
        postconf -e "smtp_sasl_auth_enable = yes"
        postconf -e "smtp_sasl_password_maps = hash:/etc/postfix/sasl_passwd"
        postconf -e "smtp_sasl_security_options = noanonymous"
        postconf -e "smtp_tls_security_level = encrypt"
        postconf -e "smtp_tls_CAfile = /etc/ssl/certs/ca-certificates.crt"

        echo "[${RELAY_HOST}]:${RELAY_PORT} ${RELAY_USER}:${RELAY_PASS}" > "$SASL_PASSWD"
        chmod 600 "$SASL_PASSWD"
        postmap "$SASL_PASSWD"
      fi

      systemctl reload postfix 2>/dev/null || true
      log_info "SMTP relay configured: [${RELAY_HOST}]:${RELAY_PORT}"
      echo "ok"
    else
      cat > "$STATE_DIR/smtp-relay.json" << EOF
{"host":"${RELAY_HOST}","port":${RELAY_PORT},"username":"${RELAY_USER}","authenticated":$([ -n "$RELAY_USER" ] && echo true || echo false),"updatedAt":"$(date -u +%Y-%m-%dT%H:%M:%SZ)"}
EOF
      log_info "[dev] SMTP relay configured: [${RELAY_HOST}]:${RELAY_PORT}"
      echo "ok"
    fi
    ;;

  get)
    if [[ "$MAIL_MODE" == "production" ]]; then
      RELAYHOST=$(postconf -h relayhost 2>/dev/null || echo "")
      SASL_ENABLED=$(postconf -h smtp_sasl_auth_enable 2>/dev/null || echo "no")
      if [[ -z "$RELAYHOST" ]]; then
        echo '{"configured":false}'
      else
        # Parse host and port
        HOST=$(echo "$RELAYHOST" | sed 's/\[//g;s/\]//g' | cut -d: -f1)
        PORT=$(echo "$RELAYHOST" | sed 's/\[//g;s/\]//g' | cut -d: -f2)
        echo "{\"configured\":true,\"host\":\"${HOST}\",\"port\":${PORT:-25},\"authenticated\":$([ \"$SASL_ENABLED\" = \"yes\" ] && echo true || echo false)}"
      fi
    else
      if [[ -f "$STATE_DIR/smtp-relay.json" ]]; then
        cat "$STATE_DIR/smtp-relay.json"
      else
        echo '{"configured":false}'
      fi
    fi
    ;;

  remove)
    if [[ "$MAIL_MODE" == "production" ]]; then
      postconf -e "relayhost ="
      postconf -e "smtp_sasl_auth_enable = no"
      rm -f /etc/postfix/sasl_passwd /etc/postfix/sasl_passwd.db
      systemctl reload postfix 2>/dev/null || true
      log_info "SMTP relay removed"
      echo "ok"
    else
      rm -f "$STATE_DIR/smtp-relay.json"
      log_info "[dev] SMTP relay removed"
      echo "ok"
    fi
    ;;

  *)
    echo "Unknown action: $ACTION" >&2
    exit 1
    ;;
esac
