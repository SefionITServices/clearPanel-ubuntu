#!/usr/bin/env bash
# ==========================================================================
# setup-roundcube-sso.sh — Deploy ClearPanel SSO plugin for Roundcube
#
# This script installs a custom Roundcube plugin that validates HMAC-signed
# SSO tokens from ClearPanel, allowing one-click webmail login for mailboxes.
#
# Usage:  ./setup-roundcube-sso.sh <clearpanel-api-url> [sso-secret]
# Example: ./setup-roundcube-sso.sh https://panel.example.com:3000 my-sso-secret
#
# If sso-secret is omitted, it reads SSO_SECRET or SESSION_SECRET from:
#   /opt/clearpanel/.env  (or the parent project .env)
# ==========================================================================
set -euo pipefail

MAIL_MODE="${MAIL_MODE:-production}"

log() { echo "[clearpanel-sso] $*"; }
warn() { echo "[clearpanel-sso] WARN: $*" >&2; }
die() { echo "[clearpanel-sso] ERROR: $*" >&2; exit 1; }

# ── Args ──────────────────────────────────────────────────────────

API_URL="${1:-}"
SSO_SECRET="${2:-}"

if [[ -z "$API_URL" ]]; then
  # Try to auto-detect from environment or default
  API_URL="http://localhost:3000"
  warn "No API URL provided — defaulting to ${API_URL}"
fi

if [[ -z "$SSO_SECRET" ]]; then
  # Try to load from .env
  for envfile in /opt/clearpanel/.env /opt/clearpanel/backend/.env .env ../backend/.env; do
    if [[ -f "$envfile" ]]; then
      SSO_SECRET=$(grep -E '^SSO_SECRET=' "$envfile" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)
      if [[ -z "$SSO_SECRET" ]]; then
        SSO_SECRET=$(grep -E '^SESSION_SECRET=' "$envfile" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)
      fi
      if [[ -n "$SSO_SECRET" ]]; then
        log "Loaded secret from $envfile"
        break
      fi
    fi
  done
fi

if [[ -z "$SSO_SECRET" ]]; then
  die "Could not determine SSO secret. Pass it as second argument or set SSO_SECRET in .env"
fi

# ── Detect Roundcube paths ────────────────────────────────────────

ROUNDCUBE_ROOT=""
for dir in /usr/share/roundcube /var/www/roundcube /var/lib/roundcube; do
  if [[ -d "$dir/plugins" ]]; then
    ROUNDCUBE_ROOT="$dir"
    break
  fi
done

if [[ -z "$ROUNDCUBE_ROOT" ]]; then
  die "Cannot find Roundcube installation (checked /usr/share/roundcube, /var/www/roundcube, /var/lib/roundcube)"
fi

ROUNDCUBE_CONF="/etc/roundcube/config.inc.php"
if [[ ! -f "$ROUNDCUBE_CONF" ]]; then
  ROUNDCUBE_CONF="${ROUNDCUBE_ROOT}/config/config.inc.php"
fi
if [[ ! -f "$ROUNDCUBE_CONF" ]]; then
  die "Cannot find Roundcube config file"
fi

log "Roundcube root:   ${ROUNDCUBE_ROOT}"
log "Roundcube config: ${ROUNDCUBE_CONF}"
log "API URL:          ${API_URL}"

# ── Create plugin directory ───────────────────────────────────────

PLUGIN_DIR="${ROUNDCUBE_ROOT}/plugins/clearpanel_sso"
mkdir -p "$PLUGIN_DIR"

# ── Write plugin PHP files ────────────────────────────────────────

cat > "${PLUGIN_DIR}/clearpanel_sso.php" <<'PLUGIN_PHP'
<?php
/**
 * ClearPanel SSO Plugin for Roundcube
 *
 * Validates HMAC-signed tokens from ClearPanel and auto-logs the user
 * into Roundcube via IMAP credentials retrieved from the ClearPanel API.
 *
 * Token format: <base64url_payload>.<hmac_hex>
 * Payload JSON:  { email, domainId, mailboxId, nonce, exp }
 */
class clearpanel_sso extends rcube_plugin
{
    public $task = 'login';

    private $sso_secret;
    private $api_url;

    function init()
    {
        $this->load_config();
        $rcmail = rcmail::get_instance();
        $this->sso_secret = $rcmail->config->get('clearpanel_sso_secret', '');
        $this->api_url    = $rcmail->config->get('clearpanel_sso_api_url', 'http://localhost:3000');

        // Hook into the login page — check for _sso_token before rendering
        $this->add_hook('startup', array($this, 'check_sso_token'));
    }

    function check_sso_token($args)
    {
        $rcmail = rcmail::get_instance();

        // Only intercept on the login page
        if ($rcmail->task !== 'login' || !empty($_SESSION['user_id'])) {
            return $args;
        }

        $token = rcube_utils::get_input_value('_sso_token', rcube_utils::INPUT_GET);
        if (empty($token)) {
            return $args;
        }

        // ── Validate token locally ────────────────────────────────
        $result = $this->validate_token($token);
        if ($result === false) {
            rcmail::get_instance()->output->show_message('SSO login failed: invalid or expired token', 'error');
            return $args;
        }

        $email = $result['email'];

        // ── Verify the token with ClearPanel API (marks nonce as consumed) ──
        $api_ok = $this->verify_with_api($token);
        if (!$api_ok) {
            rcmail::get_instance()->output->show_message('SSO login failed: token verification failed', 'error');
            return $args;
        }

        // ── Auto-login via IMAP ───────────────────────────────────
        // Roundcube's login mechanism needs the password for IMAP auth.
        // We use a Dovecot master-user approach: Dovecot is configured with a
        // master password that can authenticate as any user.
        // Format: user*masteruser with master password
        $master_user = $rcmail->config->get('clearpanel_sso_master_user', '');
        $master_pass = $rcmail->config->get('clearpanel_sso_master_pass', '');

        if (empty($master_user) || empty($master_pass)) {
            // Fallback: try to log in with a pre-shared SSO password
            // This requires Dovecot to accept this password for any user (passdb override)
            $sso_pass = $rcmail->config->get('clearpanel_sso_password', '');
            if (empty($sso_pass)) {
                rcmail::get_instance()->output->show_message('SSO login failed: master auth not configured', 'error');
                return $args;
            }
            $login_user = $email;
            $login_pass = $sso_pass;
        } else {
            // Dovecot master-user login: user*masteruser + master_password
            $login_user = $email . '*' . $master_user;
            $login_pass = $master_pass;
        }

        $host = $rcmail->config->get('default_host', 'localhost');

        // Perform the actual Roundcube login
        $auth = $rcmail->login($login_user, $login_pass, $host, false);
        if ($auth) {
            // Successful — redirect to mailbox
            $rcmail->session->remove('temp');
            $rcmail->session->set('language', $rcmail->config->get('language', 'en_US'));
            $redir = $rcmail->url(array('_task' => 'mail'));
            header('Location: ' . $redir);
            exit;
        } else {
            rcmail::get_instance()->output->show_message('SSO login failed: IMAP authentication error', 'error');
        }

        return $args;
    }

    /**
     * Validate token signature and expiry locally (without API call).
     */
    private function validate_token($token)
    {
        $dot = strpos($token, '.');
        if ($dot === false) return false;

        $payload_b64 = substr($token, 0, $dot);
        $signature   = substr($token, $dot + 1);

        // Verify HMAC
        $expected = hash_hmac('sha256', $payload_b64, $this->sso_secret);
        if (!hash_equals($expected, $signature)) {
            return false;
        }

        // Decode payload (base64url)
        $json = base64_decode(strtr($payload_b64, '-_', '+/'));
        $payload = json_decode($json, true);
        if (!$payload || empty($payload['email']) || empty($payload['exp'])) {
            return false;
        }

        // Check expiry
        if ($payload['exp'] < time()) {
            return false;
        }

        return $payload;
    }

    /**
     * Call ClearPanel API to verify token (consumes the nonce server-side).
     */
    private function verify_with_api($token)
    {
        $url = rtrim($this->api_url, '/') . '/api/mail/sso/verify?token=' . urlencode($token);

        $ch = curl_init($url);
        curl_setopt_array($ch, array(
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 5,
            CURLOPT_SSL_VERIFYPEER => false, // Internal network
            CURLOPT_HTTPHEADER     => array('Accept: application/json'),
        ));
        $response = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($code !== 200) {
            return false;
        }

        $data = json_decode($response, true);
        return !empty($data['email']);
    }
}
PLUGIN_PHP

log "Plugin PHP written"

# ── Write plugin config ───────────────────────────────────────────

cat > "${PLUGIN_DIR}/config.inc.php" <<PLUGIN_CONF
<?php
// ClearPanel SSO plugin configuration
// Generated by setup-roundcube-sso.sh on $(date -u +%Y-%m-%dT%H:%M:%SZ)

// Shared secret for HMAC token validation (must match ClearPanel's SSO_SECRET / SESSION_SECRET)
\$config['clearpanel_sso_secret'] = '${SSO_SECRET}';

// ClearPanel API base URL
\$config['clearpanel_sso_api_url'] = '${API_URL}';

// Dovecot master-user credentials for SSO auto-login
// Set these after running the Dovecot master-user setup below
\$config['clearpanel_sso_master_user'] = 'sso_master';
\$config['clearpanel_sso_master_pass'] = '';
PLUGIN_CONF

log "Plugin config written"

# ── Enable the plugin in Roundcube ────────────────────────────────

if grep -q "'clearpanel_sso'" "$ROUNDCUBE_CONF" 2>/dev/null; then
  log "Plugin already registered in Roundcube config"
else
  # Add to plugins array
  sed -i "s|\$config\['plugins'\] = array(|\$config['plugins'] = array(\n  'clearpanel_sso',|" "$ROUNDCUBE_CONF" 2>/dev/null || {
    # If the above pattern doesn't match, try the [] syntax
    sed -i "s|\$config\['plugins'\] = \[|\$config['plugins'] = [\n  'clearpanel_sso',|" "$ROUNDCUBE_CONF" 2>/dev/null || {
      warn "Could not auto-add plugin to config. Add 'clearpanel_sso' to \$config['plugins'] manually."
    }
  }
  log "Plugin registered in Roundcube config"
fi

# ── Setup Dovecot master-user for SSO ─────────────────────────────

DOVECOT_CONF_DIR="/etc/dovecot/conf.d"
MASTER_PASS_FILE="/etc/dovecot/master-users"

if [[ "$MAIL_MODE" == "production" ]]; then
  # Generate a random master password
  MASTER_PASS=$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 32)

  log "Setting up Dovecot master-user for SSO..."

  # Create master-users password file
  HASHED_PASS=$(doveadm pw -s SHA512-CRYPT -p "$MASTER_PASS" 2>/dev/null || echo "{SHA512-CRYPT}$(openssl passwd -6 "$MASTER_PASS")")
  echo "sso_master:${HASHED_PASS}" > "$MASTER_PASS_FILE"
  chmod 600 "$MASTER_PASS_FILE"
  chown root:dovecot "$MASTER_PASS_FILE" 2>/dev/null || true

  # Configure Dovecot master-user auth
  MASTER_AUTH_CONF="${DOVECOT_CONF_DIR}/auth-master.conf.ext"
  cat > "$MASTER_AUTH_CONF" <<DOVECOT_MASTER
# ClearPanel SSO — Dovecot master-user authentication
# Allows the sso_master user to log in as any mailbox user
# Login format: user*sso_master with sso_master's password

passdb {
  driver = passwd-file
  master = yes
  args = /etc/dovecot/master-users
  result_success = continue
}
DOVECOT_MASTER

  # Include master auth in dovecot config if not already
  DOVECOT_AUTH_CONF="${DOVECOT_CONF_DIR}/10-auth.conf"
  if [[ -f "$DOVECOT_AUTH_CONF" ]]; then
    if ! grep -q "auth-master.conf.ext" "$DOVECOT_AUTH_CONF"; then
      echo '!include auth-master.conf.ext' >> "$DOVECOT_AUTH_CONF"
      log "Added master auth include to Dovecot"
    fi
  fi

  # Enable master-user separator in Dovecot
  DOVECOT_MAIN_AUTH="${DOVECOT_CONF_DIR}/10-auth.conf"
  if [[ -f "$DOVECOT_MAIN_AUTH" ]]; then
    if ! grep -q "^auth_master_user_separator" "$DOVECOT_MAIN_AUTH"; then
      sed -i '/^#auth_master_user_separator/c\auth_master_user_separator = *' "$DOVECOT_MAIN_AUTH" 2>/dev/null || \
        echo 'auth_master_user_separator = *' >> "$DOVECOT_MAIN_AUTH"
      log "Enabled master-user separator in Dovecot"
    fi
  fi

  # Update Roundcube plugin config with master password
  sed -i "s|\$config\['clearpanel_sso_master_pass'\] = ''|\$config['clearpanel_sso_master_pass'] = '${MASTER_PASS}'|" "${PLUGIN_DIR}/config.inc.php"

  # Restart Dovecot
  systemctl restart dovecot 2>/dev/null || warn "Could not restart Dovecot"
  log "Dovecot master-user configured"
else
  log "[dev-mode] Skipping Dovecot master-user setup"
fi

# ── Set permissions ───────────────────────────────────────────────

chown -R www-data:www-data "$PLUGIN_DIR" 2>/dev/null || true
chmod 640 "${PLUGIN_DIR}/config.inc.php" 2>/dev/null || true

echo ""
echo "=== ClearPanel Roundcube SSO Plugin Installed ==="
echo "Plugin dir:    ${PLUGIN_DIR}"
echo "Roundcube:     ${ROUNDCUBE_ROOT}"
echo "API endpoint:  ${API_URL}/api/mail/sso/verify"
echo ""
echo "Users can now open webmail via ClearPanel's 'Open Webmail' button."
echo "The SSO token is valid for ${TOKEN_TTL_SECONDS:-60} seconds and is single-use."
