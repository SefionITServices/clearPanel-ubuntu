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

RECORD_FILE="/etc/clearpanel/mail/dkim/public/${DOMAIN}/${SELECTOR}.txt"
if [[ ! -f "$RECORD_FILE" ]]; then
  generate_dkim_key "$DOMAIN" "$SELECTOR" >/dev/null 2>&1 || true
fi

if [[ -f "$RECORD_FILE" ]]; then
  RECORD="$(tr -d '\r\n' < "$RECORD_FILE" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  if [[ -n "$RECORD" && "$RECORD" =~ p=[A-Za-z0-9+/]{20,} ]]; then
    printf '%s\n' "$RECORD"
    exit 0
  fi
fi

# Fallback: parse /etc/opendkim/keys/${DOMAIN}/${SELECTOR}.txt
KEY_TXT="/etc/opendkim/keys/${DOMAIN}/${SELECTOR}.txt"
if [[ -f "$KEY_TXT" ]]; then
  DKIM_B64="$(grep -v '^;' "$KEY_TXT" | tr -d ' \t\r\n"' | grep -o 'p=[^);]*' | cut -d= -f2 || true)"
  if [[ -n "$DKIM_B64" ]]; then
    printf 'v=DKIM1; k=rsa; p=%s\n' "$DKIM_B64"
    exit 0
  fi
fi

echo "No DKIM record found for ${DOMAIN} selector ${SELECTOR}" >&2
exit 1
