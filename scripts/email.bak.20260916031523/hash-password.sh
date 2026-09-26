#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <password>" >&2
  exit 1
fi

PASSWORD="$1"

if command -v doveadm >/dev/null 2>&1; then
  OUTPUT="$(doveadm pw -s SHA512-CRYPT -p "$PASSWORD" 2>/dev/null || true)"
  HASH="$(printf '%s\n' "$OUTPUT" | tail -n 1 | sed 's/^crypt://')"
  if [[ -n "$HASH" && "$HASH" == \$6\$* ]]; then
    printf '%s\n' "$HASH"
    exit 0
  fi
fi

if command -v openssl >/dev/null 2>&1; then
  HASH="$(openssl passwd -6 "$PASSWORD" 2>/dev/null || true)"
  if [[ -n "$HASH" && "$HASH" == \$6\$* ]]; then
    printf '%s\n' "$HASH"
    exit 0
  fi
fi

echo "Unable to generate password hash. Please install dovecot (doveadm) or OpenSSL." >&2
exit 1
