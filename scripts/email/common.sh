#!/usr/bin/env bash

# shellcheck disable=SC2034
if [[ -n "${MAIL_AUTOMATION_COMMON_SOURCED:-}" ]]; then
  return 0
fi
MAIL_AUTOMATION_COMMON_SOURCED=1

SCRIPT_PATH="$(realpath "${BASH_SOURCE[0]}")"
SCRIPT_DIR="$(dirname "$SCRIPT_PATH")"
REPO_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

# --- Mode detection ---
# Set MAIL_MODE=production to use real paths; defaults to "dev" for local development.
MAIL_MODE="${MAIL_MODE:-dev}"

if [[ "$MAIL_MODE" == "production" ]]; then
  # Production paths
  MAIL_CONFIG_DIR="/etc/clearpanel/mail"
  VMAIL_HOME="/var/vmail"
  VMAIL_USER="vmail"
  VMAIL_GROUP="vmail"
  VMAIL_UID="${VMAIL_UID:-5000}"
  VMAIL_GID="${VMAIL_GID:-5000}"
  STATE_ROOT="${MAIL_STATE_DIR:-/var/lib/clearpanel/mail}"
  POSTFIX_VDOMAINS="$MAIL_CONFIG_DIR/vdomains"
  POSTFIX_VMAILBOX="$MAIL_CONFIG_DIR/vmailbox"
  POSTFIX_VALIAS="$MAIL_CONFIG_DIR/valias"
  DOVECOT_PASSWD="$MAIL_CONFIG_DIR/passwd"
  RSPAMD_LOCAL_DIR="/etc/rspamd/local.d"
  RSPAMD_OVERRIDE_DIR="/etc/rspamd/override.d"
  OPENDKIM_KEYS_DIR="/etc/opendkim/keys"
  OPENDKIM_KEY_TABLE="/etc/opendkim/key.table"
  OPENDKIM_SIGNING_TABLE="/etc/opendkim/signing.table"
else
  # Development simulation (original behaviour)
  STATE_ROOT="${MAIL_STATE_DIR:-$REPO_ROOT/backend/mail-state}"
fi

DOMAINS_DIR="$STATE_ROOT/domains"
MAILBOX_DIR="$STATE_ROOT/mailboxes"
ALIASES_DIR="$STATE_ROOT/aliases"
if [[ "$MAIL_MODE" == "production" ]]; then
  DKIM_KEYS_DIR="$OPENDKIM_KEYS_DIR"
  DKIM_PUBLIC_DIR="$MAIL_CONFIG_DIR/dkim/public"
else
  DKIM_KEYS_DIR="$STATE_ROOT/dkim/keys"
  DKIM_PUBLIC_DIR="$STATE_ROOT/dkim/public"
fi
LOG_DIR="$STATE_ROOT/logs"
POLICY_DIR="$STATE_ROOT/policies"

ensure_state_root() {
  mkdir -p "$STATE_ROOT" "$DOMAINS_DIR" "$MAILBOX_DIR" "$ALIASES_DIR" \
    "$DKIM_KEYS_DIR" "$DKIM_PUBLIC_DIR" "$LOG_DIR" "$POLICY_DIR"

  if [[ "$MAIL_MODE" == "production" ]]; then
    mkdir -p "$MAIL_CONFIG_DIR" "$VMAIL_HOME"
    # Ensure vmail user exists
    if ! id "$VMAIL_USER" &>/dev/null; then
      groupadd -g "$VMAIL_GID" "$VMAIL_GROUP" 2>/dev/null || true
      useradd -u "$VMAIL_UID" -g "$VMAIL_GID" -d "$VMAIL_HOME" -s /usr/sbin/nologin "$VMAIL_USER" 2>/dev/null || true
    fi
    chown -R "${VMAIL_USER}:${VMAIL_GROUP}" "$VMAIL_HOME" 2>/dev/null || true
    # Ensure Postfix map files exist
    touch "$POSTFIX_VDOMAINS" "$POSTFIX_VMAILBOX" "$POSTFIX_VALIAS" "$DOVECOT_PASSWD" 2>/dev/null || true
  fi
}

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

# --- Postfix map helpers ---
postmap_rebuild() {
  local mapfile="$1"
  if [[ "$MAIL_MODE" == "production" ]] && command -v postmap >/dev/null 2>&1; then
    postmap "$mapfile" 2>/dev/null || true
  fi
}

postfix_reload() {
  if [[ "$MAIL_MODE" == "production" ]] && command -v postfix >/dev/null 2>&1; then
    postfix reload 2>/dev/null || true
  fi
}

dovecot_reload() {
  if [[ "$MAIL_MODE" == "production" ]] && command -v doveadm >/dev/null 2>&1; then
    doveadm reload 2>/dev/null || true
  fi
}

rspamd_reload() {
  if [[ "$MAIL_MODE" == "production" ]] && command -v rspamadm >/dev/null 2>&1; then
    systemctl reload rspamd 2>/dev/null || true
  fi
}

generate_dkim_key_material() {
  local domain="${1:-}"
  local selector="${2:-default}"

  # Production: use opendkim-genkey for a real RSA key pair
  if [[ "$MAIL_MODE" == "production" ]] && command -v opendkim-genkey >/dev/null 2>&1 && [[ -n "$domain" ]]; then
    local key_dir="$DKIM_KEYS_DIR/$domain"
    mkdir -p "$key_dir"
    opendkim-genkey -b 2048 -d "$domain" -s "$selector" -D "$key_dir"
    # opendkim-genkey creates ${selector}.private and ${selector}.txt
    chown opendkim:opendkim "$key_dir/${selector}.private" 2>/dev/null || true
    chmod 600 "$key_dir/${selector}.private" 2>/dev/null || true
    # Extract the p= value from the TXT record file
    grep -oP 'p=\K[^"]+' "$key_dir/${selector}.txt" | tr -d ' \n\t'
    return 0
  fi

  # Dev fallback: generate pseudo-random base64 blob
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 64 | tr -d '\n'
    return 0
  fi

  if command -v python3 >/dev/null 2>&1; then
    python3 - <<'PY'
import base64
import os
print(base64.b64encode(os.urandom(64)).decode('ascii').replace('\n', ''))
PY
    return 0
  fi

  if command -v sha256sum >/dev/null 2>&1; then
    date -u +%s%N | sha256sum | cut -d' ' -f1
    return 0
  fi

  date -u +%s%N
}

write_dkim_record() {
  local domain="$1"
  local selector="$2"
  local public_key="$3"
  local record="v=DKIM1; k=rsa; p=${public_key}"
  local key_dir="$DKIM_KEYS_DIR/$domain"
  local public_dir="$DKIM_PUBLIC_DIR/$domain"

  mkdir -p "$key_dir" "$public_dir"

  printf '%s\n' "$public_key" >"$key_dir/${selector}.pub"
  printf '%s\n' "$record" >"$public_dir/${selector}.txt"

  # Production: update OpenDKIM tables
  if [[ "$MAIL_MODE" == "production" ]]; then
    mkdir -p "$(dirname "$OPENDKIM_KEY_TABLE")"
    # key.table: selector._domainkey.domain  domain:selector:/path/to/key
    local key_entry="${selector}._domainkey.${domain}  ${domain}:${selector}:${key_dir}/${selector}.private"
    # Remove old entry for this domain/selector, then append
    remove_map_entry_by_key "${selector}._domainkey.${domain}" "$OPENDKIM_KEY_TABLE"
    printf '%s\n' "$key_entry" >>"$OPENDKIM_KEY_TABLE"

    # signing.table: *@domain  selector._domainkey.domain
    local sign_entry="*@${domain}  ${selector}._domainkey.${domain}"
    remove_map_entry_by_key "*@${domain}" "$OPENDKIM_SIGNING_TABLE"
    printf '%s\n' "$sign_entry" >>"$OPENDKIM_SIGNING_TABLE"

    systemctl reload opendkim 2>/dev/null || true
  fi

  printf '%s\n' "$record"
}

read_dkim_record() {
  local domain="$1"
  local selector="$2"
  local record_file="$DKIM_PUBLIC_DIR/$domain/${selector}.txt"

  if [[ -f "$record_file" ]]; then
    cat "$record_file"
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
