#!/usr/bin/env bash
set -euo pipefail

SCRIPT_SOURCE="${BASH_SOURCE[0]}"
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_SOURCE")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

ensure_state_root

STACK_FILE="$STATE_ROOT/stack.json"
TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
HOSTNAME_VAL="${MAIL_HOSTNAME:-$(hostname -f 2>/dev/null || hostname)}"

if [[ "$MAIL_MODE" == "production" ]]; then
  echo "=== Installing mail stack (Postfix, Dovecot, Rspamd, ClamAV) ==="

  export DEBIAN_FRONTEND=noninteractive

  # Pre-configure Postfix to avoid interactive prompt
  debconf-set-selections <<EOF
postfix postfix/main_mailer_type select Internet Site
postfix postfix/mailname string ${HOSTNAME_VAL}
EOF

  apt-get update -qq

  # Install Postfix
  apt-get install -y -qq postfix postfix-pcre >/dev/null 2>&1
  echo "[✓] Postfix installed"

  # Install Dovecot (IMAP + LMTP + Sieve)
  apt-get install -y -qq dovecot-core dovecot-imapd dovecot-lmtpd dovecot-sieve dovecot-managesieved >/dev/null 2>&1
  echo "[✓] Dovecot installed"

  # Install Rspamd (spam filtering + DKIM signing)
  if ! command -v rspamd >/dev/null 2>&1; then
    # Add Rspamd repo if not already present
    if [[ ! -f /etc/apt/sources.list.d/rspamd.list ]]; then
      apt-get install -y -qq lsb-release wget gnupg >/dev/null 2>&1
      CODENAME="$(lsb_release -cs 2>/dev/null || echo 'jammy')"
      wget -qO- https://rspamd.com/apt-stable/gpg.key | gpg --dearmor -o /etc/apt/trusted.gpg.d/rspamd.gpg 2>/dev/null || true
      echo "deb http://rspamd.com/apt-stable/ $CODENAME main" >/etc/apt/sources.list.d/rspamd.list
      apt-get update -qq
    fi
    apt-get install -y -qq rspamd >/dev/null 2>&1
  fi
  echo "[✓] Rspamd installed"

  # Install ClamAV
  apt-get install -y -qq clamav clamav-daemon >/dev/null 2>&1
  echo "[✓] ClamAV installed"

  # Install OpenDKIM for DKIM key management
  apt-get install -y -qq opendkim opendkim-tools >/dev/null 2>&1
  echo "[✓] OpenDKIM installed"

  # --- Ensure vmail user ---
  if ! id vmail &>/dev/null; then
    groupadd -g "${VMAIL_GID}" vmail 2>/dev/null || true
    useradd -u "${VMAIL_UID}" -g "${VMAIL_GID}" -d "$VMAIL_HOME" -s /usr/sbin/nologin vmail 2>/dev/null || true
  fi
  mkdir -p "$VMAIL_HOME"
  chown -R vmail:vmail "$VMAIL_HOME"
  echo "[✓] vmail user configured (uid=${VMAIL_UID})"

  # --- Create config directories ---
  mkdir -p "$MAIL_CONFIG_DIR" "$OPENDKIM_KEYS_DIR"
  touch "$POSTFIX_VDOMAINS" "$POSTFIX_VMAILBOX" "$POSTFIX_VALIAS" "$DOVECOT_PASSWD"

  # --- Configure Postfix ---
  postconf -e "myhostname = $HOSTNAME_VAL"
  postconf -e "mydomain = $(echo "$HOSTNAME_VAL" | cut -d. -f2-)"
  postconf -e "myorigin = \$mydomain"
  postconf -e "inet_interfaces = all"
  postconf -e "inet_protocols = all"
  postconf -e "mydestination = localhost"
  postconf -e "virtual_mailbox_domains = hash:$POSTFIX_VDOMAINS"
  postconf -e "virtual_mailbox_maps = hash:$POSTFIX_VMAILBOX"
  postconf -e "virtual_alias_maps = hash:$POSTFIX_VALIAS"
  postconf -e "virtual_mailbox_base = $VMAIL_HOME"
  postconf -e "virtual_uid_maps = static:${VMAIL_UID}"
  postconf -e "virtual_gid_maps = static:${VMAIL_GID}"
  postconf -e "virtual_transport = lmtp:unix:private/dovecot-lmtp"
  postconf -e "smtpd_tls_security_level = may"
  postconf -e "smtp_tls_security_level = may"
  postconf -e "smtpd_sasl_auth_enable = yes"
  postconf -e "smtpd_sasl_type = dovecot"
  postconf -e "smtpd_sasl_path = private/auth"
  postconf -e "smtpd_recipient_restrictions = permit_sasl_authenticated,permit_mynetworks,reject_unauth_destination"
  postconf -e "smtpd_relay_restrictions = permit_mynetworks,permit_sasl_authenticated,defer_unauth_destination"
  postconf -e "smtpd_milters = inet:localhost:11332"
  postconf -e "non_smtpd_milters = inet:localhost:11332"
  postconf -e "milter_protocol = 6"
  postconf -e "milter_default_action = accept"
  postconf -e "message_size_limit = 52428800"

  # Enable submission port (587)
  if ! grep -q "^submission " /etc/postfix/master.cf 2>/dev/null; then
    cat >>/etc/postfix/master.cf <<'MASTER'

submission inet n       -       y       -       -       smtpd
  -o syslog_name=postfix/submission
  -o smtpd_tls_security_level=encrypt
  -o smtpd_sasl_auth_enable=yes
  -o smtpd_tls_auth_only=yes
  -o smtpd_reject_unlisted_recipient=no
  -o smtpd_recipient_restrictions=permit_sasl_authenticated,reject
  -o milter_macro_daemon_name=ORIGINATING
MASTER
  fi

  # Build initial hash maps
  postmap "$POSTFIX_VDOMAINS" 2>/dev/null || true
  postmap "$POSTFIX_VMAILBOX" 2>/dev/null || true
  postmap "$POSTFIX_VALIAS" 2>/dev/null || true
  echo "[✓] Postfix configured"

  # --- Configure Dovecot ---
  cat >/etc/dovecot/conf.d/10-clearpanel.conf <<DOVECOT
# ClearPanel Dovecot configuration
protocols = imap lmtp sieve

mail_location = maildir:$VMAIL_HOME/%d/%n/Maildir
mail_uid = ${VMAIL_UID}
mail_gid = ${VMAIL_GID}
first_valid_uid = ${VMAIL_UID}
last_valid_uid = ${VMAIL_UID}

passdb {
  driver = passwd-file
  args = scheme=SHA512-CRYPT $DOVECOT_PASSWD
}

userdb {
  driver = static
  args = uid=${VMAIL_UID} gid=${VMAIL_GID} home=$VMAIL_HOME/%d/%n
}

service lmtp {
  unix_listener /var/spool/postfix/private/dovecot-lmtp {
    user = postfix
    group = postfix
    mode = 0600
  }
}

service auth {
  unix_listener /var/spool/postfix/private/auth {
    mode = 0660
    user = postfix
    group = postfix
  }
}

namespace inbox {
  inbox = yes
  separator = /
  mailbox Drafts {
    auto = subscribe
    special_use = \\Drafts
  }
  mailbox Sent {
    auto = subscribe
    special_use = \\Sent
  }
  mailbox Trash {
    auto = subscribe
    special_use = \\Trash
  }
  mailbox Junk {
    auto = subscribe
    special_use = \\Junk
  }
  mailbox Archive {
    auto = no
    special_use = \\Archive
  }
}

protocol lmtp {
  mail_plugins = \$mail_plugins sieve
}

plugin {
  sieve = $VMAIL_HOME/%d/%n/.dovecot.sieve
  sieve_before = /etc/dovecot/sieve-before.d/
  sieve_dir = $VMAIL_HOME/%d/%n/sieve
}
DOVECOT
  echo "[✓] Dovecot configured"

  # --- Configure Rspamd ---
  mkdir -p "$RSPAMD_LOCAL_DIR" "$RSPAMD_OVERRIDE_DIR"

  # Rspamd DKIM signing
  cat >"$RSPAMD_LOCAL_DIR/dkim_signing.conf" <<RSPAMD_DKIM
enabled = true;
allow_username_mismatch = true;
try_fallback = true;
path = "$OPENDKIM_KEYS_DIR/\$domain/\$selector.private";
selector = "default";
RSPAMD_DKIM

  # Rspamd milter headers
  cat >"$RSPAMD_LOCAL_DIR/milter_headers.conf" <<RSPAMD_MILTER
extended_spam_headers = true;
use = ["x-spamd-bar", "x-spam-level", "authentication-results"];
RSPAMD_MILTER

  # ClamAV integration
  cat >"$RSPAMD_LOCAL_DIR/antivirus.conf" <<RSPAMD_AV
clamav {
  action = "reject";
  type = "clamav";
  servers = "/var/run/clamav/clamd.ctl";
  scan_mime_parts = true;
}
RSPAMD_AV
  echo "[✓] Rspamd configured"

  # --- Start/enable services ---
  systemctl enable --now postfix 2>/dev/null || true
  systemctl enable --now dovecot 2>/dev/null || true
  systemctl enable --now rspamd 2>/dev/null || true
  systemctl stop clamav-freshclam 2>/dev/null || true
  freshclam 2>/dev/null || true
  systemctl enable --now clamav-daemon 2>/dev/null || true
  systemctl enable --now clamav-freshclam 2>/dev/null || true
  echo "[✓] All services enabled and started"

  cat >"$STACK_FILE" <<JSON
{
  "installedAt": "$TIMESTAMP",
  "hostname": "$HOSTNAME_VAL",
  "mode": "production",
  "services": ["postfix", "dovecot", "rspamd", "clamav-daemon", "opendkim"],
  "vmailUid": ${VMAIL_UID},
  "vmailGid": ${VMAIL_GID},
  "vmailHome": "$VMAIL_HOME",
  "configDir": "$MAIL_CONFIG_DIR"
}
JSON

  printf '\n=== Mail stack installed and configured at %s ===\n' "$TIMESTAMP"

else
  # --- Development mode (simulation) ---
  cat >"$STACK_FILE" <<JSON
{
  "installedAt": "$TIMESTAMP",
  "hostname": "$HOSTNAME_VAL",
  "mode": "dev",
  "notes": "Simulated mail stack for local development"
}
JSON

  printf 'Mail stack prepared at %s (dev mode)\n' "$STATE_ROOT"
  printf 'Configuration stub written to %s\n' "$STACK_FILE"
fi
