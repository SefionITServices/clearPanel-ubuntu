import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// ═══════════════════════════════════════════════════════════════════
//  TOTP implementation using Node.js crypto (no external deps)
// ═══════════════════════════════════════════════════════════════════

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer: Buffer): string {
  let bits = '';
  for (const byte of buffer) bits += byte.toString(2).padStart(8, '0');
  let result = '';
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, '0');
    result += BASE32_CHARS[parseInt(chunk, 2)];
  }
  return result;
}

function base32Decode(str: string): Buffer {
  let bits = '';
  for (const c of str.toUpperCase()) {
    const idx = BASE32_CHARS.indexOf(c);
    if (idx < 0) continue;
    bits += idx.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function generateTOTP(secret: string, timeStep = 30, digits = 6, offset = 0): string {
  const key = base32Decode(secret);
  const counter = Math.floor(Date.now() / 1000 / timeStep) + offset;
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuf.writeUInt32BE(counter >>> 0, 4);

  const hmac = crypto.createHmac('sha1', key).update(counterBuf).digest();
  const offsetByte = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offsetByte] & 0x7f) << 24) |
    ((hmac[offsetByte + 1] & 0xff) << 16) |
    ((hmac[offsetByte + 2] & 0xff) << 8) |
    (hmac[offsetByte + 3] & 0xff);

  return (code % Math.pow(10, digits)).toString().padStart(digits, '0');
}

function verifyTOTP(secret: string, token: string, window = 1): boolean {
  for (let i = -window; i <= window; i++) {
    if (generateTOTP(secret, 30, 6, i) === token) return true;
  }
  return false;
}

// ═══════════════════════════════════════════════════════════════════

export interface TwoFactorConfig {
  enabled: boolean;
  secret?: string;
  recoveryCodes?: string[];
  enabledAt?: string;
}

@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);

  private get dataDir(): string {
    return process.env.DATA_DIR || path.join(os.homedir(), 'etc', 'clearpanel');
  }

  private get configPath(): string {
    return path.join(this.dataDir, 'two-factor.json');
  }

  // ─── Config persistence ───────────────────────────────────────

  private async loadConfig(): Promise<TwoFactorConfig> {
    try {
      const raw = await fs.readFile(this.configPath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return { enabled: false };
    }
  }

  private async saveConfig(config: TwoFactorConfig): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
  }

  // ═══════════════════════════════════════════════════════════════
  //  STATUS
  // ═══════════════════════════════════════════════════════════════

  async getStatus(): Promise<{ success: boolean; enabled: boolean; enabledAt?: string }> {
    const config = await this.loadConfig();
    return { success: true, enabled: config.enabled, enabledAt: config.enabledAt };
  }

  async isEnabled(): Promise<boolean> {
    const config = await this.loadConfig();
    return config.enabled;
  }

  // ═══════════════════════════════════════════════════════════════
  //  SETUP — Generate secret & URI
  // ═══════════════════════════════════════════════════════════════

  async generateSetup(username: string): Promise<{
    success: boolean;
    secret: string;
    otpauthUri: string;
    qrDataUrl?: string;
  }> {
    const secretBuffer = crypto.randomBytes(20);
    const secret = base32Encode(secretBuffer);

    const issuer = 'ClearPanel';
    const otpauthUri = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(username)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

    // Save secret temporarily (not yet enabled)
    const config = await this.loadConfig();
    config.secret = secret;
    await this.saveConfig(config);

    return { success: true, secret, otpauthUri };
  }

  // ═══════════════════════════════════════════════════════════════
  //  VERIFY & ENABLE
  // ═══════════════════════════════════════════════════════════════

  async verifyAndEnable(token: string): Promise<{
    success: boolean;
    message: string;
    recoveryCodes?: string[];
  }> {
    const config = await this.loadConfig();
    if (!config.secret) {
      return { success: false, message: 'No 2FA setup in progress. Generate a secret first.' };
    }

    if (!verifyTOTP(config.secret, token)) {
      return { success: false, message: 'Invalid verification code. Please try again.' };
    }

    // Generate recovery codes
    const recoveryCodes: string[] = [];
    for (let i = 0; i < 8; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      recoveryCodes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
    }

    config.enabled = true;
    config.recoveryCodes = recoveryCodes.map(c =>
      crypto.createHash('sha256').update(c).digest('hex')
    );
    config.enabledAt = new Date().toISOString();
    await this.saveConfig(config);

    this.logger.log('Two-factor authentication enabled');
    return {
      success: true,
      message: 'Two-factor authentication enabled successfully.',
      recoveryCodes,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  //  VERIFY CODE (login flow)
  // ═══════════════════════════════════════════════════════════════

  async verifyCode(token: string): Promise<{ success: boolean; message: string }> {
    const config = await this.loadConfig();
    if (!config.enabled || !config.secret) {
      return { success: false, message: '2FA is not enabled' };
    }

    // Check TOTP
    if (verifyTOTP(config.secret, token)) {
      return { success: true, message: 'Code verified' };
    }

    // Check recovery codes
    const normalised = token.toUpperCase().replace(/[^A-F0-9]/g, '');
    const formattedForHash = normalised.length === 8
      ? `${normalised.slice(0, 4)}-${normalised.slice(4)}`
      : token.toUpperCase();
    const hash = crypto.createHash('sha256').update(formattedForHash).digest('hex');

    if (config.recoveryCodes?.includes(hash)) {
      // Consume recovery code (one-time use)
      config.recoveryCodes = config.recoveryCodes.filter(c => c !== hash);
      await this.saveConfig(config);
      this.logger.warn('Recovery code consumed for 2FA login');
      return { success: true, message: 'Recovery code accepted' };
    }

    return { success: false, message: 'Invalid code' };
  }

  // ═══════════════════════════════════════════════════════════════
  //  DISABLE
  // ═══════════════════════════════════════════════════════════════

  async disable(password: string): Promise<{ success: boolean; message: string }> {
    // Password re-validation is done at the controller level
    const config = await this.loadConfig();
    config.enabled = false;
    delete config.secret;
    delete config.recoveryCodes;
    delete config.enabledAt;
    await this.saveConfig(config);

    this.logger.log('Two-factor authentication disabled');
    return { success: true, message: 'Two-factor authentication disabled.' };
  }

  // ═══════════════════════════════════════════════════════════════
  //  REGENERATE RECOVERY CODES
  // ═══════════════════════════════════════════════════════════════

  async regenerateRecoveryCodes(): Promise<{
    success: boolean;
    message: string;
    recoveryCodes?: string[];
  }> {
    const config = await this.loadConfig();
    if (!config.enabled) {
      return { success: false, message: '2FA is not enabled' };
    }

    const recoveryCodes: string[] = [];
    for (let i = 0; i < 8; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      recoveryCodes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
    }

    config.recoveryCodes = recoveryCodes.map(c =>
      crypto.createHash('sha256').update(c).digest('hex')
    );
    await this.saveConfig(config);

    return { success: true, message: 'Recovery codes regenerated.', recoveryCodes };
  }
}
