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

RECORD="$(read_dkim_record "$DOMAIN" "$SELECTOR" || true)"

if [[ -z "$RECORD" ]]; then
  echo "No DKIM record found for ${DOMAIN} selector ${SELECTOR}" >&2
  exit 1
fi

printf '%s\n' "$RECORD"
