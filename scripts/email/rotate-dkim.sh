#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <domain> <selector>" >&2
  exit 1
fi

DOMAIN="${1,,}"
SELECTOR="$2"

SCRIPT_SOURCE="${BASH_SOURCE[0]}"
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_SOURCE")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

ensure_state_root

# Remove old key files for this selector
rm -f "$DKIM_KEYS_DIR/$DOMAIN/${SELECTOR}.pub" 2>/dev/null || true
rm -f "$DKIM_KEYS_DIR/$DOMAIN/${SELECTOR}.private" 2>/dev/null || true
rm -f "$DKIM_KEYS_DIR/$DOMAIN/${SELECTOR}.txt" 2>/dev/null || true
rm -f "$DKIM_PUBLIC_DIR/$DOMAIN/${SELECTOR}.txt" 2>/dev/null || true

# Generate new key
PUBLIC_KEY="$(generate_dkim_key_material "$DOMAIN" "$SELECTOR")"
DKIM_RECORD="$(write_dkim_record "$DOMAIN" "$SELECTOR" "$PUBLIC_KEY")"

printf 'Rotated DKIM selector %s for %s\n' "$SELECTOR" "$DOMAIN"
printf '%s\n' "$DKIM_RECORD"
