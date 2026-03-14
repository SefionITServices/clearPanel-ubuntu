# Changelog

All notable changes to ClearPanel are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/).

---

## [3.3.0] — 2026-03-14

### Added — Phase 2 Completion (5 new features)
- **Custom Error Pages** — per-domain 404, 500, and 503 custom HTML error pages injected directly into Nginx configs.
- **Auto-Responders** — full support for out-of-office/vacation replies using Dovecot Sieve scripts, configurable per mailbox.
- **Mailing Lists** — create list addresses that distribute emails to multiple subscribers via tracked Postfix virtual aliases.
- **Spam Filter UI** — dedicated interface tying into Rspamd's JSON API for displaying global stats, latest scan history, and configuring per-domain reject/add-header thresholds.
- **Remote MySQL Access** — added definitive UI to the Databases view to enable globally bound (`0.0.0.0`) configuration and explicit per-user IP whitelist management.

---

## [3.2.0] — 2026-03-08

### Added — Phase 2 Feature (1 new)
- **Subdomain Manager** — dedicated subdomain CRUD page: parent domain picker, 4 path modes (public_html / root / websites / custom), PHP version selector, automation logs on create, search/filter table; backend delegates to DomainsService with `skipMail` flag (SubdomainsModule + Subdomains.tsx, 656 lines)

### Changed
- **Git Deployment** — complete UI overhaul to cPanel-like interface: clone credentials support, improved branch/commit views, auto-clean partial clone leftovers, `deploy()` uses promisified execFile
- **Domain Create** — removed nameservers override textarea and subdomain field (subdomains now handled by dedicated page)
- **Installer scripts** (`install.sh`, `install-online.sh`) — robust npm detection: clean old nodejs/npm before NodeSource install, `hash -r` after install, explicit `$NPM` path resolution, `env PATH=` passthrough under `sudo -u`
- **Roundcube** — moved out of main installer into App Store / Email module install (configurable domain dialog)
- Backend now registers 32 NestJS modules; frontend now has 38 lazy-loaded pages; 30 API modules

---

## [3.1.0] — 2026-03-01

### Added — Phase 3 Features (2 new)
- **Docker Manager** — full container lifecycle (start/stop/restart/remove), image pull & list, run new containers, Compose stack management (create YAML, up/down), networks & volumes view, system prune (DockerModule + Docker.tsx)
- **Node.js / Python App Manager** — PM2-backed process management: create/clone-from-git/edit apps, start/stop/restart, pull & restart, env vars editor, live log viewer, supports `node`, `python`, and `static` runtimes; auto-runs `npm install` / `pip install` on start (NodeAppsModule + NodeApps.tsx)

### Changed
- Backend now registers 31 NestJS modules; frontend now has 37 lazy-loaded pages
- Docker Manager and App Manager added to Tools catalog, sidebar favorites map, and App.tsx routes
- ROADMAP updated: Phase 3 now 3/10 complete

---

## [3.0.0] — 2026-03-01

### Added — Phase 2 Features (5 new)
- **FTP Account Manager** — vsftpd account CRUD, per-domain FTP users, password reset (FtpModule + FtpManager.tsx, 414 lines)
- **Directory Privacy** — .htpasswd-style password-protect directories per domain (DirPrivacyModule + DirPrivacy.tsx)
- **Hotlink Protection** — Nginx rules to prevent external image/file leeching (HotlinkModule + HotlinkProtection.tsx)
- **Redirect Manager** — 301/302 per-domain URL redirects via Nginx config, enable/disable toggle (RedirectsModule + Redirects.tsx)
- **IP Blocker** — deny access from specific IPs at the Nginx level per domain, with comment field (IpBlockerModule + IpBlocker.tsx)

### Added — Phase 3 Features (1 new)
- **Git Deployment** — full git workflow: repo clone/pull/push, branch management, commit history with diffs, SSH deploy key setup (GitModule + Git.tsx, 950 lines)

### Added — Frontend Infrastructure
- **GlobalSearch** — spotlight-style keyboard search (575 lines); queries pages, domains, databases, SSL certs, DNS zones, and installed apps; cached per session; integrated into dashboard AppBar
- **Favorites system** — per-user localStorage favorites, surfaced as sidebar Favorites section (up to 7 items)

### Changed
- **Terminal** — fully upgraded from basic command execution to full PTY: xterm.js 6 + node-pty + Socket.IO `/terminal` namespace; ANSI colors, resize via ResizeObserver, GitHub Dark theme, WebLinks addon; backend TerminalGateway verifies session before spawning PTY
- **API modules** — expanded from 10 to 27 centralized modules covering all pages
- All 8 new frontend pages wired into `App.tsx` routes, sidebar favorites map, `Tools` page catalog

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
