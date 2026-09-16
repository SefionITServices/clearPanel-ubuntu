#!/usr/bin/env bash
# ==========================================================================
# setup-mail-tls.sh — Obtain or reuse a TLS certificate for Postfix & Dovecot
#
# Usage:
#   ./setup-mail-tls.sh <mail-hostname> <email> [--reuse-existing]
#
# Examples:
#   ./setup-mail-tls.sh mail.example.com admin@example.com
#   ./setup-mail-tls.sh mail.example.com admin@example.com --reuse-existing
# ==========================================================================
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <mail-hostname> <admin-email> [--reuse-existing]" >&2
  exit 1
fi

MAIL_HOSTNAME="$1"
ADMIN_EMAIL="$2"
REUSE_EXISTING="${3:-}"

SCRIPT_SOURCE="${BASH_SOURCE[0]}"
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_SOURCE")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

ensure_state_root

CERT_DIR="/etc/letsencrypt/live/${MAIL_HOSTNAME}"
DEPLOY_HOOK_DIR="/etc/letsencrypt/renewal-hooks/deploy"
DEPLOY_HOOK="$DEPLOY_HOOK_DIR/clearpanel-mail-tls.sh"

echo "=== ClearPanel Mail TLS Setup ==="
echo "Mail hostname: ${MAIL_HOSTNAME}"
echo "Admin email:   ${ADMIN_EMAIL}"

# --- Ensure certbot is installed ---
if ! command -v certbot >/dev/null 2>&1; then
  echo "Installing certbot..."
  apt-get update -qq
  apt-get install -y -qq certbot >/dev/null 2>&1
fi
echo "[✓] Certbot available"

# --- Check for existing certificate ---
CERT_EXISTS=false
if [[ -f "${CERT_DIR}/fullchain.pem" && -f "${CERT_DIR}/privkey.pem" ]]; then
  CERT_EXISTS=true
  echo "[✓] Existing certificate found for ${MAIL_HOSTNAME}"
fi

# --- Obtain certificate if needed ---
if [[ "$CERT_EXISTS" == "false" ]]; then
  echo "Obtaining TLS certificate for ${MAIL_HOSTNAME}..."

  # Use standalone mode since mail hostname may not have an nginx vhost
  # Temporarily stop any service on port 80 if needed
  certbot certonly \
    --standalone \
    --non-interactive \
    --agree-tos \
    --email "$ADMIN_EMAIL" \
    -d "$MAIL_HOSTNAME" \
    --preferred-challenges http

  if [[ ! -f "${CERT_DIR}/fullchain.pem" ]]; then
    echo "ERROR: Certificate obtainment failed" >&2
    exit 1
  fi
  echo "[✓] Certificate obtained"
elif [[ "$REUSE_EXISTING" != "--reuse-existing" && "$CERT_EXISTS" == "true" ]]; then
  echo "Certificate already exists. Pass --reuse-existing to skip re-issuance."
fi

# --- Configure Postfix TLS ---
if command -v postconf >/dev/null 2>&1; then
  postconf -e "smtpd_tls_cert_file = ${CERT_DIR}/fullchain.pem"
  postconf -e "smtpd_tls_key_file = ${CERT_DIR}/privkey.pem"
  postconf -e "smtpd_tls_security_level = may"
  postconf -e "smtpd_tls_protocols = !SSLv2, !SSLv3, !TLSv1, !TLSv1.1"
  postconf -e "smtpd_tls_mandatory_protocols = !SSLv2, !SSLv3, !TLSv1, !TLSv1.1"
  postconf -e "smtpd_tls_mandatory_ciphers = medium"
  postconf -e "smtp_tls_security_level = may"
  postconf -e "smtp_tls_protocols = !SSLv2, !SSLv3, !TLSv1, !TLSv1.1"
  postconf -e "smtp_tls_loglevel = 1"
  postconf -e "smtpd_tls_loglevel = 1"
  systemctl reload postfix 2>/dev/null || true
  echo "[✓] Postfix TLS configured"
fi

# --- Configure Dovecot TLS ---
DOVECOT_TLS_CONF="/etc/dovecot/conf.d/10-ssl.conf"
if [[ -d /etc/dovecot/conf.d ]]; then
  cat >"$DOVECOT_TLS_CONF" <<DCSSL
# ClearPanel — Dovecot TLS configuration
ssl = required
ssl_cert = <${CERT_DIR}/fullchain.pem
ssl_key = <${CERT_DIR}/privkey.pem
ssl_min_protocol = TLSv1.2
ssl_prefer_server_ciphers = yes
DCSSL
  systemctl reload dovecot 2>/dev/null || true
  echo "[✓] Dovecot TLS configured"
fi

# --- Install Certbot deploy hook for automatic renewal ---
mkdir -p "$DEPLOY_HOOK_DIR"
cat >"$DEPLOY_HOOK" <<'HOOK'
#!/usr/bin/env bash
# ClearPanel — Certbot deploy hook for mail TLS renewal
# This runs automatically after any certbot renewal.

set -euo pipefail

# Reload Postfix if the renewed cert is used by it
POSTFIX_CERT="$(postconf -h smtpd_tls_cert_file 2>/dev/null || true)"
if [[ -n "$POSTFIX_CERT" ]] && echo "$RENEWED_LINEAGE" | grep -q "$(dirname "$POSTFIX_CERT" | xargs dirname)"; then
  systemctl reload postfix 2>/dev/null || true
  logger -t clearpanel-mail-tls "Reloaded Postfix after certificate renewal for ${RENEWED_DOMAINS:-unknown}"
fi

# Reload Dovecot
if systemctl is-active --quiet dovecot 2>/dev/null; then
  systemctl reload dovecot 2>/dev/null || true
  logger -t clearpanel-mail-tls "Reloaded Dovecot after certificate renewal for ${RENEWED_DOMAINS:-unknown}"
fi

# Reload Rspamd (uses TLS for outbound checks)
if systemctl is-active --quiet rspamd 2>/dev/null; then
  systemctl reload rspamd 2>/dev/null || true
fi
HOOK
chmod +x "$DEPLOY_HOOK"
echo "[✓] Certbot renewal deploy hook installed at ${DEPLOY_HOOK}"

# --- Ensure certbot timer is active ---
systemctl enable --now certbot.timer 2>/dev/null || true
echo "[✓] Certbot auto-renewal timer enabled"

# --- Save state ---
cat >"$STATE_ROOT/tls.json" <<JSON
{
  "hostname": "${MAIL_HOSTNAME}",
  "certDir": "${CERT_DIR}",
  "deployHook": "${DEPLOY_HOOK}",
  "configuredAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
JSON

echo ""
echo "=== Mail TLS setup complete ==="
echo "Certificate:  ${CERT_DIR}/fullchain.pem"
echo "Deploy hook:  ${DEPLOY_HOOK}"
echo "Auto-renewal: certbot.timer (enabled)"
