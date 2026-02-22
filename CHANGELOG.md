# Changelog

All notable changes to ClearPanel are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/).

---

## [2.1.0] — 2026-02-22

### Added — Phase 1 Tier 1 Features
- **Cron Job Manager** — manage crontab entries, add/edit/delete/toggle jobs, raw crontab editor with schedule presets
- **Firewall Manager** — UFW rule management, quick presets (web/mail/dns/database/panel), Fail2Ban status
- **Resource Monitoring** — real-time CPU, memory, disk, network, and service monitoring with auto-refresh
- **Backup & Restore** — full/panel/mail/database/domain backups with scheduling and one-click restore
- **Two-Factor Authentication** — TOTP setup with QR code, 8 recovery codes, login flow integration
- **Process Manager** — process list with search/sort/kill, systemd service management (start/stop/restart)
- All 6 new features wired into app.module.ts, App.tsx routes, sidebar favorites map, and Tools page
- Login page updated with 2FA verification step
- AuthContext extended with `verify2FA` and `twoFactorPending` state

### Changed
- Auth controller now intercepts login for 2FA challenge when enabled
- Auth status endpoint returns `twoFactorPending` flag
- Tools page Backup card now links to `/backup` instead of `/files`

---

## [2.0.1] — 2026-02-22

### Fixed
- Updated all domain references from `clearpanel.io` to `clearpanel.net`

---

## [2.0.0] — 2026-02-22

### Added — Core Systems
- **License System** — license key validation, feature gating, plan display
- **Update Checker** — check for new versions, one-click update
- **Server Migration** — export/import panel configuration
- **Settings Page** — change admin password, server hostname, primary domain
- **SSH Key Manager** — generate Ed25519/RSA keys, import public keys, manage authorized_keys
- **PHP Manager** — multi-version management, extensions, php.ini editing, recommended badge

### Changed
- Installer improved with interactive setup wizard
- Dashboard shows server info, disk, and uptime

---

## [1.0.0] — Initial Release

### Added
- **Authentication** — session-based login with bcrypt password hashing
- **Setup Wizard** — first-run configuration (admin credentials, server IP, domain)
- **Dashboard** — server overview with quick-link cards
- **File Manager** — browse, upload (100MB), download, edit, zip, rename, delete
- **Terminal** — web-based shell (xterm.js + node-pty) with full PTY support
- **Domain Manager** — create/delete domains with auto Nginx vhost and folder structure
- **DNS Zone Editor** — manage A, AAAA, CNAME, MX, TXT, SRV, NS records
- **DNS Server (BIND9)** — run authoritative nameserver, automatic zone provisioning
- **Nameserver Setup** — configure ns1/ns2 glue records
- **Nginx Web Server** — virtual host management, config viewer
- **SSL Certificates** — Let's Encrypt auto-issue and custom certificate upload
- **MySQL/MariaDB** — database & user management
- **Email System** — Postfix + Dovecot + OpenDKIM mail stack
  - Mail domain provisioning
  - Email account CRUD with quotas
  - Forwarders / aliases
  - Sieve email filters
  - Unified email hub page
- **App Store** — one-click install for phpMyAdmin, Roundcube, WordPress
- **System Logs** — access logs, error logs, mail logs viewer
- **Dual Connectivity** — direct IP access or Cloudflare Tunnel for NAT environments
