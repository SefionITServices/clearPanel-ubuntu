#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <domain>" >&2
  exit 1
fi

DOMAIN="${1,,}"
SCRIPT_SOURCE="${BASH_SOURCE[0]}"
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_SOURCE")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

ensure_state_root

shopt -s dotglob
rm -rf "$DOMAINS_DIR/$DOMAIN" || true
rm -rf "$MAILBOX_DIR/$DOMAIN" || true
rm -rf "$ALIASES_DIR/$DOMAIN" || true
rm -rf "$DKIM_KEYS_DIR/$DOMAIN" || true
rm -rf "$DKIM_PUBLIC_DIR/$DOMAIN" || true
shopt -u dotglob

printf 'Mail domain %s removed from simulated state\n' "$DOMAIN"
