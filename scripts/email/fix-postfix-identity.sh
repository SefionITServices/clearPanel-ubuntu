#!/usr/bin/env bash
set -euo pipefail

# Repair Postfix identity values used for outbound reputation.
#
# Usage:
#   sudo scripts/email/fix-postfix-identity.sh <mail-hostname>
#
# Example:
#   sudo scripts/email/fix-postfix-identity.sh mail.example.com

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <mail-hostname>" >&2
  exit 1
fi

MAIL_HOSTNAME="${1,,}"

derive_mydomain() {
  local host="$1"
  local dot_count=0
  local tmp="${host//[^.]}"
  dot_count="${#tmp}"

  if (( dot_count >= 2 )); then
    printf '%s\n' "${host#*.}"
    return
  fi

  printf '%s\n' "$host"
}

MYDOMAIN="$(derive_mydomain "$MAIL_HOSTNAME")"

echo "Applying Postfix identity..."
echo "  myhostname = $MAIL_HOSTNAME"
echo "  mydomain   = $MYDOMAIN"

postconf -e "myhostname = $MAIL_HOSTNAME"
postconf -e "mydomain = $MYDOMAIN"
postconf -e "myorigin = \$mydomain"
postconf -e "smtp_helo_name = \$myhostname"
postconf -e "mydestination = \$myhostname, localhost.\$mydomain, localhost"

systemctl reload postfix

echo "Done."

