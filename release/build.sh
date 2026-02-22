#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
#  ClearPanel — Release Build Script
# ─────────────────────────────────────────────────────────────────────
#  Builds a distributable release tarball WITHOUT source code.
#
#  Usage:  bash release/build.sh [version]
#  Output: release/dist/clearpanel-<version>.tar.gz
#
#  What's INCLUDED:
#    - backend/dist/         (compiled JS)
#    - backend/package.json  (for npm install --omit=dev)
#    - backend/tsconfig.json
#    - frontend/dist/        (Vite build)
#    - scripts/              (email provisioning, etc.)
#    - bin/                  (CLI wrapper)
#    - install.sh, update.sh, backup-restore.sh
#    - clearpanel.service, nginx.conf.example
#    - release/post-update.sh (if exists)
#
#  What's EXCLUDED (anti-piracy):
#    - backend/src/          (TypeScript source)
#    - frontend/src/         (React source)
#    - node_modules/         (user runs npm install)
#    - .git/
#    - .env, data/, backups/
#    - Test/, docs/, frontend-template/
# ─────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Version from argument or package.json
VERSION="${1:-$(node -e "console.log(require('$PROJECT_ROOT/backend/package.json').version)")}"
DIST_DIR="$SCRIPT_DIR/dist"
STAGE_DIR=$(mktemp -d)
ARCHIVE_NAME="clearpanel-${VERSION}.tar.gz"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'
BOLD='\033[1m'

echo -e "${BLUE}${BOLD}Building ClearPanel v${VERSION}${NC}"
echo "Stage: $STAGE_DIR"

# ── Step 1: Build backend ────────────────────────────────────────────

echo -e "${YELLOW}Building backend...${NC}"
cd "$PROJECT_ROOT/backend"
npm install
npm run build

# ── Step 2: Build frontend ───────────────────────────────────────────

echo -e "${YELLOW}Building frontend...${NC}"
cd "$PROJECT_ROOT/frontend"
npm install
npm run build

# Copy frontend build into backend/public
rm -rf "$PROJECT_ROOT/backend/public"
cp -r "$PROJECT_ROOT/frontend/dist" "$PROJECT_ROOT/backend/public"

# ── Step 3: Stage files ──────────────────────────────────────────────

echo -e "${YELLOW}Staging release files...${NC}"

DEST="$STAGE_DIR/clearpanel"
mkdir -p "$DEST"

# Backend (compiled only — no source)
mkdir -p "$DEST/backend"
cp -r "$PROJECT_ROOT/backend/dist"          "$DEST/backend/dist"
cp -r "$PROJECT_ROOT/backend/public"        "$DEST/backend/public"
cp    "$PROJECT_ROOT/backend/package.json"  "$DEST/backend/"
cp    "$PROJECT_ROOT/backend/tsconfig.json" "$DEST/backend/"

# If .env.example exists, include it
[ -f "$PROJECT_ROOT/backend/.env.example" ] && cp "$PROJECT_ROOT/backend/.env.example" "$DEST/backend/"

# Scripts
cp -r "$PROJECT_ROOT/scripts" "$DEST/scripts"

# CLI
cp -r "$PROJECT_ROOT/bin" "$DEST/bin"
chmod +x "$DEST/bin/clearpanel"

# Root scripts
for f in install.sh update.sh backup-restore.sh clearpanel.service nginx.conf.example; do
    [ -f "$PROJECT_ROOT/$f" ] && cp "$PROJECT_ROOT/$f" "$DEST/"
done

# Release helpers
mkdir -p "$DEST/release"
[ -f "$SCRIPT_DIR/post-update.sh" ] && cp "$SCRIPT_DIR/post-update.sh" "$DEST/release/"
[ -f "$SCRIPT_DIR/verify.sh" ]      && cp "$SCRIPT_DIR/verify.sh"      "$DEST/release/"

# Docs (minimal)
for f in README.md INSTALL.md DEPLOY.md; do
    [ -f "$PROJECT_ROOT/$f" ] && cp "$PROJECT_ROOT/$f" "$DEST/"
done

# Write .version file
echo "$VERSION" > "$DEST/.version"

# Write release manifest
cat > "$DEST/release/manifest.json" << EOJSON
{
  "version": "$VERSION",
  "builtAt": "$(date -Iseconds)",
  "builtBy": "$(whoami)@$(hostname)",
  "nodeVersion": "$(node --version 2>/dev/null || echo 'unknown')"
}
EOJSON

# ── Step 4: Create tarball ───────────────────────────────────────────

echo -e "${YELLOW}Creating tarball...${NC}"
mkdir -p "$DIST_DIR"
tar -czf "$DIST_DIR/$ARCHIVE_NAME" -C "$STAGE_DIR" clearpanel

# Generate SHA256 checksum
cd "$DIST_DIR"
sha256sum "$ARCHIVE_NAME" > "${ARCHIVE_NAME}.sha256"

# ── Step 5: Sign (optional — if private key exists) ──────────────────

if [ -f "$SCRIPT_DIR/clearpanel-release.key" ]; then
    echo -e "${YELLOW}Signing release...${NC}"
    openssl dgst -sha256 -sign "$SCRIPT_DIR/clearpanel-release.key" \
        -out "$DIST_DIR/${ARCHIVE_NAME}.sig" \
        "$DIST_DIR/$ARCHIVE_NAME"
    echo -e "${GREEN}Release signed${NC}"
else
    echo -e "${YELLOW}No signing key found (release/clearpanel-release.key) — skipping signature${NC}"
fi

# ── Cleanup ──────────────────────────────────────────────────────────
rm -rf "$STAGE_DIR"

# ── Done ─────────────────────────────────────────────────────────────
FILESIZE=$(du -h "$DIST_DIR/$ARCHIVE_NAME" | cut -f1)

echo ""
echo -e "${GREEN}${BOLD}✓ Release built successfully!${NC}"
echo -e "  Archive: ${BOLD}$DIST_DIR/$ARCHIVE_NAME${NC} (${FILESIZE})"
echo -e "  SHA256:  $(cat "$DIST_DIR/${ARCHIVE_NAME}.sha256" | cut -d' ' -f1)"
if [ -f "$DIST_DIR/${ARCHIVE_NAME}.sig" ]; then
    echo -e "  Signed:  ${GREEN}yes${NC}"
fi
echo ""
echo -e "${BLUE}To upload to your release server:${NC}"
echo "  scp $DIST_DIR/$ARCHIVE_NAME yourserver:/var/www/releases/"
echo ""
