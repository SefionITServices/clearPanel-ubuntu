# ClearPanel Development Roadmap

> **Last updated:** February 22, 2026  
> **Current version:** 2.1.0  
> **Status:** Phase 1 complete, Phase 2 in progress

---

## Overview

ClearPanel is being developed in 4 phases, progressing from core hosting essentials to a fully competitive, commercial-grade control panel.

| Phase | Name | Status | Features |
|-------|------|--------|----------|
| **Phase 1** | Core Foundation | ✅ Complete | 26 features |
| **Phase 2** | Pro Panel Parity | 🔲 Not Started | 13 features |
| **Phase 3** | Competitive Edge | 🔲 Not Started | 10 features |
| **Phase 4** | Commercial & Scale | 🔲 Not Started | 5 features |

---

## Phase 1 — Core Foundation ✅

> **Goal:** A fully functional hosting panel that can manage domains, email, databases, files, and system services out of the box.

### 1.1 Core Infrastructure ✅
- [x] Authentication system (session-based, bcrypt)
- [x] Setup wizard (first-run configuration)
- [x] Dashboard with server overview
- [x] Settings page (change password, server config)
- [x] License / update system

### 1.2 File & Access Management ✅
- [x] File Manager (browse, upload, download, edit, zip)
- [x] Web-based Terminal (xterm.js + node-pty)
- [x] SSH Key Manager (generate, import, manage authorized_keys)

### 1.3 Domain & Web Stack ✅
- [x] Domain Manager (create, delete, vhost auto-config)
- [x] DNS Zone Editor (A, AAAA, CNAME, MX, TXT, SRV, NS)
- [x] DNS Server (BIND9 — authoritative nameserver)
- [x] Nameserver configuration
- [x] Nginx Web Server management
- [x] SSL Certificate Manager (Let's Encrypt / custom)
- [x] PHP Manager (multi-version, extensions, php.ini)

### 1.4 Email Stack ✅
- [x] Mail Domain provisioning (Postfix + Dovecot + OpenDKIM)
- [x] Email Account Manager (create, delete, quota)
- [x] Email Forwarders / Aliases
- [x] Email Filters (Sieve rules)
- [x] Email Hub page (unified email dashboard)

### 1.5 Database ✅
- [x] MySQL / MariaDB database & user management

### 1.6 Apps & Logs ✅
- [x] App Store (phpMyAdmin, Roundcube, WordPress, Node.js apps)
- [x] System Logs viewer (access logs, error logs, mail logs)

### 1.7 System & Security ✅
- [x] Cron Job Manager (schedule, edit, toggle, raw crontab)
- [x] Firewall Manager (UFW rules, presets, Fail2Ban status)
- [x] Resource Monitoring (CPU, memory, disk, network, services)
- [x] Backup & Restore (full/panel/mail/db/domains, scheduling)
- [x] Two-Factor Authentication (TOTP, recovery codes)
- [x] Process Manager (processes, systemd services, kill/restart)

---

## Phase 2 — Pro Panel Parity 🔲

> **Goal:** Match commercial panels (cPanel, Plesk, hPanel) feature-for-feature in areas users expect.

### 2.1 Advanced File Management
- [ ] FTP Account Manager — vsftpd/ProFTPD account CRUD, per-domain FTP users
- [ ] Directory Privacy — .htpasswd-style password protection for directories
- [ ] Hotlink Protection — prevent external image/file leeching via Nginx rules

### 2.2 Advanced Domain Management
- [ ] Subdomain Manager — dedicated subdomain CRUD (separate from main domains)
- [ ] Redirect Manager — 301/302 URL redirects via Nginx config
- [ ] Custom Error Pages — per-domain 404, 500, 503 custom pages
- [ ] IP Blocker (per-domain) — deny access from specific IPs at the Nginx level

### 2.3 Advanced Email
- [ ] Auto-Responders — automatic out-of-office / vacation replies
- [ ] Mailing Lists — list management, subscriber CRUD
- [ ] Spam Filter UI — SpamAssassin policy management, per-domain settings

### 2.4 Advanced Database
- [ ] PostgreSQL Manager — database & user management for PostgreSQL
- [ ] Remote MySQL Access — grant remote host access, per-user IP whitelisting
- [ ] Database Import/Export — upload SQL files, scheduled dumps

---

## Phase 3 — Competitive Edge 🔲

> **Goal:** Features that differentiate ClearPanel from traditional panels and appeal to modern developers.

### 3.1 Developer Tools
- [ ] Docker Manager — container deployment UI, image pull, compose support
- [ ] Git Deployment — push-to-deploy from GitHub/GitLab/Bitbucket repos
- [ ] Node.js / Python App Manager — deploy, manage, auto-restart app processes (PM2-style)
- [ ] WordPress Manager — staging, auto-update, clone, 1-click harden

### 3.2 Operations & Intelligence
- [ ] Activity / Audit Log — track all admin actions with timestamp & detail
- [ ] Notification System — email/webhook alerts on events (disk full, service down, backup fails)
- [ ] Bandwidth Monitoring — per-domain traffic stats, monthly usage graphs
- [ ] Cloudflare Integration — DNS proxy toggle, SSL mode, page rules from panel

### 3.3 Migration
- [ ] Server Migration Tool — import from cPanel, Plesk, or another ClearPanel instance
- [ ] Bulk Domain Import — import domain list with automatic provisioning

---

## Phase 4 — Commercial & Scale 🔲

> **Goal:** Features needed for commercial deployment, reseller hosting, and white-label distribution.

### 4.1 Multi-Tenancy
- [ ] Multi-User / Reseller Accounts — user roles (admin, reseller, client)
- [ ] Resource Limits — disk, bandwidth, email, database quotas per user
- [ ] Account Suspension — suspend/unsuspend user accounts

### 4.2 Branding & API
- [ ] White-Label / Branding — custom logo, colors, panel name, footer
- [ ] REST API & Webhooks — public API for automation, API key management
- [ ] WHMCS Integration — auto-provisioning module for WHMCS billing

---

## Version History

| Version | Date | Milestone |
|---------|------|-----------|
| 2.1.0 | Feb 2026 | Phase 1 complete — 26 features, all Tier 1 |
| 2.0.0 | Feb 2026 | License system, update checker, settings page |
| 1.0.0 | — | Initial release — domains, files, terminal, DNS |

---

## How to Contribute

See [INSTALL.md](INSTALL.md) for development setup. Features are implemented as NestJS backend modules + React frontend pages following the existing patterns in the codebase.

**Architecture:**
- Backend: NestJS 10, TypeScript, REST API at `/api/*`
- Frontend: React 18, MUI v7, React Router, lazy-loaded pages
- Auth: Session-based with optional 2FA TOTP
- Data: JSON files in `DATA_DIR` + system commands (systemctl, ufw, crontab, etc.)
