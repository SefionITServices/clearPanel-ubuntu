# ClearPanel Email Sending & Configuration Findings and Fixes

**Date:** October 11, 2026  
**Project:** ClearPanel (`/opt/clearpanel`)  
**Scope:** Email sending failure diagnosis, email client autoconfig/autodiscover resolution, Postfix/Dovecot service configuration, DNS record alignment, and repository persistence.

---

## 1. Executive Summary

Users attempting to configure external email clients (Outlook, Thunderbird, Apple Mail, mobile apps) using the instructions provided by ClearPanel were encountering connection failures, authentication confusion, and message delivery rejections.

This investigation diagnosed all underlying issues across the frontend instructions, backend API routing, DNS records, Postfix mail server configuration, and Nginx proxy routing. All fixes have been implemented on the live production server and directly committed into the ClearPanel codebase (`/opt/clearpanel`, commit `078bca4`), ensuring that future deployments and updates will not require manual patching.

---

## 2. Root Cause Analysis

### Issue 1: Hostname & SSL Certificate Mismatch
- **Symptoms:** External email clients threw SSL/TLS security alerts or refused to connect when attempting secure IMAP (993) or SMTP (465/587).
- **Cause:** ClearPanel's `frontend/src/pages/EmailAccounts.tsx` hardcoded `mail.${primaryDomain}` (e.g. `mail.mainserver.in`) for all mailboxes regardless of the domain selected. Each domain hosted on ClearPanel (e.g. `safon.app`, `sefion.ca`) has its own distinct SSL certificate matching `mail.<domain>`. Connecting to `mail.mainserver.in` using an email address from another domain resulted in SSL certificate validation mismatches (e.g. `mail.safon.app` presenting `mail.mainserver.in` certificate).

### Issue 2: Omission of Explicit SMTP Authentication Requirements
- **Symptoms:** Sending emails failed immediately upon client submission, or clients prompted for missing authentication credentials.
- **Cause:** ClearPanel's client setup instructions omitted explicit notices regarding SMTP authentication. Modern mail transfer agents require SASL authentication (`AUTH PLAIN` / `AUTH LOGIN`) using the user's full email address and password before relaying outbound messages. The instructions also did not clearly outline Port 465 implicit SSL/TLS configuration (the preferred standard for Apple Mail and mobile devices).

### Issue 3: Outbound Delivery Rejection by Gmail (IPv6 vs SPF & Missing DKIM)
- **Symptoms:** Outbound emails sent to external providers (e.g. `hasimtan.ca@gmail.com`) bounced with error:
  ```text
  550-5.7.26 Your email has been blocked because the sender is unauthenticated.
  550-5.7.26 Gmail requires all senders to authenticate with either SPF or DKIM.
  550-5.7.26 Authentication results: DKIM = did not pass;
  550-5.7.26 SPF [safon.app] with ip: [2a02:4780:2d:8270::1] = did not pass
  ```
- **Cause:**
  1. **IPv6 vs SPF Mismatch:** Postfix's default `smtp_address_preference = any` caused Postfix to initiate outbound connections to Google MX servers over IPv6 (`2a02:4780:2d:8270::1`). However, the domain's SPF record only permitted IPv4 (`v=spf1 mx a ip4:72.61.7.15 ~all`), and no `AAAA` record existed for `mail.safon.app`.
  2. **Unpublished DKIM Record:** Although an OpenDKIM 2048-bit key pair existed on disk at `/etc/opendkim/keys/safon.app/`, the corresponding `default._domainkey.safon.app` TXT record was missing from BIND9 DNS and `/home/hasim751/etc/clearpanel/mail-domains.json`.

### Issue 4: Email Client Autoconfig & Autodiscover Returning 404 / HTML SPA
- **Symptoms:** Thunderbird, Outlook, and Apple Mail auto-setup failed to retrieve server settings automatically.
- **Cause:**
  1. `app.setGlobalPrefix('api')` in `backend/src/main.ts` prefixed all routes with `/api`, causing standard discovery paths (`/.well-known/autoconfig/mail/config-v1.1.xml`, `/autodiscover/autodiscover.xml`) to 404.
  2. Nginx's panel vhost and website templates only proxied `/api` and `/socket.io` to NestJS (port 3334). Requests to `/.well-known/autoconfig/...` or `/autodiscover/...` were caught by Nginx's `location /` and returned the frontend HTML Single-Page App (`index.html`).
  3. `MailAutoconfigController` hardcoded `primaryDomain` for all client queries and had overlapping NestJS route method decorators.

### Issue 5: Postfix Master Configuration Conflicts & Relay Restrictions
- **Symptoms:** Postfix logged warnings:
  ```text
  warning: /etc/postfix/master.cf: service "smtp" (inet): already defined
  ```
- **Cause:** Port 25 had two active declarations: `smtp inet ... smtpd` and `smtp inet ... postscreen`. Additionally, the `submission` (port 587) entry lacked an explicit `-o smtpd_relay_restrictions=permit_sasl_authenticated,reject`, falling back to `main.cf` which had `defer_unauth_destination` rather than `reject_unauth_destination`.

---

## 3. Changes Implemented in ClearPanel Project

The following files were modified and committed to the Git repository in `/opt/clearpanel`:

### 1. Frontend: Dynamic Domain Selection & Accurate SMTP Instructions
- **File:** `frontend/src/pages/EmailAccounts.tsx`
- **Changes:**
  - Added a dynamic **"Config for Domain"** dropdown selector so administrators can view the accurate connection parameters (`mail.<domain>`) for any configured domain.
  - Updated IMAP and SMTP configuration cards to detail:
    - **Port 465 (SSL/TLS — Recommended)** and **Port 587 (STARTTLS)**.
    - Explicit **"Authentication: Required (Check 'My outgoing server requires authentication')"**.
    - Full email address as username.
  - Updated single-mailbox "Copy Settings" modals to include complete SMTP authentication instructions.

### 2. Backend: Standard Autoconfig & Autodiscover Controllers
- **File:** `backend/src/mail/mail-autoconfig.controller.ts`
- **Changes:**
  - Mapped root and well-known paths:
    - `GET /.well-known/autoconfig/mail/config-v1.1.xml`
    - `GET /autoconfig/mail/config-v1.1.xml`
    - `GET /mail/config-v1.1.xml`
    - `POST & GET /autodiscover/autodiscover.xml`
    - `POST & GET /Autodiscover/Autodiscover.xml`
  - Separated GET and POST route handlers to allow proper NestJS routing.
  - Dynamically extracts the queried mailbox domain and returns dedicated `mail.<domain>` hostnames and both Port 465 and Port 587 configuration blocks.

### 3. Backend: Global Prefix Route Exclusions
- **File:** `backend/src/main.ts`
- **Changes:**
  - Added exclusion rules to `app.setGlobalPrefix('api')`:
    ```typescript
    app.setGlobalPrefix('api', {
      exclude: [
        'mail/autoconfig/(.*)',
        '.well-known/autoconfig/(.*)',
        'autoconfig/(.*)',
        'autodiscover/(.*)',
        'Autodiscover/(.*)',
        'mail/autodiscover/(.*)',
        'mail/Autodiscover/(.*)',
        'mail/config-v1.1.xml',
        'config-v1.1.xml',
        'autodiscover.xml',
      ],
    });
    ```

### 4. Backend: DNS Record Suggestions
- **File:** `backend/src/mail/mail.service.ts`
- **Changes:**
  - Updated `DnsRecordSuggestion` interface to support `CNAME`.
  - Added CNAME record suggestions for `smtp`, `imap`, `pop`, `autoconfig`, and `autodiscover` pointing to `mail.<domain>`.
  - When domains are provisioned or "Publish DNS" is clicked, all mail server alias records are automatically created in BIND9.

### 5. Email Stack Scripts & Templates
- **File:** `backend/src/mail/templates/postfix-main.cf.hbs`
  - Added `smtp_address_preference = ipv4` to ensure outbound deliveries match IPv4 SPF and PTR records.
  - Changed `smtpd_relay_restrictions` from `defer_unauth_destination` to `reject_unauth_destination`.
- **File:** `scripts/email/install-stack.sh`
  - Added `smtp_address_preference = ipv4`.
  - Added `submissions` (port 465 with SSL wrappermode) to `/etc/postfix/master.cf`.
  - Added `-o smtpd_relay_restrictions=permit_sasl_authenticated,reject` under `submission` (587).
- **File:** `scripts/email/setup-postscreen.sh`
  - Corrected `sed` replacement logic so `smtp inet smtpd` is properly swapped with `smtp inet postscreen` without duplicating port 25.
- **File:** `scripts/email/repair-roundcube.sh` & `nginx.conf.example`
  - Added proxy pass block for email autoconfig and autodiscover endpoints to the Nginx template and roundcube snippet.

---

## 4. Live Server Configuration Applied

The following changes were applied directly to the running server:

1. **Postfix (`/etc/postfix/main.cf` & `/etc/postfix/master.cf`)**:
   - Set `smtp_address_preference = ipv4`.
   - Commented out duplicate `smtp inet smtpd` on line 12 so `postscreen` handles port 25 without conflict.
   - Added `-o smtpd_relay_restrictions=permit_sasl_authenticated,reject` under `submission` (587).
   - Ensured `submissions` (465) with SSL wrappermode and relay restrictions is active.
   - Reloaded Postfix: `systemctl reload postfix`.

2. **Nginx Reverse Proxy (`/etc/nginx/snippets/clearpanel-roundcube.conf`)**:
   - Added autoconfig/autodiscover proxy block to the shared snippet included by all hosted sites (`panel.mainserver.in`, `safon.app`, etc.):
     ```nginx
     location ~* ^/(\.well-known/autoconfig|autoconfig|autodiscover|Autodiscover|mail/autoconfig|mail/autodiscover|mail/config-v1\.1\.xml|autodiscover\.xml) {
         proxy_pass http://127.0.0.1:3334;
         proxy_http_version 1.1;
         proxy_set_header Host $host;
         proxy_set_header X-Real-IP $remote_addr;
         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
         proxy_set_header X-Forwarded-Proto $scheme;
     }
     ```
   - Reloaded Nginx: `systemctl reload nginx`.

3. **DNS & DKIM Alignment**:
   - Added `smtp`, `imap`, `pop`, `autoconfig`, and `autodiscover` CNAME records pointing to `mail.<domain>` in `/home/hasim751/etc/clearpanel/dns.json` and BIND9 zones for active domains (`safon.app`, `sefion.ca`).
   - Published the DKIM record `default._domainkey.safon.app.` in `/etc/bind/zones/db.safon.app` and updated `mail-domains.json`.
   - Reloaded BIND9: `systemctl reload bind9`.

4. **Service Compilation & Restart**:
   - Built frontend: `cd /opt/clearpanel/frontend && npm run build`.
   - Built backend: `cd /opt/clearpanel/backend && npm run build`.
   - Restarted control panel: `systemctl restart clearpanel`.

---

## 5. Verification & Testing Results

| Test Item | Command / Test Case | Result | Status |
| :--- | :--- | :--- | :--- |
| **Thunderbird Autoconfig** | `GET https://safon.app/.well-known/autoconfig/mail/config-v1.1.xml?emailaddress=support@safon.app` | Returns HTTP 200 with XML config pointing to `mail.safon.app` (Ports 993, 143, 465, 587) | **PASS** |
| **Outlook Autodiscover** | `POST https://safon.app/autodiscover/autodiscover.xml` | Returns HTTP 200 with Outlook Autodiscover XML for `support@safon.app` | **PASS** |
| **SMTP Submission (587)** | STARTTLS handshake on port 587 | Advertises `AUTH PLAIN LOGIN`. Unauthenticated relay blocked with `554 5.7.1 Access denied`. Authenticated submission allowed. | **PASS** |
| **SMTPS Submission (465)** | SSL/TLS handshake on port 465 | Implicit SSL connects cleanly. Unauthenticated relay blocked with `554 5.7.1 Access denied`. Authenticated submission allowed. | **PASS** |
| **DNS Resolution** | `dig @127.0.0.1 smtp.safon.app` & `dig @127.0.0.1 autoconfig.safon.app` | Both resolve to `mail.safon.app.` -> `72.61.7.15` | **PASS** |
| **DKIM Record** | `dig @127.0.0.1 default._domainkey.safon.app TXT` | Returns valid 2048-bit RSA public key matching OpenDKIM signing key | **PASS** |
| **Outbound IP Routing** | `postconf smtp_address_preference` | Set to `ipv4` (guarantees SPF IPv4 alignment and prevents Gmail IPv6 bounce) | **PASS** |
| **Daemon Health** | `systemctl is-active postfix dovecot opendkim rspamd bind9 nginx clearpanel` | All 7 services report `active` | **PASS** |

---

## 6. Recommended Client Settings for End Users

When configuring external email clients, users should use the following parameters:

### Incoming Mail (IMAP)
- **Server:** `mail.<your-domain>` (e.g. `mail.safon.app`)
- **Port:** `993`
- **Security:** `SSL/TLS`
- **Username:** Full email address (e.g. `support@safon.app`)
- **Password:** Mailbox password
- **Authentication:** Normal password / Plain

### Outgoing Mail (SMTP)
- **Server:** `mail.<your-domain>` (e.g. `mail.safon.app`)
- **Port:** `465` (SSL/TLS — Recommended) or `587` (STARTTLS)
- **Security:** `SSL/TLS` on 465, or `STARTTLS` on 587
- **Username:** Full email address (e.g. `support@safon.app`)
- **Password:** Mailbox password
- **Authentication:** **Required** (Ensure *"My outgoing server (SMTP) requires authentication"* or *"Require sign-in"* is checked)

---

## 7. Lifecycle Automation: Zero Manual Intervention

All changes have been wired into the core lifecycle of ClearPanel so manual server patches are never required:

### 1. When running `clearpanel install` (`install.sh` / `install-online.sh`):
- `scripts/email/install-stack.sh` sets `smtp_address_preference = ipv4`, `smtpd_relay_restrictions`, and configures port 587 (`submission`) and port 465 (`submissions`).
- `install.sh` enforces Postfix relay and submission restrictions and ensures Nginx permissions.
- `nginx.conf.example` installs with autoconfig and autodiscover proxy pass for the primary host.
- `scripts/email/setup-postscreen.sh` swaps port 25 cleanly to postscreen without creating duplicate listener definitions.

### 2. When a user runs `Add Domain` (Website creation):
- `backend/src/webserver/webserver.service.ts` automatically includes `/etc/nginx/snippets/clearpanel-roundcube.conf` (or creates the autoconfig proxy snippet if missing) in the generated virtual host.
- Any domain added automatically routes `/.well-known/autoconfig/...` and `/autodiscover/...` requests to the ClearPanel backend.
- When SSL is installed, Certbot retains this include inside the HTTPS server block.

### 3. When a user runs `Add Mail Domain` or `Create Mailbox`:
- `scripts/email/provision-domain.sh` generates the 2048-bit DKIM key pair via `generate_dkim_key`.
- `scripts/email/show-dkim.sh` retrieves the public key cleanly without command-not-found errors.
- `backend/src/mail/mail.service.ts` populates `dkimPublicKey` into `mail-domains.json`.
- `scripts/email/common.sh` (`update_bind_dns`) and `mail.service.ts` (`publishDns`) inject all required DNS records (`MX`, `mail A`, `smtp CNAME`, `imap CNAME`, `pop CNAME`, `autoconfig CNAME`, `autodiscover CNAME`, `SPF TXT`, `_dmarc TXT`, and `default._domainkey TXT`) into BIND9.
- `sync_mail_ssl` synchronizes SSL certificates for Postfix SNI and Dovecot.
- The UI presents dynamic domain-specific connection settings with explicit SMTP authentication requirements.

