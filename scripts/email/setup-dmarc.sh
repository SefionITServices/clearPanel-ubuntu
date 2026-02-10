#!/usr/bin/env bash
# ==========================================================================
# setup-dmarc.sh — Configure DMARC enforcement + aggregate report processing
#
# Uses Rspamd's built-in DMARC module (no extra daemons needed) to:
#   • Enforce DMARC policy on inbound mail
#   • Collect aggregate reports in Redis
#   • Optionally send DMARC aggregate reports (rua)
#
# Usage:  ./setup-dmarc.sh <domain> [reporting-email]
# Example: ./setup-dmarc.sh example.com dmarc@example.com
# ==========================================================================
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <domain> [reporting-email]" >&2
  exit 1
fi

DOMAIN="$1"
REPORT_EMAIL="${2:-dmarc@$DOMAIN}"

SCRIPT_SOURCE="${BASH_SOURCE[0]}"
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_SOURCE")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

ensure_state_root

echo "=== ClearPanel DMARC Setup ==="
echo "Domain:        ${DOMAIN}"
echo "Report email:  ${REPORT_EMAIL}"

# -----------------------------------------------------------------------
# 1.  Rspamd DMARC module configuration
# -----------------------------------------------------------------------
RSPAMD_LOCAL="/etc/rspamd/local.d"

configure_rspamd_dmarc() {
  mkdir -p "$RSPAMD_LOCAL"

  cat >"$RSPAMD_LOCAL/dmarc.conf" <<DMARC
# ClearPanel — DMARC module configuration
#
# Enable DMARC checking on inbound mail
enabled = true;

# Actions when DMARC check fails
actions {
  quarantine = "add_header";
  reject = "reject";
  softfail = "add_header";
}

# Enable DMARC aggregate report collection
reporting {
  enabled = true;
  # Store reports in Redis (Rspamd's default backend)
  redis_keys {
    report = "dmarc_report:{domain}:{date}";
  }
  # How often to send aggregate reports
  send_reports = true;
  report_settings {
    org_name = "ClearPanel Mail";
    domain = "${DOMAIN}";
    email = "${REPORT_EMAIL}";
  }
}
DMARC

  echo "[✓] Rspamd DMARC module configured"
}

# -----------------------------------------------------------------------
# 2.  Rspamd ARC (Authenticated Received Chain) — for forwarding
# -----------------------------------------------------------------------
configure_rspamd_arc() {
  cat >"$RSPAMD_LOCAL/arc.conf" <<ARC
# ClearPanel — ARC signing configuration
# Preserves authentication results across forwards (RFC 8617)
enabled = true;

# Reuse DKIM keys for ARC signing
sign_authenticated = true;
use_domain = "header";
try_fallback = true;

# Look for DKIM keys in the standard OpenDKIM location
path = "/etc/opendkim/keys/\$domain/mail.private";
selector = "mail";
ARC

  echo "[✓] Rspamd ARC module configured"
}

# -----------------------------------------------------------------------
# 3.  Ensure Redis is available for report storage
# -----------------------------------------------------------------------
ensure_redis() {
  if ! command -v redis-server >/dev/null 2>&1; then
    echo "Installing Redis for DMARC report storage..."
    apt-get install -y -qq redis-server >/dev/null 2>&1
  fi

  # Rspamd needs Redis — configure the connection
  cat >"$RSPAMD_LOCAL/redis.conf" <<REDIS
# ClearPanel — Rspamd Redis connection
servers = "127.0.0.1:6379";
REDIS

  systemctl enable --now redis-server 2>/dev/null || true
  echo "[✓] Redis available for report storage"
}

# -----------------------------------------------------------------------
# 4.  DNS record suggestions
# -----------------------------------------------------------------------
show_dns_suggestions() {
  echo ""
  echo "=== Required DNS records ==="
  echo ""
  echo "DMARC policy (TXT record):"
  echo "  _dmarc.${DOMAIN}  IN  TXT  \"v=DMARC1; p=quarantine; rua=mailto:${REPORT_EMAIL}; ruf=mailto:${REPORT_EMAIL}; sp=quarantine; adkim=r; aspf=r; pct=100\""
  echo ""
  echo "SPF (if not already set):"
  echo "  ${DOMAIN}  IN  TXT  \"v=spf1 a mx ip4:<YOUR-SERVER-IP> -all\""
  echo ""
  echo "Recommended: start with p=none to monitor, then move to p=quarantine → p=reject"
  echo ""
}

# -----------------------------------------------------------------------
# Apply
# -----------------------------------------------------------------------
if is_dev_mode; then
  echo ""
  echo "[dev] Would configure:"
  echo "  • Rspamd DMARC module (check + aggregate reporting)"
  echo "  • Rspamd ARC module (forwarding authentication)"
  echo "  • Redis for report storage"
  show_dns_suggestions
else
  configure_rspamd_dmarc
  configure_rspamd_arc
  ensure_redis
  systemctl reload rspamd 2>/dev/null || true
  echo "[✓] Rspamd reloaded"
  show_dns_suggestions
fi

# --- Save state ---
DMARC_STATE_DIR="$STATE_ROOT/dmarc"
mkdir -p "$DMARC_STATE_DIR"
cat >"$DMARC_STATE_DIR/${DOMAIN}.json" <<JSON
{
  "domain": "${DOMAIN}",
  "reportEmail": "${REPORT_EMAIL}",
  "policy": "quarantine",
  "arcEnabled": true,
  "configuredAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
JSON

echo ""
echo "=== DMARC setup complete ==="
