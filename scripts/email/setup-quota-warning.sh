#!/usr/bin/env bash
# setup-quota-warning.sh — Configure Dovecot quota warnings
# Usage: setup-quota-warning.sh <threshold_percent> [admin_email]
#
# Dual-mode: MAIL_MODE=dev (JSON state) vs production (Dovecot conf)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

THRESHOLD="${1:?Usage: setup-quota-warning.sh <threshold_percent> [admin_email]}"
ADMIN_EMAIL="${2:-}"

STATE_DIR="${MAIL_STATE_DIR:-$SCRIPT_DIR/../../backend/mail-state}"
mkdir -p "$STATE_DIR"

if [[ "$MAIL_MODE" == "production" ]]; then
  QUOTA_CONF="/etc/dovecot/conf.d/90-quota.conf"
  WARN_SCRIPT="/usr/local/bin/quota-warning.sh"

  # Create the warning notification script
  cat > "$WARN_SCRIPT" << 'WARN_EOF'
#!/usr/bin/env bash
# Dovecot quota warning script
PERCENT=$1
USER=$2

cat << MSG | /usr/sbin/sendmail -t -f "postmaster@$(hostname -d)"
From: Mail Server <postmaster@$(hostname -d)>
To: ${USER}
Subject: Mailbox quota warning - ${PERCENT}% used
Content-Type: text/plain; charset=UTF-8

Your mailbox is ${PERCENT}% full.

Please delete some messages or contact your administrator to increase your quota.

-- Mail Server
MSG
WARN_EOF
  chmod +x "$WARN_SCRIPT"

  # Configure Dovecot quota plugin
  cat > "$QUOTA_CONF" << CONF_EOF
plugin {
  quota = maildir:User quota
  quota_rule = *:storage=0
  
  quota_warning = storage=${THRESHOLD}%% quota-warning ${THRESHOLD} %u
  quota_warning2 = storage=95%% quota-warning 95 %u
  quota_warning3 = storage=100%% quota-warning 100 %u
}

service quota-warning {
  executable = script ${WARN_SCRIPT}
  user = dovecot
  unix_listener quota-warning {
    user = vmail
  }
}
CONF_EOF

  # Ensure quota plugin is loaded
  MAIL_CONF="/etc/dovecot/conf.d/10-mail.conf"
  if [[ -f "$MAIL_CONF" ]]; then
    if ! grep -q "quota" "$MAIL_CONF" 2>/dev/null; then
      sed -i 's/^mail_plugins = \(.*\)/mail_plugins = \1 quota/' "$MAIL_CONF" 2>/dev/null || true
    fi
  fi

  systemctl reload dovecot 2>/dev/null || true
  log_info "Quota warnings configured at ${THRESHOLD}%"
  echo "ok"
else
  # Dev mode
  cat > "$STATE_DIR/quota-warning.json" << EOF
{"threshold":${THRESHOLD},"adminEmail":"${ADMIN_EMAIL}","updatedAt":"$(date -u +%Y-%m-%dT%H:%M:%SZ)"}
EOF
  log_info "[dev] Quota warning configured at ${THRESHOLD}%"
  echo "ok"
fi
