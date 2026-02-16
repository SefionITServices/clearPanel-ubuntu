import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly envPath = path.join(process.cwd(), '.env');

  /** Cached .env content with short TTL to avoid re-reading on every request */
  private envCache: { content: string; ts: number } | null = null;
  private static readonly ENV_CACHE_TTL = 5000; // 5 seconds

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

  async validate(username: string, password: string) {
    const adminUsername = await this.getCredential('ADMIN_USERNAME');
    const adminPassword = await this.getCredential('ADMIN_PASSWORD');

    // If no credentials are configured at all, reject all logins
    if (!adminUsername || !adminPassword) {
      this.logger.warn('Login attempted but no credentials configured (setup wizard not completed)');
      return false;
    }

    const valid = username === adminUsername && password === adminPassword;
    if (!valid) {
      this.logger.warn(`Invalid login attempt for username: ${username}`);
    }
    return valid;
  }
}
