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

MAILBOX_ROOT="$MAILBOX_DIR/$DOMAIN/$LOCAL_PART"
MAILDIR="$MAILBOX_ROOT/Maildir"

mkdir -p "$MAILDIR/cur" "$MAILDIR/new" "$MAILDIR/tmp"

TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

cat >"$MAILBOX_ROOT/mailbox.json" <<JSON
{
  "email": "$MAILBOX",
  "passwordHash": "$PASSWORD_HASH",
  "quotaMb": "${QUOTA}",
  "updatedAt": "$TIMESTAMP"
}
JSON

printf 'Mailbox %s provisioned with simulated Maildir at %s\n' "$MAILBOX" "$MAILDIR"
