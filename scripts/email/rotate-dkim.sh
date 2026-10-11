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

KEY_DIR="/etc/opendkim/keys/${DOMAIN}"
PUB_EXPORT_DIR="/etc/clearpanel/mail/dkim/public/${DOMAIN}"

rm -f "${KEY_DIR}/${SELECTOR}.private" "${KEY_DIR}/${SELECTOR}.txt" "${PUB_EXPORT_DIR}/${SELECTOR}.txt" 2>/dev/null || true

generate_dkim_key "$DOMAIN" "$SELECTOR" >/dev/null

RECORD_FILE="${PUB_EXPORT_DIR}/${SELECTOR}.txt"
if [[ -f "$RECORD_FILE" ]]; then
  RECORD="$(cat "$RECORD_FILE")"
  printf 'Rotated DKIM selector %s for %s\n' "$SELECTOR" "$DOMAIN"
  printf '%s\n' "$RECORD"
  exit 0
fi

echo "Failed to rotate DKIM for ${DOMAIN} selector ${SELECTOR}" >&2
exit 1
