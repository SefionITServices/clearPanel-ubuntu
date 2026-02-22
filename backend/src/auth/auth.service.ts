import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly envPath = path.join(process.cwd(), '.env');

  /** Cached .env content with short TTL to avoid re-reading on every request */
  private envCache: { content: string; ts: number } | null = null;
  private static readonly ENV_CACHE_TTL = 5000; // 5 seconds
  private static readonly BCRYPT_ROUNDS = 12;

  constructor(private readonly configService: ConfigService) {
    this.getCredential('ADMIN_USERNAME').then(adminUsername => {
      if (adminUsername) {
        this.logger.log(`AuthService initialized with username ${adminUsername}`);
      } else {
        this.logger.warn('No ADMIN_USERNAME configured — login disabled until setup wizard is completed');
      }
    });
  }

  /**
   * Read a credential from .env file on disk (async, cached), falling back to ConfigService.
   * This ensures that after the setup wizard writes new creds, they take effect
   * without needing a full process restart.
   */
  private async getCredential(key: string): Promise<string | undefined> {
    try {
      const now = Date.now();
      if (!this.envCache || now - this.envCache.ts > AuthService.ENV_CACHE_TTL) {
        const content = await fs.readFile(this.envPath, 'utf-8');
        this.envCache = { content, ts: now };
      }
      const match = this.envCache.content.match(new RegExp(`^${key}=(.*)$`, 'm'));
      if (match) return match[1].trim();
    } catch {
      // .env may not exist yet
    }
    return this.configService.get<string>(key);
  }

  /** Check if a stored password is a bcrypt hash */
  private isBcryptHash(value: string): boolean {
    return /^\$2[aby]?\$\d{1,2}\$.{53}$/.test(value);
  }

  /**
   * Hash a plaintext password using bcrypt.
   * Used by the setup wizard and password change flows.
   */
  async hashPassword(plaintext: string): Promise<string> {
    return bcrypt.hash(plaintext, AuthService.BCRYPT_ROUNDS);
  }

  async validate(username: string, password: string) {
    const adminUsername = await this.getCredential('ADMIN_USERNAME');
    const adminPassword = await this.getCredential('ADMIN_PASSWORD');

    // If no credentials are configured at all, reject all logins
    if (!adminUsername || !adminPassword) {
      this.logger.warn('Login attempted but no credentials configured (setup wizard not completed)');
      return false;
    }

    if (username !== adminUsername) {
      this.logger.warn(`Invalid login attempt for username: ${username}`);
      return false;
    }

    let valid: boolean;
    if (this.isBcryptHash(adminPassword)) {
      // Password is already hashed — compare with bcrypt
      valid = await bcrypt.compare(password, adminPassword);
    } else {
      // Legacy plaintext password — compare directly, then auto-upgrade to bcrypt
      valid = password === adminPassword;
      if (valid) {
        await this.upgradePasswordToHash(password);
      }
    }

    if (!valid) {
      this.logger.warn(`Invalid login attempt for username: ${username}`);
    }
    return valid;
  }

  /**
   * Auto-upgrade a plaintext password in .env to a bcrypt hash.
   * This provides seamless migration for existing installations.
   */
  private async upgradePasswordToHash(plaintext: string): Promise<void> {
    try {
      const hash = await this.hashPassword(plaintext);
      const content = await fs.readFile(this.envPath, 'utf-8');
      const updated = content.replace(
        /^ADMIN_PASSWORD=.*$/m,
        `ADMIN_PASSWORD=${hash}`,
      );
      await fs.writeFile(this.envPath, updated, 'utf-8');
      this.envCache = null; // Invalidate cache
      this.logger.log('Auto-upgraded ADMIN_PASSWORD from plaintext to bcrypt hash');
    } catch (err) {
      this.logger.warn('Failed to auto-upgrade password to bcrypt (non-critical)', err);
    }
  }
}
