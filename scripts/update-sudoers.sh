#!/bin/bash
set -e

SERVICE_USER="clearpanel"
TARGET_FILE="/etc/sudoers.d/clearpanel"
TEMP_FILE="/tmp/clearpanel.sudoers.$$.tmp"

cat > "$TEMP_FILE" << 'EOF'
# ClearPanel — scoped sudo permissions
# Package management
clearpanel ALL=(ALL) NOPASSWD: /usr/bin/apt-get, /usr/bin/apt, /usr/bin/apt-cache, /usr/bin/dpkg, /usr/bin/add-apt-repository

# Service management
clearpanel ALL=(ALL) NOPASSWD: /usr/bin/systemctl, /usr/bin/journalctl

# Web server
clearpanel ALL=(ALL) NOPASSWD: /usr/sbin/nginx

# SSL / Certbot
clearpanel ALL=(ALL) NOPASSWD: /usr/bin/certbot, /snap/bin/certbot

# DNS (BIND9)
clearpanel ALL=(ALL) NOPASSWD: /usr/bin/mkdir, /usr/bin/chown, /usr/bin/chmod

# Database engines
clearpanel ALL=(ALL) NOPASSWD: /usr/bin/mysql, /usr/bin/mysqladmin, /usr/bin/mysqldump
clearpanel ALL=(ALL) NOPASSWD: /usr/bin/psql, /usr/bin/pg_dump
clearpanel ALL=(root) NOPASSWD: /usr/bin/sudo -u postgres *

# System configuration
clearpanel ALL=(ALL) NOPASSWD: /usr/bin/hostnamectl, /usr/sbin/postconf
clearpanel ALL=(ALL) NOPASSWD: /usr/bin/tee, /usr/bin/sed, /usr/bin/cat, /usr/bin/grep, /usr/bin/tail, /usr/bin/find, /usr/bin/ls, /usr/bin/rm, /usr/bin/mv, /usr/bin/ln, /usr/bin/test, /usr/bin/echo, /usr/bin/bash, /usr/bin/curl, /usr/bin/ss, /usr/bin/env

# PHP management
clearpanel ALL=(ALL) NOPASSWD: /usr/bin/update-alternatives, /usr/bin/php*

# App store utilities
clearpanel ALL=(ALL) NOPASSWD: /usr/bin/redis-cli, /usr/bin/fail2ban-client, /usr/bin/crontab, /usr/bin/python3
clearpanel ALL=(ALL) NOPASSWD: /usr/pgadmin4/bin/setup-web.sh

# User management
clearpanel ALL=(ALL) NOPASSWD: /usr/sbin/usermod, /usr/sbin/useradd, /usr/sbin/userdel, /usr/sbin/chpasswd
EOF

if [ -f "$TARGET_FILE" ] && cmp -s "$TEMP_FILE" "$TARGET_FILE"; then
  rm -f "$TEMP_FILE"
  exit 0
fi

mv "$TEMP_FILE" "$TARGET_FILE"
chmod 440 "$TARGET_FILE"

if [ -n "$SERVICE_USER" ]; then
  # Validate sudoers file
  if command -v visudo >/dev/null 2>&1; then
    visudo -cf "$TARGET_FILE" >/dev/null
  fi
fi
