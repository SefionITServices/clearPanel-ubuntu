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

TARGET_DIR="${EMAIL_POLICY_DIR:-$POLICY_DIR}"
mkdir -p "$TARGET_DIR"

OUTPUT_FILE="$TARGET_DIR/${DOMAIN}.json"

printf '%s\n' "$SETTINGS_JSON" >"$OUTPUT_FILE"

chmod 640 "$OUTPUT_FILE" || true

cat <<INFO
Policy written to $OUTPUT_FILE
INFO
