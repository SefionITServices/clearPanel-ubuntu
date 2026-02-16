# Mail Stack Smoke Test Guide

This runbook walks through a minimal end-to-end verification of the clearPanel mail automation. Execute every step on a staging server with sudo access before rolling changes into production.

## 1. Prerequisites

- clearPanel backend is deployed and reachable at `http://localhost:3000` (adjust when necessary).
- Scripts under `scripts/email/*.sh` are present and executable (`chmod +x scripts/email/*.sh`).
- The helper scripts accept and persist changes only when run with sudo. Keep `scripts/email/hash-password.sh`, `provision-domain.sh`, `provision-mailbox.sh`, and related `remove-*.sh` utilities handy if you prefer shell-based provisioning.
- The staging host can send outbound traffic on SMTP ports 25/587 and IMAP/POP3 ports 993/995 if you plan to complete the email loopback test.
- Use a test domain that you control (e.g. `example.test`) and configure glue/A records to the staging IP ahead of time.

### Shell Helper Quick Reference

| Script | Purpose | Example |
| --- | --- | --- |
| `scripts/email/install-stack.sh` | Install Postfix, Dovecot, Rspamd, ClamAV, and seed configs. | `sudo scripts/email/install-stack.sh` |
| `scripts/email/hash-password.sh` | Generate a SHA512-CRYPT hash for mailbox provisioning. | `scripts/email/hash-password.sh 'TempP@ssw0rd'` |
| `scripts/email/provision-domain.sh` | Register a domain, generate DKIM, and update maps. | `sudo scripts/email/provision-domain.sh example.test rotate$(date +%s)` |
| `scripts/email/provision-mailbox.sh` | Create mailbox directories and update Postfix/Dovecot maps. | `sudo scripts/email/provision-mailbox.sh example.test admin '<HASH>' 1024` |
| `scripts/email/provision-alias.sh` | Map aliases to destinations and rebuild Postfix maps. | `sudo scripts/email/provision-alias.sh example.test support admin@example.test` |
| `scripts/email/rotate-dkim.sh` | Rotate DKIM selectors for an existing domain. | `sudo scripts/email/rotate-dkim.sh example.test newsel$(date +%s)` |
| `scripts/email/remove-*.sh` | Remove aliases, mailboxes, or domains and tidy disk state. | `sudo scripts/email/remove-domain.sh example.test` |

Run every helper with sudo unless otherwise noted. The password hash generator may run unprivileged when `doveadm` or `openssl` is available in the current PATH.

## 2. Install and Initialise the Stack

```bash
sudo scripts/email/install-stack.sh
```

Verify that the services started correctly:

```bash
sudo systemctl status postfix dovecot rspamd | grep -E "Active|Loaded"
sudo ss -tlnp | grep -E ':(25|587|993)' || true
curl -s http://localhost:3000/mail/status | jq
```

## 3. Provision a Mail Domain

```bash
curl -sS -X POST http://localhost:3000/mail/domains \
  -H 'Content-Type: application/json' \
  -d '{"domain":"example.test"}' | jq '.'
```

Key checkpoints:

- `/etc/clearpanel/mail/virtual-mailbox-domains` contains a key-value entry for `example.test` (e.g. `example.test maildir-domain`).
- `/etc/clearpanel/mail/dkim/public/example.test.default.txt` exists.
- `sudo systemctl reload postfix rspamd` shows no errors (already triggered by the script).

## 4. Provision a Mailbox

```bash
curl -sS -X POST http://localhost:3000/mail/domains/<DOMAIN_ID>/mailboxes \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin","password":"TempP@ssw0rd","quotaMb":1024}' | jq '.'
```

Replace `<DOMAIN_ID>` with the `id` field returned in step 3. The backend appends the domain automatically when the email lacks `@`.

Check filesystem state:

- `/var/vmail/example.test/admin/Maildir/` exists and owned by `vmail:vmail`.
- `/etc/clearpanel/mail/users` contains the mailbox entry with a SHA512-CRYPT hash.
- `sudo doveadm user admin@example.test` succeeds.

## 5. Configure an Alias (Optional)

```bash
curl -sS -X POST http://localhost:3000/mail/domains/<DOMAIN_ID>/aliases \
  -H 'Content-Type: application/json' \
  -d '{"source":"support","destination":"admin@example.test"}' | jq '.'
```

Validate `/etc/clearpanel/mail/virtual-aliases` and ensure Postfix map reload succeeded.

## 6. Rotate DKIM Selector (Optional)

```bash
curl -sS -X POST http://localhost:3000/mail/domains/<DOMAIN_ID>/dkim/rotate \
  -H 'Content-Type: application/json' \
  -d '{"selector":"rotation$(date +%s)"}' | jq '.'
```

Confirm that:

- `/etc/clearpanel/mail/dkim/public/example.test.rotation*.txt` exists.
- `rspamadm configtest` reports OK.

## 7. Publish DNS Records

Collect suggested records (SPF, MX, A, DMARC, DKIM):

```bash
curl -sS http://localhost:3000/mail/domains/<DOMAIN_ID>/dns | jq '.'
```

Publish the values with your DNS provider. For DKIM, use the TXT value corresponding to the latest selector.

## 8. SMTP/IMAP Loopback Test

From a workstation, configure an email client:

- Incoming IMAP: `mail.example.test`, port 993, TLS, user `admin@example.test`, password `TempP@ssw0rd`.
- Outgoing SMTP: `mail.example.test`, port 587, STARTTLS, auth required with same credentials.

Send a message from `admin@example.test` to an external mailbox and reply back. Inspect headers for:

- `Authentication-Results` showing `dkim=pass` for your selector.
- SPF/DMARC alignment once DNS propagation completes.

## 9. Clean Up (Optional)

```bash
curl -X DELETE http://localhost:3000/mail/domains/<DOMAIN_ID>/mailboxes/<MAILBOX_ID>
curl -X DELETE http://localhost:3000/mail/domains/<DOMAIN_ID>/aliases/<ALIAS_ID>
curl -X DELETE http://localhost:3000/mail/domains/<DOMAIN_ID>
```

Ensure the corresponding directories and DKIM files are removed.

Alternatively, run the shell helpers (all require sudo):

```bash
sudo scripts/email/remove-alias.sh example.test support
sudo scripts/email/remove-mailbox.sh example.test admin
sudo scripts/email/remove-domain.sh example.test
```

Double-check `/var/vmail`, `/etc/clearpanel/mail/virtual-*`, `/etc/clearpanel/mail/users`, and `/etc/clearpanel/mail/dkim/*` are empty before concluding the test cycle.

## 10. Troubleshooting Tips

- Check `/var/log/mail.log` (Postfix) and `/var/log/dovecot.log` for real-time diagnostics.
- `sudo rspamadm configtest` and `sudo rspamadm stat` help confirm Rspamd status.
- Re-run `sudo scripts/email/install-stack.sh` if service packages become corrupted—it is idempotent.
- Confirm backend automation mode is production on deployed hosts: `grep '^MAIL_MODE=' backend/.env` should show `MAIL_MODE=production`.
- If domains/mailboxes exist in `mail-domains.json` but not in `/etc/clearpanel/mail/*`, run:
  `sudo scripts/email/sync-from-clearpanel-data.sh /path/to/mail-domains.json`
- If outbound lands in spam, run deliverability checks:
  `scripts/email/check-deliverability.sh example.test mail.example.test <server-ip>`
- If Postfix identity is wrong (for example `mydomain` became a TLD like `in`), repair it:
  `sudo scripts/email/fix-postfix-identity.sh mail.example.test`

Document anomalies and update the guide as new edge cases emerge.
