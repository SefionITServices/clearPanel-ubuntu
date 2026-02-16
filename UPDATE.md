# clearPanel — Update & Maintenance Guide

This guide covers how to safely update clearPanel on a production server without losing any data, configuration, or email setup.

---

## Quick Update (Recommended)

The simplest and safest way to update:

```bash
cd /opt/clearpanel
./update.sh
```

This automatically:
1. Creates a pre-update backup of all data
2. Pulls the latest code from GitHub
3. Installs any new dependencies
4. Rebuilds backend + frontend
5. Restarts the clearPanel service
6. Keeps only the last 5 backups to save disk

**Your data is never touched:** `.env`, setup status, domains, DNS records, mail configuration, email state, SSL certificates, and nginx vhosts are all preserved.

---

## What Gets Updated vs. What's Preserved

| Updated (code) | Preserved (data) |
|----------------|-------------------|
| Backend TypeScript → `dist/` | `.env` (credentials, DATA_DIR, secret) |
| Frontend React → `public/` | `setup-status.json` (wizard state) |
| Shell scripts in `scripts/` | `domains.json`, `dns.json` |
| systemd service file | `server-settings.json` |
| nginx base config | `mail-domains.json`, `mail-automation-history.json` |
| | `mail-state/` (DKIM keys, TLS state, etc.) |
| | `mail-policies/` (per-domain policies) |
| | `/home/<user>/` (all website files) |
| | BIND9 zone files (`/etc/bind/zones/`) |
| | SSL certificates (`/etc/letsencrypt/`) |
| | Nginx domain vhosts |
| | MySQL/PostgreSQL databases |

---

## Backup & Restore

### Create a Manual Backup

```bash
cd /opt/clearpanel
./backup-restore.sh backup
```

Creates a compressed archive at `/opt/clearpanel/backups/clearpanel-backup_<timestamp>.tar.gz` containing:
- `.env`
- All data files (setup-status, domains, DNS, mail config)
- Mail state (DKIM keys, TLS config, postscreen, rate limits)
- Mail policies
- BIND9 zone files
- Nginx site configs
- Let's Encrypt SSL certificates

### List Available Backups

```bash
./backup-restore.sh list
```

### Restore from Backup

```bash
./backup-restore.sh restore /opt/clearpanel/backups/clearpanel-backup_20250101_120000.tar.gz
```

> **Warning:** This will overwrite current data. You'll be prompted for confirmation.

---

## Re-running install.sh (Safe)

If you re-run `install.sh` on an existing installation, it now detects the existing setup and **preserves your data**:

- `.env` is only created if it doesn't exist
- `setup-status.json` is preserved if the wizard already completed
- System packages are reinstalled/updated (safe — won't remove data)
- Backend + frontend are rebuilt

```bash
cd /opt/clearpanel
sudo bash install.sh
```

---

## Rollback After a Bad Update

If an update breaks something:

1. **Check the pre-update backup:**
   ```bash
   ls -la /opt/clearpanel/backups/pre-update_*
   ```

2. **Restore the backup:**
   ```bash
   ./backup-restore.sh restore /opt/clearpanel/backups/pre-update_<timestamp>/
   ```

3. **Or manually revert the code:**
   ```bash
   cd /opt/clearpanel
   git log --oneline -10     # find the last good commit
   git checkout <commit-sha>
   cd backend && npm run build
   cd ../frontend && npm run build
   sudo systemctl restart clearpanel
   ```

---

## Version Checking

After an update, verify the running version:

```bash
cd /opt/clearpanel && git log --oneline -1
sudo systemctl status clearpanel
curl -s http://localhost:3334/api/auth/status | head -5
```

---

## Automated Updates (Optional)

You can set up a cron job for automatic updates:

```bash
# Update every Sunday at 3 AM
0 3 * * 0 cd /opt/clearpanel && ./update.sh >> /var/log/clearpanel-update.log 2>&1
```

> **Note:** For production servers, we recommend manual updates so you can verify changes before applying them.

---

## Data Locations Reference

| Data | Location |
|------|----------|
| Admin credentials | `/opt/clearpanel/backend/.env` |
| Setup state | `$DATA_DIR/setup-status.json` |
| Domain list | `$DATA_DIR/domains.json` |
| DNS records | `$DATA_DIR/dns.json` |
| Server config | `$DATA_DIR/server-settings.json` |
| Mail domains | `$DATA_DIR/mail-domains.json` |
| Mail audit log | `$DATA_DIR/mail-automation-history.json` |
| DKIM keys | `/etc/clearpanel/mail/dkim/` |
| Mail TLS state | `/etc/clearpanel/mail/tls.json` |
| Per-domain mail | `/etc/clearpanel/mail/domains/` |
| Mail policies | `$DATA_DIR/mail-policies/` |
| Website files | `/home/<admin-user>/` |
| DNS zones | `/etc/bind/zones/` |
| SSL certs | `/etc/letsencrypt/` |
| Nginx vhosts | `/etc/nginx/sites-available/` |
| Databases | `/var/lib/mysql/`, `/var/lib/postgresql/` |

`$DATA_DIR` is set in `.env` — typically `/home/<admin>/etc/clearpanel/`.
