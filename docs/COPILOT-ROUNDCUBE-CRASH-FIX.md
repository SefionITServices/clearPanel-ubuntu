# clearPanel Roundcube crash/not-working fix (Copilot guide)

Date: 2026-02-15

## Problem summary
Roundcube was failing during login (HTTP 500) and mail sending was unreliable.

Observed errors:
- `/var/log/roundcube/errors.log.1` showed: `Undefined constant "INTL_IDNA_VARIANT_UTS46"` on `2026-02-12 03:13:57`, `03:16:29`, `03:16:38`, `03:18:40`.
- Same log later showed SMTP errors: `SMTP server does not support authentication` and `STARTTLS failed ... certificate CN ... did not match expected CN='localhost'`.
- Active webmail vhost used PHP 8.2 FPM: `/etc/nginx/sites-available/webmail.mainserver.in` has `fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;`.

## Root cause
Two clearPanel code issues caused this:

1. PHP extension/version mismatch in Roundcube installers  
Files:
- `scripts/email/install-roundcube.sh`
- `install.sh`

Both scripts install generic packages (`php-intl`, `php-mbstring`, etc.) and suppress install failures:
- `... 2>/dev/null || true`

In multi-PHP environments, Roundcube may run on `phpX.Y-fpm` that does not have matching `phpX.Y-intl` enabled. That causes the fatal `INTL_IDNA_VARIANT_UTS46` login crash.

2. Wrong Roundcube SMTP config key  
Files:
- `scripts/email/install-roundcube.sh`
- `install.sh`

Scripts write `smtp_server`, but Roundcube uses `smtp_host`. This leaves defaults in place and can cause SMTP auth/STARTTLS behavior to be wrong for local Postfix submission.

## Required code changes

### 1) Fix `scripts/email/install-roundcube.sh`
Patch goals:
- Detect target PHP-FPM version first (`PHP_VER`).
- Install version-specific PHP packages for that exact version.
- Remove silent failure pattern (`2>/dev/null || true`) for package install.
- Verify `intl` is actually available for that PHP version.
- Write `smtp_host` (not `smtp_server`) and set explicit local TLS behavior.

Implementation outline:

```bash
# detect PHP_VER first (existing logic is fine)

apt-get update -qq
apt-get install -y -qq roundcube roundcube-plugins roundcube-plugins-extra
apt-get install -y -qq \
  "php${PHP_VER}-fpm" \
  "php${PHP_VER}-mbstring" \
  "php${PHP_VER}-xml" \
  "php${PHP_VER}-intl" \
  "php${PHP_VER}-zip" \
  "php${PHP_VER}-gd" \
  "php${PHP_VER}-curl" \
  "php${PHP_VER}-ldap" || {
  echo "ERROR: Failed to install PHP ${PHP_VER} extensions required by Roundcube" >&2
  exit 1
}

phpenmod -v "${PHP_VER}" intl mbstring xml zip gd curl ldap >/dev/null 2>&1 || true

if ! php"${PHP_VER}" -r 'exit(defined("INTL_IDNA_VARIANT_UTS46") ? 0 : 1);'; then
  echo "ERROR: php${PHP_VER}-intl is missing/not enabled; Roundcube login will crash" >&2
  exit 1
fi

# Roundcube config keys (correct key is smtp_host)
# set:
# $config['imap_host'] = ['localhost:143'];
# $config['smtp_host'] = 'tls://localhost';
# $config['smtp_port'] = 587;
# $config['smtp_conn_options'] = ['ssl' => ['verify_peer' => false, 'verify_peer_name' => false, 'allow_self_signed' => true]];
```

Important: keep `systemctl restart "php${PHP_VER}-fpm"` after module changes.

### 2) Fix `install.sh` preinstall section
Current preinstall uses generic PHP meta packages and hides failures in:
- `install.sh` around the Roundcube preinstall block.

Change it to either:
- call a shared helper that installs Roundcube dependencies per PHP version, or
- at minimum install versioned packages for all detected installed FPM versions (8.2/8.3/8.4 as available), and fail loudly on errors.

Also replace `smtp_server` writes with `smtp_host`.

### 3) Improve Roundcube diagnostics in backend
File:
- `backend/src/app-store/app-store.service.ts` (`diagnoseRoundcube()`)

Add checks for:
- detected webmail PHP-FPM socket version from nginx vhost,
- presence of `php${ver}-intl` (or `defined("INTL_IDNA_VARIANT_UTS46")`),
- warn/error if missing.

This prevents reporting "Roundcube OK" while login is actually crashing.

## One-time runtime hotfix (for already-broken servers)
Use these commands immediately on affected hosts:

```bash
PHP_VER=8.2   # replace with the php version in Roundcube vhost fastcgi_pass
sudo apt-get update
sudo apt-get install -y "php${PHP_VER}-intl" "php${PHP_VER}-mbstring" "php${PHP_VER}-xml"
sudo phpenmod -v "${PHP_VER}" intl mbstring xml
sudo systemctl restart "php${PHP_VER}-fpm"
sudo systemctl reload nginx
```

If SMTP still fails, ensure `/etc/roundcube/config.inc.php` uses:
- `$config['smtp_host'] = 'tls://localhost';`
- `$config['smtp_port'] = 587;`
- relaxed local TLS verification via `$config['smtp_conn_options']` (as above).

## Validation checklist
After code changes:

1. Roundcube install path:
```bash
sudo bash scripts/email/install-roundcube.sh webmail.example.com
```

2. Verify intl constant for selected PHP:
```bash
php8.2 -r 'var_dump(defined("INTL_IDNA_VARIANT_UTS46"));'
```
(replace version as needed)

3. Verify nginx vhost PHP socket matches installed extension set:
```bash
grep -R "fastcgi_pass unix:/var/run/php/php" /etc/nginx/sites-available/webmail.*
```

4. Verify no new fatal Roundcube errors during login:
```bash
tail -f /var/log/roundcube/errors.log
```

Expected: no `Undefined constant "INTL_IDNA_VARIANT_UTS46"` and no SMTP STARTTLS/auth errors for normal send flow.
