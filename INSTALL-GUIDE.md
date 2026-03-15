# ClearPanel — Installation Guide

> **Platform:** Ubuntu 20.04 / 22.04 / 24.04 (and compatible: Debian, Linux Mint, Zorin OS, Pop!_OS)  
> **Architecture:** x86_64, aarch64/arm64  
> **Minimum Requirements:** 1 GB RAM · 5 GB free disk space · Root or sudo access

---

## Table of Contents

1. [Online Installation (Recommended)](#1-online-installation-recommended)
2. [What Gets Installed](#2-what-gets-installed)
3. [Post-Install Setup](#3-post-install-setup)
4. [Update ClearPanel](#4-update-clearpanel)
5. [Service Management](#5-service-management)
6. [Full Removal](#6-full-removal)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Online Installation (Recommended)

Run this single command on a **fresh Ubuntu VPS** as root or with sudo:

```bash
curl -fsSL https://raw.githubusercontent.com/SefionITServices/clearPanel-ubuntu/main/install-online.sh | sudo bash
```

> **Note:** The installer is fully automated. It performs pre-flight checks for OS, RAM, disk space, and internet connectivity before making any changes.

### What the installer does (15 phases):

| Phase | Action |
|-------|--------|
| 1 | Pre-flight checks (OS, RAM, disk, network) |
| 2 | Installs system packages (git, curl, ufw, acl) |
| 3 | Configures UFW firewall |
| 4 | Creates `clearpanel` service user |
| 5 | Clones ClearPanel from GitHub → `/opt/clearpanel` |
| 6 | Builds backend (NestJS) and frontend (React/Vite) |
| 7 | Creates `.env` with secure random secrets |
| 8 | Registers `clearpanel.service` with systemd |
| 9 | Configures Nginx as reverse proxy |
| 10 | Sets up scoped sudoers permissions |
| 11 | Configures BIND9 DNS server |
| 11b | Installs MySQL database server |
| 12 | Installs mail stack (Postfix, Dovecot, Rspamd, ClamAV, OpenDKIM) |
| 13 | Installs Roundcube webmail with SSO |
| 14 | Configures mail security (Postscreen, DMARC) |
| 15 | Starts ClearPanel and waits for API to respond |

### Firewall ports opened automatically:

| Port | Service |
|------|---------|
| 22 / OpenSSH | SSH access |
| 80 / 443 | HTTP / HTTPS |
| 3334 | ClearPanel panel (internal) |
| 53 TCP/UDP | DNS (BIND9) |
| 25 | SMTP |
| 587 | SMTP Submission |
| 143 | IMAP |
| 993 | IMAPS |
| 4190 | ManageSieve |

---

## 2. What Gets Installed

| Component | Location |
|-----------|---------|
| ClearPanel app | `/opt/clearpanel` |
| Environment config | `/opt/clearpanel/backend/.env` |
| Systemd service | `/etc/systemd/system/clearpanel.service` |
| CLI tool | `/usr/local/bin/clearpanel` |
| Nginx config | `/etc/nginx/sites-available/clearpanel` |
| BIND9 zones | `/etc/bind/zones/` |
| Mail config | `/etc/clearpanel/` |

---

## 3. Post-Install Setup

After the installer completes, open **http://YOUR-SERVER-IP** in your browser.

The **Setup Wizard** will guide you through:
1. Creating your admin account
2. Setting your server hostname and domain
3. Configuring nameservers

### Add SSL (after completing the Setup Wizard):

```bash
sudo certbot --nginx -d your-domain.com
```

---

## 4. Update ClearPanel

Updates pull the latest code, rebuild the backend and frontend, and restart the service. **All user data, domains, email, and configuration are preserved.**

### One-command update (recommended):

```bash
sudo bash /opt/clearpanel/update.sh
```

Or using the CLI:

```bash
sudo clearpanel update
```

### What the update preserves (never touched):

- `.env` file (admin credentials, session secrets)
- `setup-status.json` (setup wizard state)
- `domains.json`, `dns.json`, `server-settings.json`
- `mail-domains.json`, mail state & policies
- `/home/<user>/` website files
- Nginx vhosts, BIND9 zones, TLS certificates
- MySQL / PostgreSQL databases

### Update also automatically:

- Refreshes scoped sudoers to match the latest permissions
- Patches the Nginx config for WebSocket support (if missing)
- Checks and repairs BIND9 syntax errors
- Keeps only the last 5 pre-update backups (saved to `/opt/clearpanel/backups/`)

---

## 5. Service Management

```bash
# Check status
sudo systemctl status clearpanel

# View live logs
sudo journalctl -u clearpanel -f

# Restart
sudo systemctl restart clearpanel

# Stop
sudo systemctl stop clearpanel

# Start
sudo systemctl start clearpanel

# Test backend API
curl http://localhost:3334/api/auth/status
```

---

## 6. Full Removal

### Default removal (safest)

Removes ClearPanel app, service, user, configs, Nginx/BIND9/mail configs, and firewall rules.  
**Keeps** all installed packages and user data (mail, website files, backups).

```bash
sudo bash /opt/clearpanel/uninstall.sh
```

---

### Full removal + delete user data

Also deletes all mail data (`/var/vmail`), website files, and backups.  
> ⚠️ **This is irreversible.** All emails and website files will be permanently deleted.

```bash
sudo bash /opt/clearpanel/uninstall.sh --purge
```

---

### Full removal + purge all packages

Also purges every APT package installed by ClearPanel (Postfix, Dovecot, Nginx, BIND9, Node.js, PHP, MySQL, Roundcube, Rspamd, ClamAV, Certbot, etc.).

```bash
sudo bash /opt/clearpanel/uninstall.sh --remove-pkgs
```

---

### Nuclear wipe (package purge + user data deletion)

Completely reverts the server to a clean state.  
> ⚠️ **Extremely destructive. Cannot be undone.**

```bash
sudo bash /opt/clearpanel/uninstall.sh --purge --remove-pkgs --yes
```

---

### Uninstall flags reference

| Flag | Effect |
|------|--------|
| `--purge` | Also delete mail data, website files, and backups |
| `--remove-pkgs` | Also purge APT packages (Nginx, BIND9, Node.js, PHP, MySQL, etc.) |
| `--keep-nginx` | Don't remove Nginx (other sites use it) |
| `--keep-bind` | Don't remove BIND9 (other zones use it) |
| `--keep-node` | Don't remove Node.js (other apps use it) |
| `--keep-php` | Don't remove PHP (other apps use it) |
| `--keep-mysql` | Don't remove MySQL/MariaDB (other apps use it) |
| `--keep-postgres` | Don't remove PostgreSQL (other apps use it) |
| `--yes` / `-y` | Skip confirmation prompt (for automation) |

**Example: remove packages but keep Nginx and MySQL:**

```bash
sudo bash /opt/clearpanel/uninstall.sh --remove-pkgs --keep-nginx --keep-mysql
```

---

## 7. Troubleshooting

### Panel not accessible after install

```bash
# 1. Check the service is running
sudo systemctl status clearpanel

# 2. Check logs for errors
sudo journalctl -u clearpanel -n 50

# 3. Confirm port 3334 is listening
sudo ss -tulpn | grep 3334

# 4. Check Nginx is running
sudo systemctl status nginx
sudo nginx -t

# 5. Check firewall
sudo ufw status

# 6. Run the built-in diagnostic tool
sudo bash /opt/clearpanel/diagnose.sh
```

### Reinstall after removal

```bash
curl -fsSL https://raw.githubusercontent.com/SefionITServices/clearPanel-ubuntu/main/install-online.sh | sudo bash
```

---

> **GitHub:** [SefionITServices/clearPanel-ubuntu](https://github.com/SefionITServices/clearPanel-ubuntu)
