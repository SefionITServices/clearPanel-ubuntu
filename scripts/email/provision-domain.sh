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

# --- State tracking (both modes) ---
DOMAIN_DIR="$DOMAINS_DIR/$DOMAIN"
mkdir -p "$DOMAIN_DIR"

METADATA_FILE="$DOMAIN_DIR/domain.json"
TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

cat >"$METADATA_FILE" <<JSON
{
  "domain": "$DOMAIN",
  "provisionedAt": "$TIMESTAMP"
}
JSON

if [[ "$MAIL_MODE" == "production" ]]; then
  # --- Add to Postfix virtual domains ---
  if ! grep -q "^${DOMAIN}\s" "$POSTFIX_VDOMAINS" 2>/dev/null; then
    printf '%s\tOK\n' "$DOMAIN" >>"$POSTFIX_VDOMAINS"
    postmap_rebuild "$POSTFIX_VDOMAINS"
    printf 'Added %s to Postfix virtual domains\n' "$DOMAIN"
  else
    printf 'Domain %s already in Postfix virtual domains\n' "$DOMAIN"
  fi

  # --- Create vmail domain directory ---
  DOMAIN_VMAIL="$VMAIL_HOME/$DOMAIN"
  mkdir -p "$DOMAIN_VMAIL"
  chown "${VMAIL_USER}:${VMAIL_GROUP}" "$DOMAIN_VMAIL"
  printf 'Created vmail directory %s\n' "$DOMAIN_VMAIL"

  # --- Dovecot sieve before directory ---
  mkdir -p /etc/dovecot/sieve-before.d 2>/dev/null || true

  postfix_reload
fi

# --- DKIM key generation ---
SELECTOR="default"
EXISTING_RECORD="$(read_dkim_record "$DOMAIN" "$SELECTOR" || true)"
if [[ -z "$EXISTING_RECORD" ]]; then
  PUBLIC_KEY="$(generate_dkim_key_material "$DOMAIN" "$SELECTOR")"
  DKIM_RECORD="$(write_dkim_record "$DOMAIN" "$SELECTOR" "$PUBLIC_KEY")"
  printf 'Generated DKIM selector %s for %s\n' "$SELECTOR" "$DOMAIN"
  printf '%s\n' "$DKIM_RECORD"
else
  printf 'DKIM selector %s already exists for %s\n' "$SELECTOR" "$DOMAIN"
  printf '%s\n' "$EXISTING_RECORD"
fi

printf 'Mail domain %s provisioned\n' "$DOMAIN"
