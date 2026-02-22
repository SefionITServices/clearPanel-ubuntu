#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
#  ClearPanel — Generate Release Signing Keys
# ─────────────────────────────────────────────────────────────────────
#  Run ONCE on your development machine to create a key pair.
#
#  Private key: release/clearpanel-release.key  (KEEP SECRET — never commit)
#  Public key:  release/clearpanel-release.pub  (ship with the panel)
# ─────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PRIVATE_KEY="$SCRIPT_DIR/clearpanel-release.key"
PUBLIC_KEY="$SCRIPT_DIR/clearpanel-release.pub"

if [ -f "$PRIVATE_KEY" ]; then
    echo "Private key already exists: $PRIVATE_KEY"
    echo "Delete it first if you want to regenerate."
    exit 1
fi

echo "Generating RSA-4096 signing key pair..."
openssl genrsa -out "$PRIVATE_KEY" 4096
openssl rsa -in "$PRIVATE_KEY" -pubout -out "$PUBLIC_KEY"

chmod 600 "$PRIVATE_KEY"
chmod 644 "$PUBLIC_KEY"

echo ""
echo "✓ Key pair generated:"
echo "  Private: $PRIVATE_KEY  (KEEP SECRET — add to .gitignore)"
echo "  Public:  $PUBLIC_KEY   (ships with the panel for signature verification)"
echo ""
echo "IMPORTANT: Add 'release/clearpanel-release.key' to .gitignore!"
