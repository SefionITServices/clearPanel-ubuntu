#!/usr/bin/env bash
# manage-sieve.sh — Manage Dovecot Sieve filters for a mailbox
# Usage: manage-sieve.sh <action> <email> [args...]
#   Actions:
#     get    <email>             — print the active sieve script
#     put    <email> <script>    — upload and activate a sieve script
#     delete <email>             — remove the active sieve script
#     list   <email>             — list all sieve scripts
#
# Dual-mode: honours MAIL_MODE=dev (state files) vs production (real filesystem)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

ACTION="${1:?Usage: manage-sieve.sh <get|put|delete|list> <email> [args...]}"
EMAIL="${2:?Email address required}"
SCRIPT_CONTENT="${3:-}"

DOMAIN="${EMAIL#*@}"
USER="${EMAIL%%@*}"
STATE_DIR="${MAIL_STATE_DIR:-$SCRIPT_DIR/../../backend/mail-state}"
SIEVE_STATE_DIR="$STATE_DIR/sieve"
mkdir -p "$SIEVE_STATE_DIR"

if [[ "$MAIL_MODE" == "production" ]]; then
  VMAIL_HOME="/var/vmail/${DOMAIN}/${USER}"
  SIEVE_DIR="${VMAIL_HOME}/sieve"
  ACTIVE_SCRIPT="${VMAIL_HOME}/.dovecot.sieve"
  COMPILED="${VMAIL_HOME}/.dovecot.svbin"

  case "$ACTION" in
    get)
      if [[ -f "$ACTIVE_SCRIPT" ]]; then
        cat "$ACTIVE_SCRIPT"
      else
        echo ""
      fi
      ;;
    put)
      mkdir -p "$SIEVE_DIR"
      echo "$SCRIPT_CONTENT" > "$SIEVE_DIR/default.sieve"
      ln -sf "$SIEVE_DIR/default.sieve" "$ACTIVE_SCRIPT"
      # Compile the sieve script
      sievec "$ACTIVE_SCRIPT" 2>/dev/null || true
      chown -R vmail:vmail "$SIEVE_DIR" "$ACTIVE_SCRIPT" 2>/dev/null || true
      if [[ -f "$COMPILED" ]]; then
        chown vmail:vmail "$COMPILED" 2>/dev/null || true
      fi
      log_info "Sieve script installed for ${EMAIL}"
      echo "ok"
      ;;
    delete)
      rm -f "$ACTIVE_SCRIPT" "$COMPILED" 2>/dev/null || true
      rm -f "$SIEVE_DIR/default.sieve" 2>/dev/null || true
      log_info "Sieve script removed for ${EMAIL}"
      echo "ok"
      ;;
    list)
      if [[ -d "$SIEVE_DIR" ]]; then
        ls -1 "$SIEVE_DIR"/*.sieve 2>/dev/null | xargs -I{} basename {} || echo ""
      else
        echo ""
      fi
      ;;
    *)
      echo "Unknown action: $ACTION" >&2
      exit 1
      ;;
  esac
else
  # Dev mode — JSON state
  STATE_FILE="$SIEVE_STATE_DIR/${DOMAIN}_${USER}.json"

  case "$ACTION" in
    get)
      if [[ -f "$STATE_FILE" ]]; then
        if command -v jq &>/dev/null; then
          jq -r '.script // ""' "$STATE_FILE"
        else
          cat "$STATE_FILE"
        fi
      else
        echo ""
      fi
      ;;
    put)
      if command -v jq &>/dev/null; then
        echo "{}" | jq --arg email "$EMAIL" --arg script "$SCRIPT_CONTENT" \
          --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
          '{email: $email, script: $script, updatedAt: $ts}' > "$STATE_FILE"
      else
        cat > "$STATE_FILE" << EOF
{"email":"${EMAIL}","script":"$(echo "$SCRIPT_CONTENT" | sed 's/"/\\"/g')","updatedAt":"$(date -u +%Y-%m-%dT%H:%M:%SZ)"}
EOF
      fi
      log_info "[dev] Sieve script stored for ${EMAIL}"
      echo "ok"
      ;;
    delete)
      rm -f "$STATE_FILE" 2>/dev/null || true
      log_info "[dev] Sieve script removed for ${EMAIL}"
      echo "ok"
      ;;
    list)
      if [[ -f "$STATE_FILE" ]]; then
        echo "default.sieve"
      else
        echo ""
      fi
      ;;
    *)
      echo "Unknown action: $ACTION" >&2
      exit 1
      ;;
  esac
fi
