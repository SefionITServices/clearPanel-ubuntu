#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 3 ]]; then
  echo "Usage: $0 <domain> <mailbox|mailbox@domain> <passwordHash> [quotaMb]" >&2
  exit 1
fi

DOMAIN="${1,,}"
MAILBOX_RAW="$2"
PASSWORD_HASH="$3"
QUOTA="${4:-}"

SCRIPT_SOURCE="${BASH_SOURCE[0]}"
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_SOURCE")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

ensure_state_root

LOCAL_PART="$(normalize_mailbox_local_part "$MAILBOX_RAW" "$DOMAIN")"
MAILBOX="${LOCAL_PART}@${DOMAIN}"

# --- State tracking (both modes) ---
MAILBOX_STATE="$MAILBOX_DIR/$DOMAIN/$LOCAL_PART"
mkdir -p "$MAILBOX_STATE"

TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

cat >"$MAILBOX_STATE/mailbox.json" <<JSON
{
  "email": "$MAILBOX",
  "passwordHash": "$PASSWORD_HASH",
  "quotaMb": "${QUOTA}",
  "updatedAt": "$TIMESTAMP"
}
JSON

if [[ "$MAIL_MODE" == "production" ]]; then
  # --- Create real Maildir under /var/vmail ---
  MAILDIR="$VMAIL_HOME/$DOMAIN/$LOCAL_PART/Maildir"
  mkdir -p "$MAILDIR/cur" "$MAILDIR/new" "$MAILDIR/tmp"
  chown -R "${VMAIL_USER}:${VMAIL_GROUP}" "$VMAIL_HOME/$DOMAIN/$LOCAL_PART"
  printf 'Created Maildir at %s\n' "$MAILDIR"

  # --- Add to Postfix virtual mailbox map ---
  local_entry="${MAILBOX}\t${DOMAIN}/${LOCAL_PART}/Maildir/"
  # Remove existing entry if any, then append
  sed -i "/^${MAILBOX}\s/d" "$POSTFIX_VMAILBOX" 2>/dev/null || true
  printf '%s\t%s/%s/Maildir/\n' "$MAILBOX" "$DOMAIN" "$LOCAL_PART" >>"$POSTFIX_VMAILBOX"
  postmap_rebuild "$POSTFIX_VMAILBOX"
  printf 'Added %s to Postfix virtual mailbox map\n' "$MAILBOX"

  # --- Add to Dovecot passwd-file ---
  # Format: user:{scheme}password:uid:gid::home::userdb_quota_rule=*:bytes=XM
  QUOTA_RULE=""
  if [[ -n "$QUOTA" && "$QUOTA" != "0" && "$QUOTA" != "null" ]]; then
    QUOTA_RULE="userdb_quota_rule=*:bytes=${QUOTA}M"
  fi
  USER_HOME="$VMAIL_HOME/$DOMAIN/$LOCAL_PART"
  PASSWD_LINE="${MAILBOX}:${PASSWORD_HASH}:${VMAIL_UID}:${VMAIL_GID}::${USER_HOME}::${QUOTA_RULE}"

  # Remove existing line for this user, then append
  sed -i "/^${MAILBOX}:/d" "$DOVECOT_PASSWD" 2>/dev/null || true
  printf '%s\n' "$PASSWD_LINE" >>"$DOVECOT_PASSWD"
  chmod 640 "$DOVECOT_PASSWD"
  chown root:dovecot "$DOVECOT_PASSWD" 2>/dev/null || true
  printf 'Added %s to Dovecot passwd-file\n' "$MAILBOX"

  postfix_reload
  dovecot_reload
else
  # --- Dev mode: simulated Maildir ---
  MAILDIR="$MAILBOX_STATE/Maildir"
  mkdir -p "$MAILDIR/cur" "$MAILDIR/new" "$MAILDIR/tmp"
fi

printf 'Mailbox %s provisioned\n' "$MAILBOX"
