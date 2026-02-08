# themasjidapp.com SSL + DNS Fix Report

Date: 2026-02-07
Server IP: 72.61.7.15

## Summary
SSL issuance failed because the domain’s authoritative nameservers could not be resolved. The root cause was a broken BIND zone configuration for `mainserver.in`, which made `ns1.mainserver.in` / `ns2.mainserver.in` return `SERVFAIL`. I corrected the BIND configuration, aligned the `themasjidapp.com` zone NS/SOA to the `mainserver.in` nameservers, reloaded BIND, and then successfully issued and deployed the Let’s Encrypt certificate with certbot.

## Root Cause
1. `themasjidapp.com` was delegated to `ns1.mainserver.in` and `ns2.mainserver.in`.
2. The BIND zone for `mainserver.in` was not loading because `/etc/bind/named.conf.local` pointed to an empty zone file:
   - Config pointed to: `/etc/bind/zones/mainserver.in.db`
   - Correct zone file created by clearPanel: `/etc/bind/zones/db.mainserver.in`
3. Because the zone didn’t load, public resolvers could not resolve the nameserver hostnames, and Let’s Encrypt returned `SERVFAIL`.

## Fixes Applied (System)

### 1) Corrected BIND zone file path for `mainserver.in`
**File updated**
- `/etc/bind/named.conf.local`

**Change**
- From: `file "/etc/bind/zones/mainserver.in.db";`
- To:   `file "/etc/bind/zones/db.mainserver.in";`

This made BIND load the actual zone file that contains the `ns1`/`ns2` records.

### 2) Aligned `themasjidapp.com` zone SOA/NS with branded nameservers
**File updated**
- `/etc/bind/zones/db.themasjidapp.com`

**Changes**
- SOA changed to `ns1.mainserver.in.`
- NS records changed to:
  - `ns1.mainserver.in.`
  - `ns2.mainserver.in.`
- Serial bumped from `2026020796` to `2026020797`

This ensures `themasjidapp.com` is actually served by the intended nameservers.

### 3) Reloaded BIND (named)
Reloaded named using `pkill -HUP named` (service restart was not available from the sandbox).

### 4) Issued and deployed SSL certificate
- Certbot command: `certbot --nginx -d themasjidapp.com -d www.themasjidapp.com`
- Result: success
- Cert paths:
  - `/etc/letsencrypt/live/themasjidapp.com/fullchain.pem`
  - `/etc/letsencrypt/live/themasjidapp.com/privkey.pem`
- Expiry: 2026-05-08
- Nginx vhost updated: `/etc/nginx/sites-enabled/themasjidapp.com`

## Verification
- Public DNS now resolves:
  - `ns1.mainserver.in` → `72.61.7.15`
  - `themasjidapp.com` → `72.61.7.15`
  - `www.themasjidapp.com` → `72.61.7.15`
- `nginx -t` passed and nginx reloaded successfully.

## clearPanel Findings (What Was Missing)

### 1) Domain creation ignores global nameserver settings
`server-settings.json` correctly defines the branded nameservers:
- `/opt/clearpanel/backend/server-settings.json`
  - `primaryDomain: "mainserver.in"`
  - `nameservers: ["ns1.mainserver.in", "ns2.mainserver.in"]`

But `addDomain()` does not use these defaults when no custom nameservers are provided. It falls back to `ns1.{domain}` / `ns2.{domain}` instead:
- `/opt/clearpanel/backend/src/domains/domains.service.ts`
  - `customNameservers` only
  - No fallback to `serverSettingsService.getSettings().nameservers`

This is why `dns.json` for `themasjidapp.com` had:
- `ns1.themasjidapp.com`
- `ns2.themasjidapp.com`

This mismatch caused confusion and made the zone inconsistent with the registrar delegation.

### 2) `DOMAINS_ROOT` from `.env` is not applied
`DOMAINS_ROOT` is set in `/opt/clearpanel/backend/.env`:
- `DOMAINS_ROOT=/opt/clearpanel/data/domains`

But the default is computed at import time:
- `/opt/clearpanel/backend/src/domains/domains.service.ts`
  - `const DOMAINS_ROOT = process.env.DOMAINS_ROOT || ...`

`process.env` isn’t populated by `ConfigModule` yet at import time, so it falls back to:
- `~/clearpanel-domains` → `/opt/clearpanel/clearpanel-domains`

This is why domains are being created under `/opt/clearpanel/clearpanel-domains` instead of `/opt/clearpanel/data/domains`.

## Recommendations for clearPanel (Code Changes)

### A) Use global nameserver defaults when creating a domain (Applied)
**File updated**
- `/opt/clearpanel/backend/src/domains/domains.service.ts`

**Change**
- If `customNameservers` is empty, use `serverSettingsService.getSettings().nameservers`
- If still empty, fallback to `ns1.{domain}`, `ns2.{domain}`

### B) Read `DOMAINS_ROOT` at runtime, not at module import (Applied)
**File updated**
- `/opt/clearpanel/backend/src/domains/domains.service.ts`

**Change**
- Compute `domainsRoot` inside `addDomain()` using `process.env.DOMAINS_ROOT` (after `.env` is loaded).

## Current State Snapshot (Important Files)
- `/etc/bind/named.conf.local` → now points to `/etc/bind/zones/db.mainserver.in`
- `/etc/bind/zones/db.mainserver.in` → contains `ns1/ns2` A records
- `/etc/bind/zones/db.themasjidapp.com` → NS/SOA now `ns1.mainserver.in`
- `/opt/clearpanel/backend/server-settings.json` → primaryDomain + nameservers set
- `/opt/clearpanel/backend/dns.json` → still shows `ns1.themasjidapp.com` (needs clearPanel fix or regeneration)

## Notes
- There is an empty file at `/etc/bind/zones/mainserver.in.db` that should be removed once confirmed unused.
- The authoritative BIND zone for `themasjidapp.com` is now correct, but clearPanel’s `dns.json` does not reflect the change.
