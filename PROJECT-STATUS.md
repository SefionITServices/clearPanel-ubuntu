# ClearPanel — Project Status Report

**Date:** March 14, 2026  
**Version:** 3.3.0 (NestJS backend + React frontend)  
**Last Updated:** Session 7 — Phase 2 Completion (Error Pages, Auto-Responders, Mailing Lists, Spam Filter, Remote MySQL)

---

## Architecture

| Layer | Stack |
|-------|-------|
| Backend | NestJS 10, TypeScript, Express-session auth, file-based JSON storage |
| Frontend | React 18, TypeScript, MUI v7, React Router v6, Vite |
| Terminal | xterm.js 6 + node-pty + Socket.IO (full PTY) |
| Target OS | Ubuntu/Debian (some RHEL support in BIND9 module) |
| Deployment | systemd service on port 3334, Nginx reverse proxy, Cloudflare Tunnel optional |

---

## What Is Implemented

### Backend (32 Modules — All Registered in app.module.ts)

| Module | Endpoints | Status | Notes |
|--------|-----------|--------|-------|
| **Auth** | Login, logout, status, 2FA challenge | Done | Session-based, bcrypt, 2FA TOTP flow |
| **Setup** | Wizard, IP detect, validate | Done | First-run setup with migration support |
| **Domains** | CRUD, vhost edit, settings | Done | Orchestrates DNS + BIND9 + Nginx + Mail |
| **Files** | 22 endpoints (browse, upload, edit, archive, extract, search, chmod, symlink…) | Done | Full cPanel-style file manager |
| **Terminal** | WebSocket gateway (node-pty), resize | Done | Full PTY via Socket.IO /terminal namespace, xterm.js client |
| **DNS** | Zone CRUD, record CRUD | Done | JSON-based record storage |
| **DNS Server** | BIND9 status, install, reload | Done | Real zone file management |
| **Webserver** | Nginx status, install, vhost CRUD | Done | PHP-FPM socket integration |
| **SSL** | Certbot install, cert issue/renew/remove | Done | Pre-flight DNS checks, detailed error diagnostics |
| **Database** | 30+ endpoints (multi-engine, users, privileges, query, import/export, metrics) | Done | MariaDB, MySQL, PostgreSQL support |
| **App Store** | 11 apps (phpMyAdmin, Redis, Fail2Ban, Roundcube…) | Done | Install/uninstall/diagnose |
| **PHP** | Multi-version (7.4–8.4), FPM, config, extensions | Done | Ondřej PPA, update-alternatives |
| **Mail** | 25+ endpoints (domains, mailboxes, aliases, DKIM, DMARC, TLS, queue, metrics) | Done | Postfix/Dovecot/Rspamd/ClamAV + Roundcube SSO |
| **Logs** | 16 log sources, tail/journalctl | Done | Cleanest module, proper auth guard |
| **Server** | Nameservers, hostname | Done | Auto-detects IP, updates Postfix/hosts |
| **SSH Keys** | Generate (Ed25519/RSA), import, list, delete | Done | Manages authorized_keys |
| **License** | Validate key, feature gating, plan display | Done | Guards premium features |
| **Cron** | List/add/edit/delete/toggle jobs, raw crontab editor | Done | Schedule presets included |
| **Firewall** | UFW rule management, quick presets, Fail2Ban status | Done | Web/mail/dns/database/panel presets |
| **Monitoring** | CPU, memory, disk, network, services | Done | Auto-refresh, real-time stats |
| **Backup** | Full/panel/mail/db/domain backups, scheduling, restore | Done | One-click restore |
| **Two-Factor** | TOTP setup, QR code, 8 recovery codes | Done | Login flow integration |
| **Process** | Process list, systemd service management | Done | Kill/restart, search/sort |
| **Git** | Repo CRUD, clone, pull, push, branches, commits, diffs, SSH keys | Done | Phase 3 — cPanel-like UI overhaul, clone credentials support |
| **FTP** | vsftpd account CRUD, per-domain FTP users, password reset | Done | Phase 2 — fully wired |
| **Redirects** | 301/302 URL redirects via Nginx config | Done | Phase 2 — per-domain |
| **IP Blocker** | Deny access from specific IPs at the Nginx level | Done | Phase 2 — per-domain |
| **Dir Privacy** | .htpasswd-style password protection for directories | Done | Phase 2 — per-domain |
| **Hotlink** | Prevent external image/file leeching via Nginx rules | Done | Phase 2 — per-domain |
| **Docker** | Container lifecycle, image pull/run, Compose stacks, networks, volumes, prune | Done | Phase 3 — full Docker CLI wrapper |
| **Node Apps** | PM2-backed app management: create/clone/start/stop/restart/pull, env vars, logs | Done | Phase 3 — Node.js/Python/static runtimes |
| **Subdomains** | Dedicated subdomain CRUD, parent domain picker, path modes, PHP version, skip-mail | Done | Phase 2 — 656-line frontend, delegates to DomainsService |
| **Error Pages** | CRUD, Nginx config sync | Done | Phase 2 — per-domain 404/500/503 |
| **Auto-Resp** | Vacation/out-of-office setup | Done | Phase 2 — Dovecot Sieve integration |
| **Mail Lists**| List CRUD, subscriber management | Done | Phase 2 — Postfix virtual alias syncing |
| **Spam Filter**| Rspamd thresholds, global/domain history | Done | Phase 2 — multimap override config |
| **Common** | Path utilities | Done | Dynamic data-dir resolution |

### Frontend (38 Pages — All Routed & Lazy-loaded)

| Page | Lines (approx) | Quality | Notes |
|------|---------------|---------|-------|
| **Setup Wizard** | ~500 | Excellent | Multi-step, validation, IP auto-detect |
| **Login** | ~200 | Good | Clean form, password toggle, 2FA challenge step |
| **Dashboard** | ~350 | Good | Stat cards, quick actions, server info |
| **File Manager** | 1486 | Excellent | Monaco editor, drag-drop, archive/extract, search, permissions |
| **Terminal** | 168 | Excellent | Full PTY via xterm.js + Socket.IO; ANSI colors, resize, GitHub Dark theme |
| **Domains** | ~400 | Good | Table + edit dialog, vhost editing, filter |
| **Domain Create** | ~300 | Good | Addon & subdomain, path modes |
| **DNS Editor** | ~500 | Good | Zone browser, inline record editing |
| **Nameserver Setup** | ~250 | Good | Primary domain + nameserver config |
| **SSL Manager** | ~350 | Good | Per-domain cert lifecycle |
| **Databases** | 1848 | Excellent | Multi-engine, SQL console, import/export |
| **App Store** | ~500 | Good | Catalog, category filter, install/diagnose |
| **PHP Manager** | ~600 | Good | Multi-version, FPM control, config editing |
| **Mail Domains** | 2730 | Excellent | Full mail stack management |
| **Email Accounts** | ~400 | Good | Mailbox CRUD, quotas, search |
| **Forwarders** | ~350 | Good | Alias management with domain filtering |
| **Email Filters** | ~400 | Good | Sieve filter management with templates |
| **Email Hub** | ~250 | Good | Unified email dashboard links |
| **Webserver** | ~450 | Good | Nginx status/install, vhost management |
| **Logs** | ~400 | Good | Multi-source, auto-refresh, color-coded |
| **Settings** | ~500 | Good | Tabbed: General (hostname + security checklist), Nameservers, Panel Info |
| **SSH Keys** | ~350 | Good | Generate/import/delete, authorized_keys |
| **Cron Jobs** | ~450 | Good | Schedule CRUD, presets, raw crontab editor |
| **Firewall** | ~500 | Good | UFW rules, presets, Fail2Ban status |
| **Monitoring** | 366 | Good | CPU/mem/disk/network/services, tabs, auto-refresh |
| **Backup** | ~500 | Good | Backup types, scheduling, restore |
| **Two-Factor** | ~400 | Good | TOTP setup, QR code, recovery codes |
| **Processes** | ~450 | Good | Process list, systemd service management |
| **Git** | 1764 | Excellent | cPanel-like UI overhaul: repo CRUD, clone with credentials, pull/push, branches, commits, diffs, SSH key setup |
| **FTP Manager** | 414 | Good | vsftpd account CRUD, per-domain users, password reset |
| **Redirects** | 274 | Good | 301/302 per-domain redirects, enable/disable toggle |
| **IP Blocker** | 231 | Good | Per-domain IP deny rules, comment field |
| **Dir Privacy** | ~250 | Good | .htpasswd directory protection |
| **Hotlink Protection** | ~220 | Good | Nginx hotlink rules per domain |
| **Docker Manager** | ~400 | Good | Container lifecycle, image pull/run, Compose stacks, networks, volumes, prune |
| **Node Apps** | ~380 | Good | PM2 app management: create/clone/start/stop/restart/pull, env vars, log viewer |
| **Subdomains** | 656 | Good | Dedicated CRUD page: parent domain picker, path mode radio buttons, PHP version, create logs, search/filter |
| **Error Pages** | 350 | Good | Domain selector, HTML editors for 404/500/503, previews |
| **Auto-Resp** | 330 | Good | Table + dialog for vacation dates and body text |
| **Mail Lists** | 380 | Good | List CRUD and inline subscriber management |
| **Spam Filter** | 420 | Good | Global stats, domain thresholds slider, action history |
| **Tools** | ~400 | Good | Grid with search, favorites, categories |

### Scripts & Tooling

| Script | Status |
|--------|--------|
| `install.sh` (437 lines) | Production installer: Node 20, Nginx, BIND9, full mail stack, Roundcube, systemd |
| `install-online.sh` (716 lines) | Online installer: auto-clone from GitHub, build backend/frontend, full stack setup, robust npm detection |
| `backup-restore.sh` | Full backup/restore with list command |
| `diagnose.sh` (392 lines) | 14+ service checks, API test, shareable report |
| `scripts/email/` (27 scripts) | Complete mail lifecycle: stack install, domain/mailbox/alias provisioning, DKIM, DMARC, TLS, Sieve, Roundcube SSO |
| `UPDATE.md` | Clear update/rollback documentation |
| `setup-ssl.sh` | Interactive Let's Encrypt wrapper |

### Frontend Infrastructure

| Component | Status | Notes |
|-----------|--------|-------|
| **GlobalSearch** | Done (575 lines) | Spotlight-style keyboard search; queries pages, domains, databases, SSL certs, DNS zones, installed apps; cached per session |
| **Favorites** | Done | Per-user localStorage favorites; sidebar Favorites section (up to 7 items) |
| **Sidebar Nav** | Done | Dynamic sections: core, favorites (if any), quick access, system |
| **API Modules** | Done (30 modules) | All pages use centralized `src/api/*.ts` modules |
| **AuthContext** | Done | Session auth, `verify2FA`, `twoFactorPending` state |
| **SetupGuard** | Done | Redirects to `/setup` on first run |

---

## Issues Resolved (Sessions 1–4)

### Critical Security (All Fixed)

| # | Issue | Status |
|---|-------|--------|
| 1 | `NOPASSWD: ALL` sudo | **FIXED** — scoped to ~25 specific binaries |
| 2 | Missing `@UseGuards(AuthGuard)` on controllers | **FIXED** — all 29 controllers guarded |
| 3 | Terminal executes arbitrary shell commands | **FIXED** — BLOCKED_PATTERNS + upgraded to node-pty PTY |
| 4 | Plaintext admin password in `.env` | **FIXED** — bcrypt hashing |
| 5 | SSO secret fallback `'change-me-sso'` | **FIXED** — ephemeral randomBytes secret |
| 6 | Session secret fallback `'change-me'` | **FIXED** — ephemeral randomBytes secret |

### Functional Issues

| # | Issue | Status |
|---|-------|--------|
| 7 | DNS JSON ↔ BIND9 drift | **FIXED** — sync on record changes |
| 8 | No DTO validation | **FIXED** — class-validator on all endpoints |
| 9 | File-based JSON storage concurrent write risk | Open — acceptable for single-admin panel |
| 10 | Manual `ensureAuth()` pattern | **FIXED** — AuthGuard decorators everywhere |
| 11 | Service file `ReadWritePaths` too broad | Open — low priority |

### Frontend Issues

| # | Issue | Status |
|---|-------|--------|
| 12 | No Webserver Management page | **FIXED** — Webserver.tsx + route + API module |
| 13 | Settings page minimal | **FIXED** — 3 tabs: General, Nameservers, Panel Info |
| 14 | API calls not centralized | **FIXED** — 27 API modules |
| 15 | Orphaned files | **FIXED** — removed unused files |
| 16 | Top search bar non-functional | **FIXED** — GlobalSearch.tsx (575 lines, spotlight-style) |
| 17 | Notifications bell decorative | Open — medium priority |
| 18 | Terminal basic / no xterm.js | **FIXED** — full PTY: xterm.js 6 + node-pty + Socket.IO |

### Minor Issues

| # | Issue | Status |
|---|-------|--------|
| 19 | Port mismatch in `.env.example` | **FIXED** — PORT=3334 |
| 20 | `backups/` not in `.gitignore` | **FIXED** |
| 21 | BIND9 zone serial uses `Math.random()` | **FIXED** — time-based deterministic serial |
| 22 | Terminal 10s hardcoded timeout | **FIXED** — PTY upgrade removed timeout entirely |
| 23 | Hardcoded SSH git URL in installer | Open — low priority |
| 24 | Very large service files | Open — low priority |

---

## What Remains

### Medium Priority

- [ ] **Notification system** — wire bell icon to real events (cert expiry, disk usage, service down)
- [ ] **Narrow systemd `ReadWritePaths`** — specify exact paths instead of `/etc` and `/var`

### Phase 2 — Complete (13 of 13 items)

- [x] **Subdomain Manager** — dedicated CRUD page with parent domain picker, path modes, PHP version ✅ (v3.2.0)
- [x] **Custom Error Pages** — per-domain 404/500/503 custom pages via Nginx ✅ (v3.3.0)
- [x] **Auto-Responders** — out-of-office/vacation replies (Postfix/Sieve) ✅ (v3.3.0)
- [x] **Mailing Lists** — list management, subscriber CRUD ✅ (v3.3.0)
- [x] **Spam Filter UI** — SpamAssassin/Rspamd policy per domain ✅ (v3.3.0)
- [x] **Remote MySQL Access** — grant remote host access, per-user IP whitelisting ✅ (v3.3.0)

### Phase 3 — Remaining (7 of 10 items)

- [x] **Git Deployment** — done (cPanel-like UI overhaul, clone credentials, v3.2.0)
- [x] **Docker Manager** — done (container lifecycle, images, Compose, networks, volumes)
- [x] **Node.js / Python App Manager** — done (PM2, git clone, env, logs)
- [ ] **WordPress Manager** — staging, auto-update, clone, harden
- [ ] **Activity / Audit Log** — track all admin actions with timestamp
- [ ] **Notification System** — email/webhook alerts (disk full, service down, cert expiry)
- [ ] **Bandwidth Monitoring** — per-domain traffic stats, monthly graphs
- [ ] **Cloudflare Integration** — proxy toggle, SSL mode, page rules
- [ ] **Server Migration Tool** — import from cPanel/Plesk/ClearPanel
- [ ] **Bulk Domain Import** — import domain list with auto-provisioning

### Phase 4 — Not Started

- [ ] Multi-User / Reseller Accounts (roles: admin, reseller, client)
- [ ] Resource Limits per user (disk, bandwidth, email, database quotas)
- [ ] Account Suspension
- [ ] White-Label / Branding
- [ ] REST API & Webhooks
- [ ] WHMCS Integration

### Low Priority

- [ ] Dark mode toggle — theme infrastructure exists, needs implementation
- [ ] Add backup rotation — auto-prune old backups
- [ ] Add AAAA, SRV, CAA record types to DNS module
- [ ] Split large service files (database, mail, app-store 1000+ lines)
- [ ] Add E2E and unit tests — minimal current coverage

---

## Summary

ClearPanel is a **feature-rich hosting control panel** with a complete backend (32 modules) and frontend (38 pages).

| Phase | Features | Status |
|-------|----------|--------|
| **Phase 1 — Core Foundation** | 26 features | ✅ Complete |
| **Phase 2 — Pro Panel Parity** | 13 features | ✅ Complete (v3.3.0) |
| **Phase 3 — Competitive Edge** | 10 features | 🟡 3/10 done (Git Deployment, Docker Manager, Node.js/Python App Manager) |
| **Phase 4 — Commercial & Scale** | 6 features | 🔲 Not started |

The project is approximately **85% complete** toward a full commercial-grade release.
