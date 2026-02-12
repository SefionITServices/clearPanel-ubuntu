# clearPanel Email Suite Implementation

## 1. Objectives
- Deliver a repeatable mail stack (Postfix, Dovecot, Rspamd, ClamAV) that clearPanel can bootstrap with minimal operator effort.
- Provide API-driven CRUD for mail domains, mailboxes, aliases, and DKIM through the NestJS backend.
- Keep the automation idempotent, observable, and runnable from either the HTTP API or the helper shell scripts.
- Document friction points so the frontend and ops teams can extend the system confidently.

## 2. Current Stack Snapshot
| Layer | Component | Notes |
| --- | --- | --- |
| SMTP (25/587) | Postfix 3.8 | Submission service enabled via automation, SASL backed by Dovecot. |
| IMAP/POP3 | Dovecot 2.3 | Virtual Maildir under `/var/vmail`, passwd-file stored at `/etc/clearpanel/mail/users`. |
| Spam/AV | Rspamd 3.8 + ClamAV 1.4 | Configured through `scripts/email/install-stack.sh`; DKIM signing uses Rspamd path/selectors maps. |
| Automation | `scripts/email/*.sh` | Idempotent installers and provisioning scripts invoked via NestJS `MailAutomationService`. |
| Persistence | `mail-domains.json` | Backing store for domains/mailboxes/aliases consumed by `MailService`. |
| API | `MailModule` | REST endpoints for domain + mailbox + alias CRUD and DKIM rotation. |

## 3. Provisioning Flow (Happy Path)
1. Run `install-stack.sh` (via API or shell) to install packages, enable systemd units, and lay down config drop-ins.
2. `provision-domain.sh` writes Postfix/Dovecot/Rspamd maps, generates DKIM keys, and reloads services.
3. `provision-mailbox.sh` hashes passwords, creates Maildir hierarchy, and refreshes Dovecot maps.
4. `provision-alias.sh` appends to Postfix alias maps and reloads.
5. `rotate-dkim.sh` optionally generates a new selector and updates the selectors/paths maps.
6. NestJS stores bookkeeping data in `mail-domains.json` and surfaces DNS hints through `/mail/domains/:id/dns`.
7. Cleanup scripts (`remove-*.sh`) remove file-system state and update hash maps.

## 4. Backend Integration Details
- `MailAutomationService` shells out to the helper scripts, capturing stdout/stderr into structured automation logs.
- `MailService` performs validation, updates `mail-domains.json`, and forwards tasks to the automation layer.
- `ServerSettingsService` (from `server` module) provides server IP and defaults for DNS suggestions.
- `MailController` exposes REST endpoints consumed by the smoke test and upcoming UI.
- Scripts live under the repo root (`scripts/email`). A symlink `backend/scripts -> ../scripts` prevents path resolution issues during runtime packaging.

## 5. Data & Filesystem Layout
- `mail-domains.json` at repo root stores domain objects (domain metadata, mailboxes, aliases, DKIM selector info).
- `mail-automation-history.json` keeps the latest automation outcomes for mail operations (bounded history surfaced via API).
- `/etc/clearpanel/mail/` contains Postfix/Dovecot map files (virtual domains/mailboxes/aliases, passwd-file, DKIM maps).
- `/var/vmail/<domain>/<local-part>/Maildir` holds messages owned by `vmail:vmail` (uid/gid managed by scripts).
- DKIM keys live under `/etc/clearpanel/mail/dkim/keys` with public TXT records in `.../dkim/public`.
- Submission port (587) and IMAPS (993) listen after `install-stack.sh` completes; verification commands are documented in `MAIL-SMOKE-TEST.md`.

## 6. Backend Completion Checklist
### Completed
- [x] Idempotent shell scripts for install/provision/remove flows (`scripts/email`).
- [x] NestJS `MailModule` with CRUD + DKIM rotation endpoints backed by automation logs.
- [x] Submission service enabled with Dovecot SASL (Postfix master.cf managed by automation).
- [x] Documentation updates for smoke testing and shell helper reference (`MAIL-SMOKE-TEST.md`).
- [x] Manual smoke test: install stack → provision domain/mailbox → send authenticated SMTP loopback → verify IMAP retrieval.
- [x] Health/status endpoint exposing Postfix, Dovecot, Rspamd, and queue depth checks.
- [x] Integration tests for MailModule CRUD/status endpoints using Jest + supertest with automation stubs.
- [x] Hardened mailbox password handling (complexity checks + rate limiting on sensitive endpoints).
- [x] Persisted automation history with `/mail/domains/:id/logs` API and bounded on-disk retention for UI consumption.
- [x] Bundle helper shell scripts automatically during install/build (replaces manual symlink requirement).

### Remaining TODOs
- [ ] Implement configuration toggles for ClamAV/Rspamd features (greylisting thresholds, spam cutoff).
- [ ] Prepare rollback routine (restore DKIM keys, map files) for failed provisioning attempts.
- [ ] Coordinate with frontend team to expose domain/mailbox/alias management UI flows.

## 7. Operational Checklist (Runbook)
- Monitor mail queue: `sudo postqueue -p` (alert if messages age > 5 minutes).
- Validate services after changes: `sudo systemctl status postfix dovecot rspamd clamav-daemon`.
- Confirm submission + IMAPS ports listening: `sudo ss -tlnp | grep -E ':(25|587|993)'`.
- Run `sudo rspamadm configtest` and `sudo rspamadm stat` after rule updates.
- Keep `/etc/clearpanel/mail/users` group-owned by `dovecot`; scripts enforce this but double-check after manual edits.
- Back up `/etc/clearpanel/mail` and `/var/vmail` alongside `mail-domains.json`, `mail-automation-history.json`, and DKIM keys before upgrades.

## 8. Roundcube Webmail & SSO
- Roundcube is installed via the App Store (`Email → Roundcube → Install`).
- Backend calls `scripts/email/install-roundcube.sh`, which:
	- Installs Roundcube and PHP-FPM packages.
	- Creates and enables an Nginx vhost for the detected webmail domain (e.g. `webmail.<primaryDomain>`).
- After the packages/vhost are in place, the backend automatically runs `scripts/email/setup-roundcube-sso.sh`:
	- Deploys the `clearpanel_sso` Roundcube plugin.
	- Configures a Dovecot master-user for one-click webmail login from clearPanel.
- The Roundcube diagnostics in the App Store will report:
	- `Roundcube nginx vhost found` when the vhost exists.
	- `No Roundcube nginx vhost configured` if nginx is missing a matching site (usually before install).

## 9. Future Enhancements
- Automated TLS lifecycle (Certbot hooks to reload Postfix/Dovecot, optional wildcard support).
- Outbound reputation safeguards (postscreen, postsrsd, rate limiting, DMARC aggregate reporting).
- Metrics/exporters for Prometheus (Postfix mailq, Dovecot sessions, Rspamd scores).
- UI-driven DNS publishing (push records directly to supported providers instead of manual instructions).

## 10. Next Steps
1. Convert the checklist TODOs into tracked issues with owners and milestones.
2. Wire the new automation history endpoint into the frontend UX.
3. Plan the frontend mail management views to align with the API contract.
4. Schedule another smoke test after remaining backend tasks land to ensure regressions are caught early.
