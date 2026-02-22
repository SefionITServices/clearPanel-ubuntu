#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
#  ClearPanel — Verify Release Signature
# ─────────────────────────────────────────────────────────────────────
#  Usage:  bash release/verify.sh <tarball>
# ─────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARCHIVE="${1:-}"

if [ -z "$ARCHIVE" ]; then
    echo "Usage: bash release/verify.sh <clearpanel-X.Y.Z.tar.gz>"
    exit 1
fi

PUBLIC_KEY="$SCRIPT_DIR/clearpanel-release.pub"

if [ ! -f "$PUBLIC_KEY" ]; then
    echo "Public key not found: $PUBLIC_KEY"
    exit 1
fi

if [ ! -f "${ARCHIVE}.sig" ]; then
    echo "Signature file not found: ${ARCHIVE}.sig"
    exit 1
fi

if openssl dgst -sha256 -verify "$PUBLIC_KEY" -signature "${ARCHIVE}.sig" "$ARCHIVE"; then
    echo "✓ Signature valid — release is authentic"
else
    echo "✗ Signature INVALID — this release may have been tampered with!"
    exit 1
fi
