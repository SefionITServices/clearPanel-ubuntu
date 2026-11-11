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

derive_mydomain() {
  local host="$1"
  local dot_count=0
  local tmp="${host//[^.]}"
  dot_count="${#tmp}"

  # mail.example.com -> example.com
  if (( dot_count >= 2 )); then
    printf '%s\n' "${host#*.}"
    return
  fi

  # example.com -> example.com, localhost -> localhost
  printf '%s\n' "$host"
}

MYDOMAIN_VAL="$(derive_mydomain "$HOSTNAME_VAL")"

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
  chmod 644 "$POSTFIX_VDOMAINS" "$POSTFIX_VMAILBOX" "$POSTFIX_VALIAS" "$DOVECOT_PASSWD" 2>/dev/null || true
  chgrp dovecot "$DOVECOT_PASSWD" 2>/dev/null || true

  # --- Configure Postfix ---
  postconf -e "myhostname = $HOSTNAME_VAL"
  postconf -e "mydomain = $MYDOMAIN_VAL"
  postconf -e "myorigin = \$mydomain"
  postconf -e "inet_interfaces = all"
  postconf -e "inet_protocols = all"
  postconf -e "mydestination = \$myhostname, localhost.\$mydomain, localhost"
  postconf -e "virtual_mailbox_domains = $POSTFIX_VDOMAINS"
  postconf -e "virtual_mailbox_maps = hash:$POSTFIX_VMAILBOX"
  postconf -e "virtual_alias_maps = hash:$POSTFIX_VALIAS"
  postconf -e "virtual_mailbox_base = $VMAIL_HOME"
  postconf -e "virtual_uid_maps = static:${VMAIL_UID}"
  postconf -e "virtual_gid_maps = static:${VMAIL_GID}"
  postconf -e "virtual_transport = lmtp:unix:private/dovecot-lmtp"
  postconf -e "smtpd_tls_security_level = may"
  postconf -e "smtp_tls_security_level = may"
  postconf -e "smtp_address_preference = ipv4"
  postconf -e "smtpd_sasl_auth_enable = yes"
  postconf -e "smtpd_sasl_type = dovecot"
  postconf -e "smtpd_sasl_path = private/auth"
  postconf -e "smtpd_recipient_restrictions = permit_sasl_authenticated,permit_mynetworks,reject_unauth_destination"
  postconf -e "smtpd_relay_restrictions = permit_mynetworks,permit_sasl_authenticated,reject_unauth_destination"
  postconf -e "smtpd_milters = inet:localhost:11332"
  postconf -e "non_smtpd_milters = inet:localhost:11332"
  postconf -e "milter_protocol = 6"
  postconf -e "milter_default_action = accept"
  postconf -e "message_size_limit = 52428800"

  # Enable submission port (587 STARTTLS)
  if ! grep -q "^submission " /etc/postfix/master.cf 2>/dev/null; then
    cat >>/etc/postfix/master.cf <<'MASTER'

submission inet n       -       y       -       -       smtpd
  -o syslog_name=postfix/submission
  -o smtpd_tls_security_level=encrypt
  -o smtpd_sasl_auth_enable=yes
  -o smtpd_tls_auth_only=yes
  -o smtpd_reject_unlisted_recipient=no
  -o smtpd_relay_restrictions=permit_sasl_authenticated,reject
  -o smtpd_recipient_restrictions=permit_sasl_authenticated,reject
  -o milter_macro_daemon_name=ORIGINATING
MASTER
  fi

  # Enable submissions / smtps port (465 SSL/TLS)
  if ! grep -q "^smtps\|^submissions" /etc/postfix/master.cf 2>/dev/null; then
    cat >>/etc/postfix/master.cf <<'MASTER'

submissions inet n       -       y       -       -       smtpd
  -o syslog_name=postfix/submissions
  -o smtpd_tls_wrappermode=yes
  -o smtpd_sasl_auth_enable=yes
  -o smtpd_reject_unlisted_recipient=no
  -o smtpd_relay_restrictions=permit_sasl_authenticated,reject
  -o smtpd_recipient_restrictions=permit_sasl_authenticated,reject
  -o milter_macro_daemon_name=ORIGINATING
MASTER
  fi

  # Build initial hash maps
  postmap "$POSTFIX_VMAILBOX" 2>/dev/null || true
  postmap "$POSTFIX_VALIAS" 2>/dev/null || true
  echo "[✓] Postfix configured"

  # --- Configure Dovecot ---
  # Disable PAM in 10-auth.conf to prevent PAM auth failures and fail2ban bans for virtual users
  sed -i 's/^!include auth-system.conf.ext/#&/' /etc/dovecot/conf.d/10-auth.conf 2>/dev/null || true

  # Disable default mbox mail_location in 10-mail.conf so 10-clearpanel.conf takes precedence
  sed -i 's|^mail_location =.*|#&|' /etc/dovecot/conf.d/10-mail.conf 2>/dev/null || true

  # Deploy ClearPanel virtual user authentication config
  cat >/etc/dovecot/conf.d/10-clearpanel-auth.conf <<'DOVEAUTH'
auth_mechanisms = plain login

passdb {
  driver = passwd-file
  args = scheme=SHA512-CRYPT username_format=%u /etc/clearpanel/mail/dovecot-users
}

userdb {
  driver = passwd-file
  args = username_format=%u /etc/clearpanel/mail/dovecot-users
  default_fields = uid=vmail gid=vmail home=/var/mail/vhosts/%d/%n
}

service auth {
  unix_listener /var/spool/postfix/private/auth {
    mode = 0660
    user = postfix
    group = postfix
  }
  unix_listener auth-userdb {
    mode = 0660
    user = vmail
    group = vmail
  }
}
DOVEAUTH

  cat >/etc/dovecot/conf.d/10-clearpanel.conf <<DOVECOT
# ClearPanel Dovecot configuration
protocols = imap lmtp sieve

mail_location = maildir:$VMAIL_HOME/%d/%n
mail_uid = ${VMAIL_UID}
mail_gid = ${VMAIL_GID}
first_valid_uid = ${VMAIL_UID}
last_valid_uid = ${VMAIL_UID}

service lmtp {
  unix_listener /var/spool/postfix/private/dovecot-lmtp {
    user = postfix
    group = postfix
    mode = 0600
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

  # --- Configure Fail2Ban mail jails (if fail2ban is present) ---
  mkdir -p /etc/fail2ban/jail.d 2>/dev/null || true
  if [ -d /etc/fail2ban/jail.d ]; then
    cat >/etc/fail2ban/jail.d/clearpanel.local <<'F2B'
[DEFAULT]
ignoreip = 127.0.0.1/8 ::1

[proftpd]
enabled = true
port = ftp,ftp-data,ftps,ftps-data
logpath = /var/log/proftpd/proftpd.log
maxretry = 10

[postfix]
enabled = true
port = smtp,465,submission
logpath = /var/log/mail.log
maxretry = 10

[dovecot]
enabled = true
port = pop3,pop3s,imap,imaps,submission,465,sieve
logpath = /var/log/mail.log
maxretry = 10
F2B
    fail2ban-client reload 2>/dev/null || systemctl restart fail2ban 2>/dev/null || true
    echo "[✓] Fail2Ban mail protection configured"
  fi

  # --- Open Firewall Ports for Mail ---
  if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
    for p in 25/tcp 465/tcp 587/tcp 143/tcp 993/tcp 4190/tcp; do
      ufw allow "$p" >/dev/null 2>&1 || true
    done
    echo "[✓] UFW firewall ports opened (25, 465, 587, 143, 993, 4190)"
  fi

  # --- Synchronize existing SSL certs ---
  sync_mail_ssl "" 2>/dev/null || true

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
