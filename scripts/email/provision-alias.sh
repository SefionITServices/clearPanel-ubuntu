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

ALIAS_DIR="$ALIASES_DIR/$DOMAIN"
mkdir -p "$ALIAS_DIR"

printf '%s\n' "$DESTINATION" >"$ALIAS_DIR/${SOURCE}.txt"

printf 'Alias %s@%s → %s stored in simulated state\n' "$SOURCE" "$DOMAIN" "$DESTINATION"
