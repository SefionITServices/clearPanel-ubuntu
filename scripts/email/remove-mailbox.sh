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
MAILBOX_ROOT="$MAILBOX_DIR/$DOMAIN/$LOCAL_PART"

rm -rf "$MAILBOX_ROOT" || true

printf 'Mailbox %s@%s removed from simulated state\n' "$LOCAL_PART" "$DOMAIN"
