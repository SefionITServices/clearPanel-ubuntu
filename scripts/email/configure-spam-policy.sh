#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -lt 2 ]]; then
  echo "Usage: $0 <domain> '<json-settings>'" >&2
  exit 1
fi

DOMAIN="$1"
SETTINGS_JSON="$2"

SCRIPT_SOURCE="${BASH_SOURCE[0]}"
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_SOURCE")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

ensure_state_root

# --- Write JSON state (both modes) ---
TARGET_DIR="${EMAIL_POLICY_DIR:-$POLICY_DIR}"
mkdir -p "$TARGET_DIR"

OUTPUT_FILE="$TARGET_DIR/${DOMAIN}.json"
printf '%s\n' "$SETTINGS_JSON" >"$OUTPUT_FILE"
chmod 640 "$OUTPUT_FILE" || true

if [[ "$MAIL_MODE" == "production" ]]; then
  # --- Write Rspamd per-domain overrides ---
  RSPAMD_DOMAIN_DIR="$RSPAMD_LOCAL_DIR/maps.d"
  mkdir -p "$RSPAMD_DOMAIN_DIR"

  # Extract settings from JSON
  SPAM_THRESHOLD="$(echo "$SETTINGS_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('spamThreshold',''))" 2>/dev/null || true)"
  GREYLISTING="$(echo "$SETTINGS_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(str(d.get('greylistingEnabled','')).lower())" 2>/dev/null || true)"
  GREYLIST_DELAY="$(echo "$SETTINGS_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('greylistingDelaySeconds',''))" 2>/dev/null || true)"
  VIRUS_SCAN="$(echo "$SETTINGS_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(str(d.get('virusScanEnabled','')).lower())" 2>/dev/null || true)"

  # Create per-domain Rspamd actions override
  if [[ -n "$SPAM_THRESHOLD" && "$SPAM_THRESHOLD" != "None" ]]; then
    cat >"$RSPAMD_LOCAL_DIR/actions-${DOMAIN}.conf" <<RSPAMD_ACTIONS
# Per-domain spam actions for ${DOMAIN}
reject = ${SPAM_THRESHOLD};
add_header = $(echo "$SPAM_THRESHOLD" | awk '{printf "%.1f", $1 * 0.8}');
greylist = $(echo "$SPAM_THRESHOLD" | awk '{printf "%.1f", $1 * 0.5}');
RSPAMD_ACTIONS
    printf 'Rspamd spam threshold set to %s for %s\n' "$SPAM_THRESHOLD" "$DOMAIN"
  fi

  # Greylisting configuration
  if [[ "$GREYLISTING" == "false" ]]; then
    cat >"$RSPAMD_LOCAL_DIR/greylist-${DOMAIN}.conf" <<RSPAMD_GREY
# Greylisting disabled for ${DOMAIN}
enabled = false;
RSPAMD_GREY
    printf 'Greylisting disabled for %s\n' "$DOMAIN"
  elif [[ -n "$GREYLIST_DELAY" && "$GREYLIST_DELAY" != "None" ]]; then
    cat >"$RSPAMD_LOCAL_DIR/greylist-${DOMAIN}.conf" <<RSPAMD_GREY
# Greylisting for ${DOMAIN}
enabled = true;
timeout = ${GREYLIST_DELAY}s;
RSPAMD_GREY
    printf 'Greylisting delay set to %ss for %s\n' "$GREYLIST_DELAY" "$DOMAIN"
  fi

  rspamd_reload
fi

printf 'Policy written to %s\n' "$OUTPUT_FILE"
