#!/usr/bin/env bash

# shellcheck disable=SC2034
if [[ -n "${MAIL_AUTOMATION_COMMON_SOURCED:-}" ]]; then
  return 0
fi
MAIL_AUTOMATION_COMMON_SOURCED=1

SCRIPT_PATH="$(realpath "${BASH_SOURCE[0]}")"
SCRIPT_DIR="$(dirname "$SCRIPT_PATH")"
REPO_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
STATE_ROOT="${MAIL_STATE_DIR:-$REPO_ROOT/backend/mail-state}"
DOMAINS_DIR="$STATE_ROOT/domains"
MAILBOX_DIR="$STATE_ROOT/mailboxes"
ALIASES_DIR="$STATE_ROOT/aliases"
DKIM_KEYS_DIR="$STATE_ROOT/dkim/keys"
DKIM_PUBLIC_DIR="$STATE_ROOT/dkim/public"
LOG_DIR="$STATE_ROOT/logs"
POLICY_DIR="$STATE_ROOT/policies"

ensure_state_root() {
  mkdir -p "$STATE_ROOT" "$DOMAINS_DIR" "$MAILBOX_DIR" "$ALIASES_DIR" \
    "$DKIM_KEYS_DIR" "$DKIM_PUBLIC_DIR" "$LOG_DIR" "$POLICY_DIR"
}

generate_dkim_key_material() {
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
