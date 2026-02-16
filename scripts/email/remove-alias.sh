#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <domain> <source>" >&2
  exit 1
fi

DOMAIN="${1,,}"
SOURCE="$2"

SCRIPT_SOURCE="${BASH_SOURCE[0]}"
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_SOURCE")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

ensure_state_root

# Normalize source to full address
if [[ "$SOURCE" != *"@"* ]]; then
  SOURCE_FULL="${SOURCE}@${DOMAIN}"
else
  SOURCE_FULL="$SOURCE"
fi

if [[ "$MAIL_MODE" == "production" ]]; then
  # --- Remove from Postfix virtual alias map ---
  remove_map_entry_by_key "$SOURCE_FULL" "$POSTFIX_VALIAS"
  postmap_rebuild "$POSTFIX_VALIAS"
  postfix_reload
  printf 'Removed alias %s from Postfix virtual alias map\n' "$SOURCE_FULL"
fi

# --- Clean up state ---
rm -f "$ALIASES_DIR/$DOMAIN/${SOURCE}.txt" || true

printf 'Alias %s removed\n' "$SOURCE_FULL"
