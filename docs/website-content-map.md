# clearPanel — Website Content Map

> **Generated:** February 22, 2026  
> **Based on:** docs/feature-analysis.md (verified features only)

---

## 1. Page Structure

```
clearPanel Marketing Website
├── / (Home)
├── /features
├── /pricing
├── /about
├── /docs
├── /contact
├── /privacy
└── /terms
```

---

## 2. Content Sections Per Page

---

### 🏠 Home (`/`)

**Purpose:** Convert VPS owners and system administrators into clearPanel users.

| Section | Content |
|---------|---------|
| **Hero** | Headline + sub-headline + primary CTA + secondary CTA + hero image/animation |
| **Social Proof Bar** | "Built on NestJS + Nginx + BIND9 + Postfix" logo strip |
| **Problem → Solution** | 3-column: "Expensive licenses" / "Complex CLI" / "Vendor lock-in" + how clearPanel solves each |
| **Feature Highlights** | 6 cards: File Manager, DNS Server, Email Suite, Database, App Store, Security |
| **Security Focus** | Dedicated section: TOTP 2FA, bcrypt, scoped sudo, terminal safety, DTO validation |
| **Dual Connectivity** | Split: Direct IP vs Cloudflare Tunnel — "Works anywhere" |
| **Testimonials** | 3 placeholder testimonials (developer, agency, sysadmin persona) |
| **FAQ** | 6–8 common questions |
| **Footer CTA** | "Get Started Free" button + GitHub link |

**Hero Headline Options:**
> "Your VPS. Your Rules. Your Control Panel."  
> Sub: "clearPanel gives you cPanel-grade features without the monthly licensing fees — installed in minutes on any Ubuntu VPS."

---

### ⚡ Features (`/features`)

**Purpose:** Show depth — reassure technical buyers that all the features they need are there.

**Layout:** Tabbed category filter + icon cards grid

| Category Tab | Features Listed |
|-------------|----------------|
| **Domain & Web** | Domain creation, auto Nginx vhost, addon domains, SSL, PHP multi-version |
| **DNS & Nameservers** | BIND9, A/AAAA/CNAME/MX/TXT/SRV records, nameserver setup |
| **Email Suite** | Postfix/Dovecot, DKIM, DMARC, Rspamd, ClamAV, Roundcube SSO |
| **Database** | MySQL/MariaDB/PostgreSQL, SQL console, import/export, phpMyAdmin |
| **File Management** | File manager, Monaco editor, ZIP/TAR, drag-drop upload, chmod, search |
| **Security** | 2FA TOTP, bcrypt auth, UFW firewall, Fail2Ban, terminal filtering |
| **Server Tools** | Terminal, SSH keys, cron jobs, process manager, monitoring, logs |
| **Backup** | Full/mail/db/domain backups, scheduling, restore |
| **App Store** | phpMyAdmin, Roundcube, WordPress, Redis, Fail2Ban |
| **Connectivity** | Direct IP, Cloudflare Tunnel, Nginx reverse proxy |

---

### 💰 Pricing (`/pricing`)

**Purpose:** Simple pricing that demonstrates value over commercial alternatives.

**Tier Design: 3 tiers**

| Tier | Name | Target | Price Suggestion |
|------|------|--------|-----------------|
| **Free** | Community | Self-hosters, learners | $0, open source |
| **Pro** | Pro | Agencies, developers | $X/mo or one-time |
| **Business** | Business | Teams, power users | $Y/mo |

**Feature Comparison Table Columns:** Community / Pro / Business

**Key comparison rows:**
- Domains managed
- Email accounts
- Database engines (MySQL vs MySQL+PostgreSQL)
- PHP versions
- 2FA Authentication
- App Store
- Backup scheduling
- Priority support
- License management
- White-label (Phase 4 roadmap)

> **Note to content author:** Actual pricing is not defined in codebase. The license system and feature gating exist in code. Suggested tiers are placeholders based on competitive positioning.

---

### 🧭 About (`/about`)

**Purpose:** Build trust with technical audience — explain origin, philosophy, team.

| Section | Content |
|---------|---------|
| **Story** | Why clearPanel was built — frustration with expensive cPanel licenses on self-managed VPS |
| **Mission** | "Make professional web hosting automation accessible to every developer" |
| **Philosophy** | Open source, self-hosted, Ubuntu-native, no vendor lock-in |
| **Technical DNA** | NestJS + React 18 + MUI — modern stack, maintainable, TypeScript-first |
| **Roadmap Preview** | Phase 1 complete → Phase 2 → Phase 3 vision |
| **Team / Company** | Sefion IT Services — brief placeholder |

---

### 📖 Docs (`/docs`)

**Purpose:** Documentation hub that links to actual docs in the repository.

| Section | Links |
|---------|-------|
| **Getting Started** | Quick Start, Installation Guide, Setup Wizard |
| **Web Hosting** | Domain Management, Nginx Setup, SSL Certificates, PHP Manager |
| **DNS** | DNS Zone Editor, BIND9 Server, Nameserver Configuration |
| **Email** | Email Stack Overview, Mail Domains, Accounts, Forwarders, Filters, Roundcube |
| **Database** | MySQL/MariaDB, PostgreSQL, phpMyAdmin |
| **Security** | Firewall (UFW), Fail2Ban, 2FA TOTP, SSH Keys |
| **Connectivity** | Direct IP Access, Cloudflare Tunnel |
| **System Tools** | File Manager, Terminal, Cron Jobs, Process Manager, Logs |
| **Backup & Restore** | Backup Types, Scheduling, Restore |
| **Updates** | Update Checker, Uninstall |

---

### 📬 Contact (`/contact`)

**Purpose:** Support requests, partnerships, licensing inquiries.

| Section | Content |
|---------|---------|
| **Contact Form** | Name, Email, Subject (dropdown: Support / Sales / Partnership / General), Message, Submit |
| **Support Note** | "For technical issues, please include your Ubuntu version and clearPanel version" |
| **Community** | GitHub Issues link |
| **Email** | support@clearpanel.net (inferred from brand) |

---

### 📄 Privacy (`/privacy`)

Standard SaaS privacy policy sections:
- What data is collected
- How data is used
- Data storage (self-hosted — no data sent to clearPanel servers)
- Third-party services (Cloudflare Tunnel optional)
- Contact information

---

### 📄 Terms (`/terms`)

Standard terms of service:
- License type (MIT)
- Permitted use
- Prohibited use
- Disclaimer of warranties
- Limitation of liability

---

## 3. Messaging Strategy

### Who Is the Audience?

**Primary:** Developers and sysadmins running Ubuntu VPS servers who manage 1–50 websites and want a GUI control panel without paying $20+/month in licensing fees.

**Secondary:** Freelance agencies and web studios managing client sites who need domain + email + database automation.

**Tertiary:** Technically proficient entrepreneurs who self-host but don't want to use CLI for every operation.

---

### Problem It Solves

| Pain Point | clearPanel Answer |
|-----------|------------------|
| cPanel/Plesk licensing costs $150–$240/year | clearPanel is open source / self-hosted |
| Managing BIND9, Postfix, Nginx via CLI is error-prone | clearPanel automates and validates everything via UI |
| Commercial panels force vendor-specific ecosystems | clearPanel is installed on your VPS, owned by you |
| Setting up email stack (DKIM, DMARC, SPF) is complex | One-click provisioning with best-practice configuration |
| No GUI for database management without phpMyAdmin setup | Built-in multi-engine SQL console + phpMyAdmin in App Store |
| Home/CGNAT servers can't expose ports | Cloudflare Tunnel support built in |

---

### Core Value Proposition

> **"clearPanel gives Ubuntu VPS owners the power of a commercial hosting control panel — with zero licensing fees, full data ownership, and a modern web UI built for today's developers."**

---

### Technical Differentiation

1. **NestJS Backend** — Structured TypeScript API with proper dependency injection, DTO validation, auth guards — not a fragile PHP/bash hybrid
2. **React 18 + MUI v7** — Modern, accessible, responsive frontend; Monaco editor for code files; VS Code-grade experience
3. **Authoritative DNS** — Runs BIND9 on your own VPS, not dependent on Cloudflare, Route53, or your registrar
4. **Complete Email Stack** — Rspamd + ClamAV + DKIM + DMARC + Roundcube SSO — enterprise-grade email out of the box
5. **Multi-DB Support** — MySQL, MariaDB, AND PostgreSQL through one interface
6. **Security by Design** — bcrypt, TOTP 2FA, scoped sudoers, terminal command filtering — not an afterthought
7. **Self-Contained Installer** — Single `install.sh` script that sets up the entire stack on a fresh Ubuntu VPS
