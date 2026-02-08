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

rm -f "$ALIASES_DIR/$DOMAIN/${SOURCE}.txt" || true

printf 'Alias %s@%s removed from simulated state\n' "$SOURCE" "$DOMAIN"
