#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 3 ]]; then
  echo "Usage: $0 <domain> <source> <destination>" >&2
  exit 1
fi

DOMAIN="${1,,}"
SOURCE="$2"
DESTINATION="$3"

SCRIPT_SOURCE="${BASH_SOURCE[0]}"
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_SOURCE")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

ensure_state_root

# Normalize source to full address if needed
if [[ "$SOURCE" != *"@"* ]]; then
  SOURCE_FULL="${SOURCE}@${DOMAIN}"
else
  SOURCE_FULL="$SOURCE"
fi

# --- State tracking (both modes) ---
ALIAS_DIR="$ALIASES_DIR/$DOMAIN"
mkdir -p "$ALIAS_DIR"
printf '%s\n' "$DESTINATION" >"$ALIAS_DIR/${SOURCE}.txt"

if [[ "$MAIL_MODE" == "production" ]]; then
  # --- Add to Postfix virtual alias map ---
  # Remove existing entry for this source, then append
  sed -i "/^${SOURCE_FULL}\s/d" "$POSTFIX_VALIAS" 2>/dev/null || true
  printf '%s\t%s\n' "$SOURCE_FULL" "$DESTINATION" >>"$POSTFIX_VALIAS"
  postmap_rebuild "$POSTFIX_VALIAS"
  postfix_reload
  printf 'Alias %s → %s added to Postfix virtual alias map\n' "$SOURCE_FULL" "$DESTINATION"
else
  printf 'Alias %s@%s → %s stored in simulated state\n' "$SOURCE" "$DOMAIN" "$DESTINATION"
fi
