#!/usr/bin/env bash
set -euo pipefail

SCRIPT_SOURCE="${BASH_SOURCE[0]}"
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_SOURCE")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

ensure_state_root

STACK_FILE="$STATE_ROOT/stack.json"
TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

cat >"$STACK_FILE" <<JSON
{
  "installedAt": "$TIMESTAMP",
  "hostname": "${MAIL_HOSTNAME:-$(hostname)}",
  "notes": "Simulated mail stack for local development"
}
JSON

printf 'Mail stack prepared at %s\n' "$STATE_ROOT"
printf 'Configuration stub written to %s\n' "$STACK_FILE"
