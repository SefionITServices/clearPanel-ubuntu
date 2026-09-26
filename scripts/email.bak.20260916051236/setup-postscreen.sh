#!/usr/bin/env bash
# ==========================================================================
# setup-postscreen.sh — Enable Postscreen + reputation-based SMTP protection
#
# Postscreen sits in front of smtpd and filters out known-bad & zombie
# connections before they reach the real SMTP daemon, dramatically
# reducing spam and resource usage.
#
# Usage:  ./setup-postscreen.sh [--dry-run]
# ==========================================================================
set -euo pipefail

SCRIPT_SOURCE="${BASH_SOURCE[0]}"
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_SOURCE")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

echo "=== ClearPanel Postscreen Setup ==="
[[ "$DRY_RUN" == "true" ]] && echo "(dry-run mode — no changes applied)"

# -----------------------------------------------------------------------
# 1.  master.cf — swap smtp → postscreen on port 25
# -----------------------------------------------------------------------
MASTER_CF="/etc/postfix/master.cf"

configure_master_cf() {
  if grep -q "^postscreen" "$MASTER_CF" 2>/dev/null; then
    echo "[✓] Postscreen already present in master.cf"
    return
  fi

  # Back up original
  cp "$MASTER_CF" "${MASTER_CF}.bak.$(date +%s)"

  # Comment out the default "smtp inet" line
  sed -i 's/^smtp\([[:space:]]\+inet\)/# smtp\1/' "$MASTER_CF"

  # Append postscreen services
  cat >>"$MASTER_CF" <<'MASTER'

# ---- ClearPanel Postscreen ----
# Postscreen occupies port 25; real smtpd is behind it.
postscreen  unix  -       -       y       -       1       postscreen
  -o postscreen_upstream_proxy_protocol=
smtpd       pass  -       -       y       -       -       smtpd
  -o syslog_name=postfix/smtpd-behind-postscreen
dnsblog     unix  -       -       y       -       0       dnsblog
tlsproxy    unix  -       -       y       -       0       tlsproxy
MASTER

  echo "[✓] master.cf updated with Postscreen services"
}

# -----------------------------------------------------------------------
# 2.  main.cf — Postscreen settings
# -----------------------------------------------------------------------
configure_main_cf() {
  local pconf="postconf -e"

  # --- DNSBL configuration (free public lists) ---
  $pconf "postscreen_dnsbl_sites =
    zen.spamhaus.org*3,
    bl.spamcop.net*2,
    b.barracudacentral.org*2,
    dnsbl.sorbs.net*1"
  $pconf "postscreen_dnsbl_threshold = 3"
  $pconf "postscreen_dnsbl_action = enforce"

  # --- Deep protocol tests ---
  $pconf "postscreen_greet_action = enforce"
  $pconf "postscreen_bare_newline_action = enforce"
  $pconf "postscreen_non_smtp_command_action = drop"
  $pconf "postscreen_pipelining_action = enforce"

  # --- Whitelisting ---
  # Allow known-good hosts to bypass postscreen
  $pconf "postscreen_access_list =
    permit_mynetworks,
    cidr:/etc/postfix/postscreen_access.cidr"

  # Create empty access file if missing
  if [[ ! -f /etc/postfix/postscreen_access.cidr ]]; then
    cat >/etc/postfix/postscreen_access.cidr <<'CIDR'
# ClearPanel — Postscreen CIDR whitelist
# Format:  <network>/<mask>  <action>
# Example: 192.168.0.0/16    permit
CIDR
  fi

  # --- Cache ---
  $pconf "postscreen_cache_map = btree:/var/lib/postfix/postscreen_cache"
  $pconf "postscreen_cache_cleanup_interval = 12h"

  echo "[✓] Postscreen main.cf settings applied"
}

# -----------------------------------------------------------------------
# 3.  Outbound rate-limiting (anvil)
# -----------------------------------------------------------------------
configure_rate_limiting() {
  local pconf="postconf -e"

  # Limit authenticated senders to prevent compromised-account spam floods
  $pconf "smtpd_client_message_rate_limit = 100"
  $pconf "smtpd_client_recipient_rate_limit = 200"
  $pconf "smtpd_client_connection_rate_limit = 30"
  $pconf "anvil_rate_time_unit = 60s"

  echo "[✓] Outbound rate limits configured"
}

# -----------------------------------------------------------------------
# 4.  SRS (Sender Rewriting Scheme) — improve forwarding reputation
# -----------------------------------------------------------------------
configure_srs() {
  if ! command -v postsrsd >/dev/null 2>&1; then
    echo "Installing postsrsd..."
    apt-get install -y -qq postsrsd >/dev/null 2>&1
  fi

  # postsrsd runs on 10001/10002 by default
  local pconf="postconf -e"
  $pconf "sender_canonical_maps = tcp:localhost:10001"
  $pconf "sender_canonical_classes = envelope_sender"
  $pconf "recipient_canonical_maps = tcp:localhost:10002"
  $pconf "recipient_canonical_classes = envelope_recipient,header_recipient"

  systemctl enable --now postsrsd 2>/dev/null || true
  echo "[✓] PostSRSd configured"
}

# -----------------------------------------------------------------------
# Apply
# -----------------------------------------------------------------------
if [[ "$MAIL_MODE" != "production" || "$DRY_RUN" == "true" ]]; then
  echo ""
  echo "[dev/dry-run] Would apply:"
  echo "  • Postscreen in master.cf (port 25)"
  echo "  • DNSBL: zen.spamhaus.org, bl.spamcop.net, b.barracudacentral.org, dnsbl.sorbs.net"
  echo "  • Greet / bare-newline / pipelining enforcement"
  echo "  • Outbound rate-limiting (100 msg/min, 200 rcpt/min)"
  echo "  • PostSRSd for sender rewriting"
else
  configure_master_cf
  configure_main_cf
  configure_rate_limiting
  configure_srs
  postfix reload 2>/dev/null || true
fi

# --- Save state ---
ensure_state_root
cat >"$STATE_ROOT/postscreen.json" <<JSON
{
  "enabled": true,
  "dnsblThreshold": 3,
  "srs": true,
  "rateLimits": {
    "messageRate": 100,
    "recipientRate": 200,
    "connectionRate": 30
  },
  "configuredAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
JSON

echo ""
echo "=== Postscreen setup complete ==="
