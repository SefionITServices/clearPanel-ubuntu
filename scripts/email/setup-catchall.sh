#!/usr/bin/env bash
# setup-catchall.sh — Enable or disable catch-all mailbox for a domain
# Usage: setup-catchall.sh <domain> <target_email|disable>
#
# Dual-mode: MAIL_MODE=dev (JSON state) vs production (Postfix virtual alias)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

DOMAIN="${1:?Usage: setup-catchall.sh <domain> <target_email|disable>}"
TARGET="${2:?Target email or 'disable'}"

STATE_DIR="${MAIL_STATE_DIR:-$SCRIPT_DIR/../../backend/mail-state}"
mkdir -p "$STATE_DIR/domains"

if [[ "$MAIL_MODE" == "production" ]]; then
  VIRTUAL_FILE="/etc/postfix/virtual"
  touch "$VIRTUAL_FILE"

  # Remove existing catch-all for this domain
  grep -v "^@${DOMAIN} " "$VIRTUAL_FILE" > "$VIRTUAL_FILE.tmp" 2>/dev/null || true
  mv "$VIRTUAL_FILE.tmp" "$VIRTUAL_FILE"

  if [[ "$TARGET" != "disable" ]]; then
    echo "@${DOMAIN} ${TARGET}" >> "$VIRTUAL_FILE"
    log_info "Catch-all enabled for ${DOMAIN} → ${TARGET}"
  else
    log_info "Catch-all disabled for ${DOMAIN}"
  fi

  postmap "$VIRTUAL_FILE" 2>/dev/null || true
  systemctl reload postfix 2>/dev/null || true
  echo "ok"
else
  # Dev mode — JSON state
  STATE_FILE="$STATE_DIR/domains/${DOMAIN}.catchall.json"
  if [[ "$TARGET" == "disable" ]]; then
    rm -f "$STATE_FILE" 2>/dev/null || true
    log_info "[dev] Catch-all disabled for ${DOMAIN}"
  else
    cat > "$STATE_FILE" << EOF
{"domain":"${DOMAIN}","target":"${TARGET}","updatedAt":"$(date -u +%Y-%m-%dT%H:%M:%SZ)"}
EOF
    log_info "[dev] Catch-all enabled for ${DOMAIN} → ${TARGET}"
  fi
  echo "ok"
fi
