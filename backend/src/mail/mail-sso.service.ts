import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes } from 'crypto';
import * as fs from 'fs/promises';
import { MailService } from './mail.service';
import { ServerSettingsService } from '../server/server-settings.service';

/**
 * SSO token structure:
 *   <payload_base64>.<signature_hex>
 *
 * Payload (JSON): { email, domainId, mailboxId, nonce, exp }
 *   - exp: Unix timestamp (seconds)
 *   - nonce: One-time random string to prevent replay
 *
 * Signature = HMAC-SHA256(payload_base64, secret)
 */

interface SsoPayload {
  email: string;
  domainId: string;
  mailboxId: string;
  nonce: string;
  exp: number;
}

const TOKEN_TTL_SECONDS = 60; // 60-second window
const MAX_USED_NONCES = 500; // ring-buffer size

@Injectable()
export class MailSsoService {
  private readonly logger = new Logger(MailSsoService.name);
  private readonly secret: string;
  /** Ring-buffer of recently consumed nonces to prevent replay */
  private readonly usedNonces: Set<string> = new Set();
  private readonly nonceQueue: string[] = [];

  constructor(
    private readonly config: ConfigService,
    private readonly mailService: MailService,
    private readonly serverSettings: ServerSettingsService,
  ) {
    const configured = this.config.get<string>('SSO_SECRET')
      || this.config.get<string>('SESSION_SECRET');

    if (configured && configured !== 'change-this-to-a-random-secure-string') {
      this.secret = configured;
    } else {
      // Generate an ephemeral secret so we never fall back to a well-known string
      this.secret = randomBytes(32).toString('hex');
      this.logger.warn(
        'SSO_SECRET is not configured — generated an ephemeral secret. '
        + 'SSO tokens will not survive server restarts. Set SSO_SECRET in .env for persistence.',
      );
    }
  }

  // ── Token generation ──────────────────────────────────────────

  /**
   * Generate a signed SSO URL for the given mailbox.
   * Verifies the mailbox exists and is active before issuing the token.
   */
  async generateSsoUrl(domainId: string, mailboxId: string): Promise<{ url: string; token: string }> {
    const domains = await (this.mailService as any).readDomains();
    const domain = domains.find((d: any) => d.id === domainId);
    if (!domain) throw new BadRequestException('Mail domain not found');

    const mailbox = domain.mailboxes.find((m: any) => m.id === mailboxId);
    if (!mailbox) throw new BadRequestException('Mailbox not found');
    if (!mailbox.active) throw new BadRequestException('Mailbox is inactive');

    const payload: SsoPayload = {
      email: mailbox.email,
      domainId,
      mailboxId,
      nonce: randomBytes(16).toString('hex'),
      exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
    };

    const token = this.signPayload(payload);

    // Build a direct Roundcube URL for the webmail vhost.
    // Relative /roundcube URLs fail on installs where the panel vhost
    // does not proxy that path.
    const url = await this.buildWebmailSsoUrl(token, domain.domain);

    this.logger.log(`SSO token issued for ${mailbox.email}`);
    return { url, token };
  }

  // ── Token verification (used by the Roundcube plugin via HTTP) ──

  /**
   * Validate a token string. Returns the email on success or throws.
   * Also marks the nonce as consumed (one-time use).
   */
  verifyToken(token: string): { email: string } {
    const dotIdx = token.indexOf('.');
    if (dotIdx < 0) throw new BadRequestException('Invalid SSO token format');

    const payloadB64 = token.substring(0, dotIdx);
    const signature = token.substring(dotIdx + 1);

    // Verify HMAC
    const expected = createHmac('sha256', this.secret).update(payloadB64).digest('hex');
    if (signature !== expected) {
      throw new BadRequestException('Invalid SSO token signature');
    }

    let payload: SsoPayload;
    try {
      payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    } catch {
      throw new BadRequestException('Malformed SSO token payload');
    }

    // Check expiry
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      throw new BadRequestException('SSO token has expired');
    }

    // Check nonce (one-time use)
    if (this.usedNonces.has(payload.nonce)) {
      throw new BadRequestException('SSO token has already been used');
    }
    this.consumeNonce(payload.nonce);

    return { email: payload.email };
  }

  // ── Internals ─────────────────────────────────────────────────

  private signPayload(payload: SsoPayload): string {
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = createHmac('sha256', this.secret).update(payloadB64).digest('hex');
    return `${payloadB64}.${sig}`;
  }

  private consumeNonce(nonce: string): void {
    this.usedNonces.add(nonce);
    this.nonceQueue.push(nonce);
    // Evict oldest nonces when buffer is full
    while (this.nonceQueue.length > MAX_USED_NONCES) {
      const old = this.nonceQueue.shift();
      if (old) this.usedNonces.delete(old);
    }
  }

  private async buildWebmailSsoUrl(token: string, mailDomain: string): Promise<string> {
    const tokenParam = `_sso_token=${encodeURIComponent(token)}`;

    // Highest priority: explicit override
    const explicit = this.config.get<string>('WEBMAIL_BASE_URL')?.trim();
    if (explicit) {
      return `${explicit.replace(/\/+$/, '')}/?${tokenParam}`;
    }

    // Use per-mail-domain webmail host only when a matching vhost is present.
    const normalizedDomain = mailDomain?.trim().toLowerCase();
    if (normalizedDomain && await this.hasWebmailVhost(normalizedDomain)) {
      return `https://webmail.${normalizedDomain}/?${tokenParam}`;
    }

    // Default fallback: the panel primary domain's webmail host.
    try {
      const settings = await this.serverSettings.getSettings();
      if (settings.primaryDomain) {
        return `https://webmail.${settings.primaryDomain}/?${tokenParam}`;
      }
    } catch {
      // ignore and fall back
    }

    // Last resort for legacy deployments that expose /roundcube under panel vhost
    return `/roundcube/?${tokenParam}`;
  }

  private async hasWebmailVhost(domain: string): Promise<boolean> {
    const candidates = [
      `/etc/nginx/sites-enabled/webmail.${domain}`,
      `/etc/nginx/sites-available/webmail.${domain}`,
    ];
    for (const file of candidates) {
      try {
        await fs.access(file);
        return true;
      } catch {
        // continue
      }
    }
    return false;
  }
}
