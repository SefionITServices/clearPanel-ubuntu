#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <domain>" >&2
  exit 1
fi

DOMAIN="${1,,}"
SCRIPT_SOURCE="${BASH_SOURCE[0]}"
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_SOURCE")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

ensure_state_root

if [[ "$MAIL_MODE" == "production" ]]; then
  # --- Remove from Postfix virtual domains ---
  remove_map_entry_by_key "$DOMAIN" "$POSTFIX_VDOMAINS"
  postmap_rebuild "$POSTFIX_VDOMAINS"
  printf 'Removed %s from Postfix virtual domains\n' "$DOMAIN"

  # --- Remove all mailboxes for this domain from Postfix vmailbox ---
  remove_map_entries_by_key_suffix "@${DOMAIN}" "$POSTFIX_VMAILBOX"
  postmap_rebuild "$POSTFIX_VMAILBOX"
  printf 'Removed all mailbox entries for %s from Postfix\n' "$DOMAIN"

  # --- Remove all aliases for this domain from Postfix virtual alias ---
  remove_map_entries_by_key_suffix "@${DOMAIN}" "$POSTFIX_VALIAS"
  postmap_rebuild "$POSTFIX_VALIAS"
  printf 'Removed all alias entries for %s from Postfix\n' "$DOMAIN"

  # --- Remove from Dovecot passwd-file ---
  remove_passwd_entries_by_domain "$DOMAIN" "$DOVECOT_PASSWD"
  printf 'Removed all Dovecot users for %s\n' "$DOMAIN"

  # --- Remove OpenDKIM entries ---
  remove_map_entries_by_key_suffix "._domainkey.${DOMAIN}" "$OPENDKIM_KEY_TABLE"
  remove_map_entry_by_key "*@${DOMAIN}" "$OPENDKIM_SIGNING_TABLE"
  rm -rf "$OPENDKIM_KEYS_DIR/$DOMAIN" 2>/dev/null || true
  systemctl reload opendkim 2>/dev/null || true
  printf 'Removed DKIM keys and tables for %s\n' "$DOMAIN"

  # --- Remove vmail directory (optional: keep for backup, uncomment to delete) ---
  # rm -rf "$VMAIL_HOME/$DOMAIN"
  # Move to a backup location instead
  if [[ -d "$VMAIL_HOME/$DOMAIN" ]]; then
    BACKUP_DIR="$VMAIL_HOME/.removed/$(date +%Y%m%d%H%M%S)-${DOMAIN}"
    mkdir -p "$VMAIL_HOME/.removed"
    mv "$VMAIL_HOME/$DOMAIN" "$BACKUP_DIR" 2>/dev/null || true
    printf 'Mail data backed up to %s\n' "$BACKUP_DIR"
  fi

  postfix_reload
  dovecot_reload
fi

# --- Clean up state directories (both modes) ---
shopt -s dotglob
rm -rf "$DOMAINS_DIR/$DOMAIN" || true
rm -rf "$MAILBOX_DIR/$DOMAIN" || true
rm -rf "$ALIASES_DIR/$DOMAIN" || true
rm -rf "$DKIM_KEYS_DIR/$DOMAIN" || true
rm -rf "$DKIM_PUBLIC_DIR/$DOMAIN" || true
rm -rf "$POLICY_DIR/${DOMAIN}.json" || true
shopt -u dotglob

printf 'Mail domain %s removed\n' "$DOMAIN"
