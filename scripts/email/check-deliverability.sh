#!/usr/bin/env bash
set -euo pipefail

# Check common outbound deliverability controls for a mail domain.
#
# Usage:
#   scripts/email/check-deliverability.sh <domain> [mail-hostname] [server-ip]
#
# Example:
#   scripts/email/check-deliverability.sh example.com mail.example.com 203.0.113.10

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <domain> [mail-hostname] [server-ip]" >&2
  exit 1
fi

DOMAIN="${1,,}"
MAIL_HOST="${2:-mail.${DOMAIN}}"
SERVER_IP="${3:-${SERVER_IP:-}}"

if [[ -z "$SERVER_IP" ]]; then
  SERVER_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
fi

PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  printf '[PASS] %s\n' "$1"
}

warn() {
  WARN_COUNT=$((WARN_COUNT + 1))
  printf '[WARN] %s\n' "$1"
}

fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  printf '[FAIL] %s\n' "$1"
}

dig_first() {
  local type="$1"
  local name="$2"
  dig +time=2 +tries=1 +short "$type" "$name" 2>/dev/null | sed '/^$/d' | sed -n '1p'
}

dig_all() {
  local type="$1"
  local name="$2"
  dig +time=2 +tries=1 +short "$type" "$name" 2>/dev/null | sed '/^$/d'
}

echo "=== ClearPanel Deliverability Check ==="
echo "Domain:      $DOMAIN"
echo "Mail host:   $MAIL_HOST"
echo "Server IP:   ${SERVER_IP:-unknown}"
echo ""

# ----------------------------------------------------------------------
# Local Postfix identity + TLS
# ----------------------------------------------------------------------
MYHOSTNAME="$(postconf -h myhostname 2>/dev/null || true)"
MYDOMAIN="$(postconf -h mydomain 2>/dev/null || true)"
TLS_CERT="$(postconf -h smtpd_tls_cert_file 2>/dev/null || true)"

if [[ -n "$MYHOSTNAME" ]]; then
  pass "Postfix myhostname is set: $MYHOSTNAME"
else
  fail "Postfix myhostname is empty"
fi

if [[ -n "$MYDOMAIN" ]]; then
  pass "Postfix mydomain is set: $MYDOMAIN"
  if [[ "$MYDOMAIN" == "com" || "$MYDOMAIN" == "net" || "$MYDOMAIN" == "org" || "$MYDOMAIN" == "in" ]]; then
    warn "mydomain looks like a bare TLD ($MYDOMAIN); this hurts identity alignment"
  fi
else
  fail "Postfix mydomain is empty"
fi

if [[ "$TLS_CERT" == *snakeoil* ]]; then
  warn "Postfix is using snakeoil certificate ($TLS_CERT)"
elif [[ -n "$TLS_CERT" && -f "$TLS_CERT" ]]; then
  pass "Postfix TLS certificate path exists: $TLS_CERT"
else
  warn "Postfix TLS certificate path missing or unreadable: ${TLS_CERT:-unset}"
fi

DKIM_KEY="/etc/opendkim/keys/${DOMAIN}/default.private"
if [[ -f "$DKIM_KEY" ]]; then
  pass "DKIM private key exists: $DKIM_KEY"
else
  warn "DKIM key missing: $DKIM_KEY"
fi

echo ""

# ----------------------------------------------------------------------
# DNS checks
# ----------------------------------------------------------------------
MX_RECORDS="$(dig_all MX "$DOMAIN" || true)"
if [[ -z "$MX_RECORDS" ]]; then
  warn "No MX records found for $DOMAIN (or DNS lookup unavailable)"
else
  echo "$MX_RECORDS" | grep -qi "$MAIL_HOST" \
    && pass "MX includes $MAIL_HOST" \
    || warn "MX does not reference $MAIL_HOST"
fi

MAIL_A="$(dig_first A "$MAIL_HOST" || true)"
if [[ -n "$MAIL_A" ]]; then
  pass "A record for $MAIL_HOST resolves to $MAIL_A"
  if [[ -n "$SERVER_IP" && "$MAIL_A" != "$SERVER_IP" ]]; then
    warn "A record IP ($MAIL_A) differs from server IP ($SERVER_IP)"
  fi
else
  warn "No A record for $MAIL_HOST (or DNS lookup unavailable)"
fi

SPF_TXT="$(dig_all TXT "$DOMAIN" | tr -d '"' | grep -i 'v=spf1' || true)"
if [[ -n "$SPF_TXT" ]]; then
  pass "SPF TXT record exists"
  echo "$SPF_TXT" | grep -qi 'mx' || warn "SPF record does not include mx mechanism"
else
  fail "SPF TXT record (v=spf1) not found for $DOMAIN"
fi

DMARC_TXT="$(dig_all TXT "_dmarc.${DOMAIN}" | tr -d '"' | grep -i 'v=DMARC1' || true)"
if [[ -n "$DMARC_TXT" ]]; then
  pass "DMARC TXT record exists for _dmarc.$DOMAIN"
  echo "$DMARC_TXT" | grep -qi 'p=none' && warn "DMARC policy is p=none (monitor mode). Tighten after alignment tests."
else
  warn "DMARC TXT record not found for _dmarc.$DOMAIN"
fi

DKIM_TXT="$(dig_all TXT "default._domainkey.${DOMAIN}" | tr -d '"' | grep -i 'v=DKIM1' || true)"
if [[ -n "$DKIM_TXT" ]]; then
  pass "DKIM TXT record exists for default._domainkey.$DOMAIN"
else
  fail "DKIM TXT record missing for default._domainkey.$DOMAIN"
fi

if [[ -n "$SERVER_IP" ]]; then
  PTR_HOST="$(host "$SERVER_IP" 2>/dev/null | awk '/pointer/ {print $NF}' | sed 's/\.$//' | sed -n '1p' || true)"
  if [[ -n "$PTR_HOST" ]]; then
    pass "PTR exists for $SERVER_IP -> $PTR_HOST"
    if [[ "$PTR_HOST" != "$MAIL_HOST" ]]; then
      warn "PTR host ($PTR_HOST) does not match mail host ($MAIL_HOST)"
    fi
  else
    warn "PTR record not found for $SERVER_IP"
  fi
fi

echo ""
echo "Summary: pass=$PASS_COUNT warn=$WARN_COUNT fail=$FAIL_COUNT"
if (( FAIL_COUNT > 0 )); then
  exit 2
fi

