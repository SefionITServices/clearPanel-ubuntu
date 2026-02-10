#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <domain> <mailbox|mailbox@domain>" >&2
  exit 1
fi

DOMAIN="${1,,}"
MAILBOX_RAW="$2"

SCRIPT_SOURCE="${BASH_SOURCE[0]}"
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_SOURCE")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

ensure_state_root

LOCAL_PART="$(normalize_mailbox_local_part "$MAILBOX_RAW" "$DOMAIN")"
MAILBOX="${LOCAL_PART}@${DOMAIN}"

if [[ "$MAIL_MODE" == "production" ]]; then
  # --- Remove from Postfix virtual mailbox map ---
  sed -i "/^${MAILBOX}\s/d" "$POSTFIX_VMAILBOX" 2>/dev/null || true
  postmap_rebuild "$POSTFIX_VMAILBOX"
  printf 'Removed %s from Postfix virtual mailbox map\n' "$MAILBOX"

  # --- Remove from Dovecot passwd-file ---
  sed -i "/^${MAILBOX}:/d" "$DOVECOT_PASSWD" 2>/dev/null || true
  printf 'Removed %s from Dovecot passwd-file\n' "$MAILBOX"

  # --- Move Maildir to backup (don't delete to preserve mail) ---
  USER_VMAIL="$VMAIL_HOME/$DOMAIN/$LOCAL_PART"
  if [[ -d "$USER_VMAIL" ]]; then
    BACKUP_DIR="$VMAIL_HOME/.removed/$(date +%Y%m%d%H%M%S)-${LOCAL_PART}@${DOMAIN}"
    mkdir -p "$VMAIL_HOME/.removed"
    mv "$USER_VMAIL" "$BACKUP_DIR" 2>/dev/null || true
    printf 'Mailbox data backed up to %s\n' "$BACKUP_DIR"
  fi

  postfix_reload
  dovecot_reload
fi

# --- Clean up state ---
MAILBOX_STATE="$MAILBOX_DIR/$DOMAIN/$LOCAL_PART"
rm -rf "$MAILBOX_STATE" || true

printf 'Mailbox %s removed\n' "$MAILBOX"
