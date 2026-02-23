# clearPanel — Feature Analysis Document

> **Generated:** February 22, 2026  
> **Source:** Codebase scan (README.md, PROJECT-STATUS.md, ROADMAP.md, CHANGELOG.md, backend/src/, frontend/src/, install.sh, scripts/)  
> **Version analyzed:** v2.1.0

---

## 1. Product Summary

### What It Does

clearPanel is a **web-based hosting control panel** for Ubuntu/Debian Linux VPS servers. It provides a graphical interface to manage all aspects of web hosting: domains, DNS, web server, email, databases, files, SSL certificates, and system services — without requiring command-line expertise.

### Target Audience

- **Solo developers** and indie hackers running their own VPS
- **Small agencies** hosting multiple client websites
- **System administrators** who want cPanel-like features on a self-managed VPS
- **DevOps engineers** who want a lightweight alternative to commercial panels (cPanel, Plesk, hPanel)
- **Technical founders** who need a full hosting stack without per-seat licensing fees

### Technical Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | NestJS 10, TypeScript, Express-session, `bcryptjs`, `class-validator`, `@nestjs/throttler` |
| **Frontend (Panel)** | React 18, TypeScript, MUI v7, React Router v6, Vite, Monaco Editor |
| **DNS Server** | BIND9 (authoritative nameserver) |
| **Web Server** | Nginx with PHP-FPM |
| **Mail Stack** | Postfix + Dovecot + OpenDKIM/DMARC + Rspamd + ClamAV |
| **Database** | MariaDB / MySQL / PostgreSQL |
| **Auth** | Session-based (express-session) with bcrypt + optional TOTP 2FA |
| **Deployment** | systemd service, port 3334, Nginx reverse proxy, Cloudflare Tunnel optional |
| **Target OS** | Ubuntu 20.04+ / Debian (primary), RHEL/AlmaLinux (partial support) |
| **Storage** | JSON file-based (data-dir), no dedicated database for panel itself |

---

## 2. Confirmed Features

> Only features verified in `backend/src/` module directories, `PROJECT-STATUS.md`, `CHANGELOG.md`, or `ROADMAP.md §Phase 1 ✅` are listed here.

---

### 🔐 User Management & Authentication

| Feature | Implementation Evidence |
|---------|------------------------|
| Session-based login / logout | `backend/src/auth/` module; `POST /api/auth/login`, `GET /api/auth/status` |
| bcrypt password hashing | `bcryptjs` in `backend/package.json`; confirmed fixed in PROJECT-STATUS.md |
| Single admin user (credentials in `.env`) | `backend/.env.example`; auth service documented |
| Two-Factor Authentication (TOTP) | `backend/src/two-factor/` module; CHANGELOG v2.1.0; QR code + 8 recovery codes |
| 2FA login challenge flow | Auth controller intercepts login; `twoFactorPending` flag in auth status |
| Setup wizard (first-run) | `backend/src/setup/` module; multi-step, IP auto-detect, admin credential setup |
| Session secret auto-generation | Fixed in PROJECT-STATUS.md — auto-generates ephemeral secret with randomBytes |

---

### 🌐 Domain Management

| Feature | Implementation Evidence |
|---------|------------------------|
| Domain creation (one-click) | `backend/src/domains/` module; `POST /api/domains` |
| Auto folder structure creation | Documented in README + domains.service.ts creates `/DOMAINS_ROOT/domain.com/` |
| Auto Nginx virtual host configuration | `backend/src/webserver/webserver.service.ts`; confirmed in data flow |
| Auto BIND9 DNS zone creation | `backend/src/dns-server/` module; zone files written on domain add |
| Domain deletion with cleanup | `DELETE /api/domains/:domain`; documented in README |
| Addon domains & subdomains | Frontend: `DomainCreate.tsx` — addon & subdomain path modes |
| Domain vhost editing | `CRUD vhost edit` listed in PROJECT-STATUS.md |
| Domain listing with filter | `DomainsListView.tsx` table with filter |

---

### 🖥️ Web Server Management (Nginx)

| Feature | Implementation Evidence |
|---------|------------------------|
| Nginx status and install | `backend/src/webserver/` module |
| Virtual host CRUD | `Webserver.tsx` page; vhost management UI |
| PHP-FPM socket integration | Documented in backend project status |
| Per-domain access/error logs | README: "Per-domain access/error logs" |
| Nginx config viewer | Frontend `Webserver.tsx` — config viewer |

---

### 🔒 SSL Certificate Management

| Feature | Implementation Evidence |
|---------|------------------------|
| Let's Encrypt auto-issue | `backend/src/ssl/` module; `SSLManager` frontend page |
| Custom certificate upload | Documented in CHANGELOG v1.0.0 |
| Certificate renewal | Documented in PROJECT-STATUS.md — `cert issue/renew/remove` |
| Certificate removal | `ssl.service.ts` |
| Pre-flight DNS checks | PROJECT-STATUS.md — "Pre-flight DNS checks, detailed error diagnostics" |
| Per-domain cert lifecycle UI | `SSLManager` page |
| Certbot integration | `backend/src/ssl/` uses Certbot |

---

### 🗂️ File Manager

| Feature | Implementation Evidence |
|---------|------------------------|
| Directory browsing with breadcrumbs | `FileManager.tsx` (1486 lines); `POST /api/files/list` |
| File upload (up to 100MB default) | `multer` in package.json; `MAX_FILE_SIZE=104857600` in `.env.example` |
| File download (single file) | `POST /api/files/download` |
| Folder download as ZIP | `archiver` in package.json; confirmed |
| File creation, rename, delete | 22 endpoints listed in PROJECT-STATUS.md |
| Built-in text editor (Monaco) | `@monaco-editor/react` in frontend/package.json |
| Archive creation | `archiver` + `tar` packages; PROJECT-STATUS.md |
| Archive extraction | `unzipper` package; PROJECT-STATUS.md |
| File search | 22 endpoints include search; PROJECT-STATUS.md |
| File permissions (chmod) | PROJECT-STATUS.md — `chmod` in file manager endpoints |
| Symbolic link creation | PROJECT-STATUS.md — `symlink` in file manager endpoints |
| Drag-and-drop upload | PROJECT-STATUS.md — "drag-drop" in FileManager description |

---

### 🌍 DNS Management

| Feature | Implementation Evidence |
|---------|------------------------|
| DNS zone browser | `backend/src/dns/` module; `DnsEditor.tsx` |
| A record management | README + `GET /api/dns/:domain`, `POST /api/dns` |
| AAAA record management | README: "Edit A, AAAA, CNAME, MX, TXT records"; ROADMAP Phase 1 |
| CNAME record management | Same sources |
| MX record management | Same sources |
| TXT record management | Same sources |
| SRV record management | CHANGELOG v1.0.0: "A, AAAA, CNAME, MX, TXT, SRV, NS" |
| NS record management | Same sources |
| Real-time zone updates | README, DnsServerService reloads BIND9 |
| DNS JSON ↔ BIND9 sync | Fixed in PROJECT-STATUS.md session 2 |
| Inline record editing | PROJECT-STATUS.md: "inline record editing" |

---

### 🔧 DNS Server (BIND9)

| Feature | Implementation Evidence |
|---------|------------------------|
| Authoritative nameserver setup | `backend/src/dns-server/` module |
| Automatic zone file creation | Data flow in README; `DnsServerService` writes `/etc/bind/zones/db.domain` |
| Custom nameservers (ns1/ns2) | README + `NameserverSetup.tsx` page |
| BIND9 install via UI | `POST /api/dns-server/install`; README |
| BIND9 status monitoring | `GET /api/dns-server/status` |
| BIND9 reload via UI | `POST /api/dns-server/reload` |
| Nameserver instructions | `GET /api/dns-server/nameserver-instructions/:domain` |
| Time-based zone serials | Fixed in PROJECT-STATUS.md (deterministic, not Math.random()) |

---

### 📧 Email System

| Feature | Implementation Evidence |
|---------|------------------------|
| Mail domain provisioning | `backend/src/mail/` module (10 sub-files); `MailDomains.tsx` (2730 lines) |
| Email account CRUD with quotas | `EmailAccounts.tsx`; PROJECT-STATUS.md |
| Email forwarders / aliases | `Forwarders.tsx`; PROJECT-STATUS.md |
| Sieve email filters | `EmailFilters.tsx`; `scripts/email/` — Sieve provisioning scripts |
| Unified email hub page | PROJECT-STATUS.md: "Email Hub page" |
| DKIM setup (OpenDKIM) | `scripts/email/` DKIM provisioning; mail module 25+ endpoints |
| DMARC configuration | `scripts/email/` DMARC; PROJECT-STATUS.md |
| TLS mail configuration | PROJECT-STATUS.md: "TLS" in mail endpoints |
| Mail queue management | PROJECT-STATUS.md: "queue" in mail endpoints |
| Mail metrics | PROJECT-STATUS.md: "metrics" in mail endpoints |
| Rspamd spam filtering | PROJECT-STATUS.md: "Rspamd" |
| ClamAV antivirus | PROJECT-STATUS.md: "ClamAV" |
| Roundcube webmail | `scripts/email/` Roundcube SSO; App Store; `mail-sso.service.ts` |
| Roundcube SSO (single sign-on) | PROJECT-STATUS.md: SSO secret auto-generation; `mail-sso.service.ts` |

---

### 🗄️ Database Management

| Feature | Implementation Evidence |
|---------|------------------------|
| MySQL / MariaDB management | `backend/src/database/` module; `Databases.tsx` (1848 lines) |
| PostgreSQL management | PROJECT-STATUS.md: "MariaDB, MySQL, PostgreSQL support" |
| Database CRUD | 30+ endpoints in database module |
| Database user management | PROJECT-STATUS.md: "users" in database endpoints |
| User privilege management | PROJECT-STATUS.md: "privileges" |
| SQL console (query execution) | PROJECT-STATUS.md: "query" in database endpoints |
| Database import/export | PROJECT-STATUS.md: "import/export" in database endpoints |
| Database metrics | PROJECT-STATUS.md: "metrics" |
| phpMyAdmin integration | App Store; `scripts/email/` |

---

### 🖥️ Web Terminal

| Feature | Implementation Evidence |
|---------|------------------------|
| Web-based terminal | `backend/src/terminal/` module; `Terminal.tsx` |
| Command history | PROJECT-STATUS.md: "Command history, styled" |
| Per-session current working directory | PROJECT-STATUS.md: "per-session CWD" |
| Terminal command filtering (security) | PROJECT-STATUS.md: BLOCKED_PATTERNS regex blocks ~15 dangerous patterns |

---

### 🔑 SSH Key Manager

| Feature | Implementation Evidence |
|---------|------------------------|
| SSH key generation (Ed25519 / RSA) | CHANGELOG v2.0.0: "generate Ed25519/RSA keys" |
| Public key import | CHANGELOG v2.0.0: "import public keys" |
| `authorized_keys` management | CHANGELOG v2.0.0: "manage authorized_keys" |

---

### 📦 App Store

| Feature | Implementation Evidence |
|---------|------------------------|
| App catalog with category filter | `AppStore.tsx`; PROJECT-STATUS.md: 11 apps |
| One-click install/uninstall | PROJECT-STATUS.md: "Install/uninstall/diagnose" |
| phpMyAdmin | PROJECT-STATUS.md + CHANGELOG |
| Roundcube Webmail | PROJECT-STATUS.md + CHANGELOG |
| WordPress | CHANGELOG v1.0.0; ROADMAP Phase 1 |
| Redis | PROJECT-STATUS.md: "Redis" in app store |
| Fail2Ban | PROJECT-STATUS.md: "Fail2Ban" in app store |
| App diagnostics | PROJECT-STATUS.md: "diagnose" in app store |

---

### 🐘 PHP Manager

| Feature | Implementation Evidence |
|---------|------------------------|
| Multi-version PHP (7.4 – 8.4) | `backend/src/php/` module; PROJECT-STATUS.md |
| PHP-FPM control | PROJECT-STATUS.md: "FPM control" |
| php.ini editing | PROJECT-STATUS.md: "config editing" |
| PHP extension management | PROJECT-STATUS.md: "extensions" |
| Ondřej PPA + update-alternatives | PROJECT-STATUS.md |
| Recommended version badge | PROJECT-STATUS.md: "recommended badge" |

---

### ⏰ Cron Job Manager

| Feature | Implementation Evidence |
|---------|------------------------|
| Add / edit / delete cron jobs | `backend/src/cron/` module; CHANGELOG v2.1.0 |
| Enable / disable jobs | CHANGELOG v2.1.0: "toggle" |
| Schedule presets | CHANGELOG v2.1.0: "schedule presets" |
| Raw crontab editor | CHANGELOG v2.1.0 |

---

### 🛡️ Firewall Manager

| Feature | Implementation Evidence |
|---------|------------------------|
| UFW rule management | `backend/src/firewall/` module; CHANGELOG v2.1.0 |
| Quick presets (web/mail/dns/db/panel) | CHANGELOG v2.1.0 |
| Fail2Ban status display | CHANGELOG v2.1.0 |

---

### 📊 Resource Monitoring

| Feature | Implementation Evidence |
|---------|------------------------|
| Real-time CPU usage | `backend/src/monitoring/` module; CHANGELOG v2.1.0 |
| Memory usage monitoring | Same |
| Disk usage monitoring | Same |
| Network monitoring | Same |
| Service status monitoring | Same |
| Auto-refresh | CHANGELOG v2.1.0: "auto-refresh" |

---

### 💾 Backup & Restore

| Feature | Implementation Evidence |
|---------|------------------------|
| Full system backup | `backend/src/backup/` module; `backup-restore.sh` |
| Panel-only backup | CHANGELOG v2.1.0: "full/panel/mail/database/domain backups" |
| Mail backup | Same |
| Database backup | Same |
| Domain backup | Same |
| Backup scheduling | CHANGELOG v2.1.0: "scheduling" |
| One-click restore | CHANGELOG v2.1.0 |
| Backup list command | `backup-restore.sh`: "list command" |

---

### ⚙️ Process Manager

| Feature | Implementation Evidence |
|---------|------------------------|
| Running process list | `backend/src/process/` module; CHANGELOG v2.1.0 |
| Process search and sort | CHANGELOG v2.1.0 |
| Kill process | CHANGELOG v2.1.0: "kill" |
| systemd service management (start/stop/restart) | CHANGELOG v2.1.0 |

---

### 📋 System Logs Viewer

| Feature | Implementation Evidence |
|---------|------------------------|
| 16 log sources | `backend/src/logs/` module; PROJECT-STATUS.md |
| Log tail / journalctl | PROJECT-STATUS.md |
| Auto-refresh | PROJECT-STATUS.md: `Logs` — "Good, auto-refresh" |
| Color-coded log display | PROJECT-STATUS.md: "color-coded" |

---

### 🏪 License & Updates

| Feature | Implementation Evidence |
|---------|------------------------|
| License key validation | `backend/src/license/` module; CHANGELOG v2.0.0 |
| Feature gating by plan | CHANGELOG v2.0.0: "feature gating" |
| Plan display | CHANGELOG v2.0.0 |
| Update checker | CHANGELOG v2.0.0: "check for new versions, one-click update" |

---

### 🌐 Connectivity & Networking

| Feature | Implementation Evidence |
|---------|------------------------|
| Direct IP access (VPS public IP) | README: "Direct IP Access" |
| Cloudflare Tunnel support (NAT/CGNAT) | README; `CLOUDFLARE-TUNNEL-INFO.txt`; `cloudflared/` dir |
| Nginx reverse proxy configuration | README; `nginx.conf.example` |
| Nameserver IP auto-detection | `backend/src/server/` module; setup service |
| Hostname management | `backend/src/server/` — `setHostname` endpoint |

---

### 🛠️ Installation & Tooling

| Feature | Implementation Evidence |
|---------|------------------------|
| Automated installer (437-line `install.sh`) | `install.sh` — Node 20, Nginx, BIND9, full mail stack, Roundcube, systemd |
| Scoped sudoers (~25 binaries) | PROJECT-STATUS.md: fixed from `NOPASSWD: ALL` |
| Diagnose script (14+ service checks) | `diagnose.sh` (392 lines) |
| Backup/restore script | `backup-restore.sh` |
| 27 email lifecycle scripts | `scripts/email/` directory |
| SSL setup script | `setup-ssl.sh` |
| systemd service file | `clearpanel.service` |
| Uninstall script | `uninstall.sh` |

---

## 3. Partially Implemented Features

| Feature | Status | Notes |
|---------|--------|-------|
| **Web Terminal** | Partial | Works with command history and CWD tracking, but uses basic shell execution — xterm.js with WebSocket PTY upgrade is planned but not yet in place per PROJECT-STATUS.md |
| **Top Search Bar** | UI only | Visible in dashboard layout but non-functional (PROJECT-STATUS.md: "Open — medium priority") |
| **Notification Bell** | UI only | Decorative in dashboard layout (PROJECT-STATUS.md: "Open — medium priority") |
| **Dark Mode** | Infrastructure only | MUI theme infrastructure exists in React app; PROJECT-STATUS.md: "theme infrastructure exists, needs implementation" |
| **AAAA, SRV, CAA DNS records** | Partial | AAAA and SRV listed in CHANGELOG v1.0.0; CAA and expanded types planned (PROJECT-STATUS.md) |

> **Note (Inferred):** The terminal is described in CHANGELOG v1.0.0 as "xterm.js + node-pty" but PROJECT-STATUS.md §Frontend says "Basic — no xterm.js." This contradiction suggests xterm.js was either attempted then reverted, or not yet fully integrated.

---

## 4. Not Yet Implemented (Hinted in Docs)

> Sourced from `ROADMAP.md §Phase 2, 3, 4`

### Phase 2 — Pro Panel Parity
- FTP Account Manager (vsftpd/ProFTPD)
- Directory Privacy (.htpasswd)
- Hotlink Protection (Nginx rules)
- Subdomain Manager (dedicated CRUD)
- Redirect Manager (301/302 via Nginx)
- Custom Error Pages (per-domain)
- IP Blocker (per-domain, Nginx-level)
- Email Auto-Responders
- Mailing Lists
- Spam Filter UI (SpamAssassin)
- PostgreSQL Manager *(Note: listed as done in PROJECT-STATUS.md — possible discrepancy; verify at implementation level)*
- Remote MySQL Access Management
- Database Import/Export UI *(listed as done in PROJECT-STATUS.md — may already be implemented)*

### Phase 3 — Competitive Edge
- Docker Manager
- Git Deployment (push-to-deploy)
- Node.js / Python App Manager (PM2-style)
- WordPress Manager (staging, clone, harden)
- Activity / Audit Log
- Notification System (email/webhook alerts)
- Bandwidth Monitoring (per-domain traffic)
- Cloudflare Integration UI (DNS proxy toggle)
- Server Migration Tool (import from cPanel/Plesk)
- Bulk Domain Import

### Phase 4 — Commercial & Scale
- Multi-User / Reseller Accounts (RBAC)
- Resource Limits per user
- Account Suspension
- White-Label Branding
- REST API & Webhooks (public API)
- WHMCS Integration module

---

## 5. Competitive Positioning

### What Makes clearPanel Different

1. **Open Source & Self-Hosted** — No monthly per-server licensing fees (unlike cPanel ~$20/mo, Plesk ~$12/mo)
2. **Full Email Stack Included** — Postfix + Dovecot + Rspamd + ClamAV + OpenDKIM + DMARC + Roundcube SSO out of the box
3. **Authoritative DNS Server** — Runs BIND9 as your own nameserver; no need for external DNS providers
4. **Built-In App Store** — One-click installs for phpMyAdmin, Roundcube, WordPress, Redis, Fail2Ban
5. **Multi-Database Support** — MariaDB, MySQL, and PostgreSQL through a single interface
6. **Security-Focused Design** — TOTP 2FA, bcrypt passwords, scoped sudoers, terminal command filtering, DTO validation
7. **Cloudflare Tunnel Integration** — Works behind NAT/CGNAT; home servers and non-standard VPS environments are supported
8. **Modern Tech Stack** — NestJS + React 18 + MUI v7; developer-friendly architecture

### Ubuntu-Focused Advantages

- Installer uses `apt` package management; optimized for Ubuntu 20.04+ / Debian
- Uses Ondřej PPA for multi-version PHP (the standard Ubuntu PHP source)
- systemd service integration for all managed services
- `ufw` firewall management (Ubuntu default)
- BIND9 (Ubuntu packages); Let's Encrypt via Certbot (Ubuntu-native)

---

## 6. Feature List (Marketing-Ready)

### Core Platform
- ✅ Web-based control panel — no SSH expertise required
- ✅ First-run setup wizard with IP auto-detection
- ✅ Secure session authentication with bcrypt + optional TOTP 2FA
- ✅ License system with plan-based feature gating
- ✅ One-click update checker

### Domain & Web Hosting
- ✅ One-click domain creation with automatic folder structure
- ✅ Auto-configured Nginx virtual hosts per domain
- ✅ Addon domains and subdomains
- ✅ Nginx web server management and vhost editing
- ✅ SSL certificates via Let's Encrypt or custom upload

### DNS & Nameservers
- ✅ Built-in BIND9 authoritative DNS server
- ✅ Manage A, AAAA, CNAME, MX, TXT, SRV, NS records
- ✅ Custom nameservers (ns1.yourdomain.com / ns2.yourdomain.com)
- ✅ Automatic zone file provisioning
- ✅ Real-time DNS reload

### Email Suite
- ✅ Full email stack: Postfix + Dovecot + Rspamd + ClamAV
- ✅ DKIM and DMARC setup for deliverability
- ✅ Email account management with quotas
- ✅ Forwarders and aliases
- ✅ Sieve email filters
- ✅ Roundcube webmail with SSO

### Database Management
- ✅ MySQL, MariaDB, and PostgreSQL support
- ✅ Database and user CRUD
- ✅ Privilege management
- ✅ Built-in SQL console
- ✅ Import/export functionality
- ✅ phpMyAdmin integration

### File Management
- ✅ Full-featured file manager with breadcrumb navigation
- ✅ Drag-and-drop file upload (up to 100MB)
- ✅ ZIP/TAR archive creation and extraction
- ✅ Monaco-based code editor (VS Code-grade)
- ✅ File search, chmod, and symbolic links

### Server Tools
- ✅ Web-based terminal with shell access
- ✅ SSH key manager (Ed25519/RSA)
- ✅ PHP multi-version manager (7.4 – 8.4)
- ✅ Cron job manager with schedule presets
- ✅ UFW firewall manager with presets + Fail2Ban status
- ✅ Real-time resource monitoring (CPU, RAM, disk, network)
- ✅ Process manager with systemd service control
- ✅ System logs viewer (16 sources)

### App Store
- ✅ One-click install for: phpMyAdmin, Roundcube, WordPress, Redis, Fail2Ban (and more)

### Backup & Recovery
- ✅ Full server, panel, mail, database, and domain backups
- ✅ Backup scheduling
- ✅ One-click restore

### Connectivity
- ✅ Direct VPS IP access
- ✅ Cloudflare Tunnel support (works behind NAT/CGNAT)
- ✅ Nginx reverse proxy ready
