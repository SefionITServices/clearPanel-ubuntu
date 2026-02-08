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

PUBLIC_KEY="$(generate_dkim_key_material)"
DKIM_RECORD="$(write_dkim_record "$DOMAIN" "$SELECTOR" "$PUBLIC_KEY")"

printf 'Rotated DKIM selector %s for %s\n' "$SELECTOR" "$DOMAIN"
printf '%s\n' "$DKIM_RECORD"
