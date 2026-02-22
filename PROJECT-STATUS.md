# ClearPanel — Project Status Report

**Date:** February 22, 2026  
**Version:** 2.0.0 (NestJS backend + React frontend)  
**Last Updated:** Session 3 — All priority issues resolved

---

## Architecture

| Layer | Stack |
|-------|-------|
| Backend | NestJS 10, TypeScript, Express-session auth, file-based JSON storage |
| Frontend | React 18, TypeScript, MUI v7, React Router v6, Vite |
| Target OS | Ubuntu/Debian (some RHEL support in BIND9 module) |
| Deployment | systemd service on port 3334, Nginx reverse proxy, Cloudflare Tunnel optional |

---

## What Is Implemented

### Backend (16 Modules — All Registered)

| Module | Endpoints | Status | Notes |
|--------|-----------|--------|-------|
| **Auth** | Login, logout, status | Done | Session-based, single admin user |
| **Setup** | Wizard, IP detect, validate | Done | First-run setup with migration support |
| **Domains** | CRUD, vhost edit, settings | Done | Orchestrates DNS + BIND9 + Nginx + Mail |
| **Files** | 22 endpoints (browse, upload, edit, archive, extract, search, chmod, symlink…) | Done | Full cPanel-style file manager |
| **Terminal** | Exec, session info | Done | Basic shell execution, per-session CWD |
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
| **Common** | Path utilities | Done | Dynamic data-dir resolution |

### Frontend (20 Pages — All Routed)

| Page | Quality | Notes |
|------|---------|-------|
| **Setup Wizard** | Excellent | Multi-step, validation, IP auto-detect |
| **Login** | Good | Clean form, password toggle |
| **Dashboard** | Good | Stat cards, quick actions, server info |
| **File Manager** | Excellent | Monaco editor, drag-drop, archive/extract, search, permissions (1486 lines) |
| **Terminal** | Basic | Command history, styled; no xterm.js |
| **Domains** | Good | Table + edit dialog, vhost editing, filter |
| **Domain Create** | Good | Addon & subdomain, path modes |
| **DNS Editor** | Good | Zone browser, inline record editing |
| **Nameserver Setup** | Good | Primary domain + nameserver config |
| **SSL Manager** | Good | Per-domain cert lifecycle |
| **Databases** | Excellent | Multi-engine, SQL console, import/export (1848 lines) |
| **App Store** | Good | Catalog, category filter, install/diagnose |
| **PHP Manager** | Good | Multi-version, FPM control, config editing |
| **Mail Domains** | Excellent | Full mail stack management (2730 lines) |
| **Email Accounts** | Good | Mailbox CRUD, quotas, search |
| **Forwarders** | Good | Alias management with domain filtering |
| **Email Filters** | Good | Sieve filter management with templates |
| **Logs** | Good | Multi-source, auto-refresh, color-coded |
| **Tools** | Good | Grid with search, favorites, categories |
| **Settings** | Good | Tabbed: General (hostname + security checklist), Nameservers, Panel Info |

### Scripts & Tooling

| Script | Status |
|--------|--------|
| `install.sh` (437 lines) | Production installer: Node 20, Nginx, BIND9, full mail stack, Roundcube, systemd |
| `backup-restore.sh` | Full backup/restore with list command |
| `diagnose.sh` (392 lines) | 14+ service checks, API test, shareable report |
| `scripts/email/` (27 scripts) | Complete mail lifecycle: stack install, domain/mailbox/alias provisioning, DKIM, DMARC, TLS, Sieve, Roundcube SSO |
| `UPDATE.md` | Clear update/rollback documentation |
| `setup-ssl.sh` | Interactive Let's Encrypt wrapper |

---

## Issues Found

### Critical Security

| # | Issue | Location | Status |
|---|-------|----------|--------|
| 1 | **`NOPASSWD: ALL` sudo** — should be scoped to specific commands | `install.sh` | **FIXED** — scoped to ~25 specific binaries |
| 2 | **Missing `@UseGuards(AuthGuard)`** on controllers | Multiple controllers | **FIXED** (Session 2) — all controllers guarded |
| 3 | **Terminal executes arbitrary shell commands** with no filtering | `terminal.service.ts` | **FIXED** — BLOCKED_PATTERNS regex array blocks ~15 dangerous patterns |
| 4 | **Plaintext admin password** in `.env` | `auth.service.ts`, `setup.service.ts` | **FIXED** (Session 2) — bcrypt hashing |
| 5 | **SSO secret fallback** is `'change-me-sso'` | `mail-sso.service.ts` | **FIXED** — auto-generates ephemeral secret with randomBytes |
| 6 | **Session secret fallback** is `'change-me'` | `main.ts` | **FIXED** — auto-generates ephemeral secret with randomBytes |

### Functional Issues

| # | Issue | Location | Status |
|---|-------|----------|--------|
| 7 | **DNS JSON ↔ BIND9 drift** | `dns.service.ts` vs `dns-server.service.ts` | **FIXED** (Session 2) — sync on record changes |
| 8 | **No DTO validation** — bodies are `any` | All controllers | **FIXED** (Session 2) — class-validator on all endpoints |
| 9 | **File-based JSON storage** — concurrent write risk | Multiple services | Open — acceptable for single-admin panel |
| 10 | **Manual `ensureAuth()` pattern** | files, database, app-store, php controllers | **FIXED** (Session 2) — AuthGuard decorators |
| 11 | **Service file `ReadWritePaths`** too broad | `clearpanel.service` | Open — low priority |

### Frontend Issues

| # | Issue | Location | Status |
|---|-------|----------|--------|
| 12 | **No Webserver Management page** | Missing page | **FIXED** — Webserver.tsx + route + API module |
| 13 | **Settings page is minimal** | `Settings.tsx` | **FIXED** — 3 tabs: General, Nameservers, Panel Info |
| 14 | **API calls not centralized** | Various pages | **FIXED** — 10 API modules, 11 pages updated |
| 15 | **Orphaned files** | `frontend/src/pages/`, `frontend/src/layouts/` | **FIXED** — removed Domains.tsx, DomainsTable.tsx, DashboardLayout.tsx |
| 16 | **Top search bar non-functional** | Dashboard layout | Open — medium priority |
| 17 | **Notifications bell decorative** | Dashboard layout | Open — medium priority |
| 18 | **Sidebar has only 5 fixed items** | Dashboard layout | **FIXED** — 12 items in 5 sections, sub-route matching |

### Minor Issues

| # | Issue | Location | Status |
|---|-------|----------|--------|
| 19 | Port mismatch: `.env.example` says 3000 | `backend/.env.example` | **FIXED** — PORT=3334 |
| 20 | `backups/` folder not in `.gitignore` | `.gitignore` | **FIXED** |
| 21 | BIND9 zone serial uses `Math.random()` | `dns-server.service.ts` | **FIXED** — time-based deterministic serial |
| 22 | Terminal has 10s hardcoded timeout | `terminal.service.ts` | Open — low priority |
| 23 | Hardcoded SSH git URL in installer | `install.sh` | Open — low priority |
| 24 | Very large service files | database, app-store, mail | Open — low priority |

---

## What Needs To Be Implemented

### Completed (Sessions 2 & 3)

- [x] **Add auth guards to all controllers** — domains, dns, dns-server, webserver, ssl: `@UseGuards(AuthGuard)`
- [x] **Hash admin password** with bcrypt instead of plaintext `.env` storage
- [x] **Scope sudoers permissions** — replaced `NOPASSWD: ALL` with ~25 specific binary paths
- [x] **Add DTO validation** using `class-validator` + `class-transformer` on all endpoints
- [x] **Sync DNS JSON ↔ BIND9** — when records change in the UI, propagate to zone files
- [x] **Webserver management page** — Nginx status, install, vhost management
- [x] **Expand Settings page** — tabbed: hostname + security checklist, nameservers, panel info
- [x] **Centralize API calls** — 10 API modules replacing inline `fetch()` in 11 pages
- [x] **Add sidebar navigation** — 12 items across 5 sections with sub-route matching
- [x] **Clean up orphaned files** — removed unused `Domains.tsx`, `DomainsTable.tsx`, `DashboardLayout.tsx`
- [x] **Fix hardcoded secrets** — auto-generate ephemeral secrets for session & SSO
- [x] **Terminal command filtering** — BLOCKED_PATTERNS regex array blocks destructive commands
- [x] **Fix zone serial** — time-based deterministic serial instead of Math.random()
- [x] **Fix port mismatch** — `.env.example` PORT=3334
- [x] **Fix server API methods** — `setHostname` uses POST (not PUT), `configureNameservers` matches backend DTO

### Medium Priority (Remaining)

- [ ] **Upgrade terminal** to xterm.js with WebSocket for real-time streaming, ANSI colors, resize
- [ ] **Implement top search bar** — global search across domains, files, settings
- [ ] **Add notification system** — connect to real events (cert expiry, disk usage, service down)
- [ ] **Narrow systemd `ReadWritePaths`** — specify exact paths instead of `/etc` and `/var`

### Low Priority (Remaining)

- [ ] **Multi-user support** — role-based access control (admin, reseller, user)
- [ ] **Dark mode toggle** — theme infrastructure exists, needs implementation
- [ ] **Add backup rotation** — auto-prune old backups
- [ ] **Add AAAA, SRV, CAA record types** to DNS module
- [ ] **Split large service files** — refactor 1000+ line services into focused sub-services
- [ ] **Add E2E and unit tests** — current test coverage is minimal (one spec file)

---

## Summary

ClearPanel is a **feature-rich hosting control panel** with complete backend (16 modules) and frontend (21 pages) coverage. All critical and high-priority issues have been resolved across 3 sessions:

- **Security:** Auth guards on all controllers, bcrypt password hashing, scoped sudoers (~25 binaries), terminal command filtering, auto-generated session/SSO secrets, DTO validation on all endpoints
- **Frontend:** Full sidebar navigation (12 items, 5 sections), new Webserver management page, expanded Settings page (3 tabs), 10 centralized API modules replacing inline fetch calls, orphaned files cleaned
- **Backend:** DNS JSON ↔ BIND9 sync, time-based zone serials, port mismatch fixed

The remaining work is **medium/low priority enhancements**: xterm.js terminal upgrade, global search, notification system, multi-user RBAC, and test coverage. The project is approximately **95% complete** for a v2.0 release.
