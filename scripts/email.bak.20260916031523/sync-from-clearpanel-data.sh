#!/usr/bin/env bash
set -euo pipefail

# Reconcile mail-domains.json (panel state) into live Postfix/Dovecot maps.
# Run this as root on production hosts when MAIL_MODE was previously misconfigured.
#
# Usage:
#   sudo scripts/email/sync-from-clearpanel-data.sh [path/to/mail-domains.json]

SCRIPT_SOURCE="${BASH_SOURCE[0]}"
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_SOURCE")" && pwd)"
REPO_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

BACKEND_ENV="$REPO_ROOT/backend/.env"

DATA_FILE="${1:-}"
if [[ -z "$DATA_FILE" ]]; then
  if [[ -f "$BACKEND_ENV" ]]; then
    DATA_DIR="$(grep -E '^DATA_DIR=' "$BACKEND_ENV" | cut -d= -f2- || true)"
    if [[ -n "$DATA_DIR" ]]; then
      DATA_FILE="${DATA_DIR}/mail-domains.json"
    fi
  fi
fi

if [[ -z "$DATA_FILE" ]]; then
  echo "Could not infer mail-domains.json path. Pass it explicitly." >&2
  echo "Usage: $0 /path/to/mail-domains.json" >&2
  exit 1
fi

if [[ ! -f "$DATA_FILE" ]]; then
  echo "mail-domains.json not found at: $DATA_FILE" >&2
  exit 1
fi

echo "Sync source: $DATA_FILE"
echo "Mode: production"

export MAIL_MODE=production
export CLEARPANEL_EMAIL_SCRIPT_DIR="$SCRIPT_DIR"
export CLEARPANEL_MAIL_DATA_FILE="$DATA_FILE"

node <<'NODE'
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const scriptDir = process.env.CLEARPANEL_EMAIL_SCRIPT_DIR;
const dataFile = process.env.CLEARPANEL_MAIL_DATA_FILE;

if (!scriptDir || !dataFile) {
  console.error('Missing required environment');
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
if (!Array.isArray(payload)) {
  console.error(`Expected array in ${dataFile}`);
  process.exit(1);
}

const run = (scriptName, args) => {
  const fullPath = path.join(scriptDir, scriptName);
  const result = spawnSync('bash', [fullPath, ...args], {
    stdio: 'inherit',
    env: {
      ...process.env,
      MAIL_MODE: 'production',
    },
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

let domains = 0;
let mailboxes = 0;
let aliases = 0;

for (const entry of payload) {
  const domain = String(entry?.domain ?? '').trim().toLowerCase();
  if (!domain) continue;

  run('provision-domain.sh', [domain]);
  domains += 1;

  for (const mailbox of entry.mailboxes ?? []) {
    const email = String(mailbox?.email ?? '').trim().toLowerCase();
    const passwordHash = String(mailbox?.passwordHash ?? '').trim();
    if (!email || !passwordHash) continue;

    const args = [domain, email, passwordHash];
    if (Number.isFinite(mailbox?.quotaMb)) {
      args.push(String(Math.max(0, Math.floor(mailbox.quotaMb))));
    }
    run('provision-mailbox.sh', args);
    mailboxes += 1;
  }

  for (const alias of entry.aliases ?? []) {
    const source = String(alias?.source ?? '').trim().toLowerCase();
    const destination = String(alias?.destination ?? '').trim().toLowerCase();
    if (!source || !destination) continue;

    run('provision-alias.sh', [domain, source, destination]);
    aliases += 1;
  }
}

console.log('');
console.log(`Synced ${domains} domains, ${mailboxes} mailboxes, ${aliases} aliases.`);
NODE

echo "Restarting services..."
systemctl restart postfix dovecot

echo "Done."
