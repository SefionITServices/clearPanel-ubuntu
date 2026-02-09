import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly configService: ConfigService) {
    const adminUsername = this.getCredential('ADMIN_USERNAME');
    if (adminUsername) {
      this.logger.log(`AuthService initialized with username ${adminUsername}`);
    } else {
      this.logger.warn('No ADMIN_USERNAME configured — login disabled until setup wizard is completed');
    }
  }

  /**
   * Read a credential fresh from .env file on disk, falling back to ConfigService.
   * This ensures that after the setup wizard writes new creds, they take effect
   * without needing a full process restart.
   */
  private getCredential(key: string): string | undefined {
    // Try reading from .env file directly (handles post-wizard updates)
    try {
      const envPath = path.join(process.cwd(), '.env');
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
      if (match) return match[1].trim();
    } catch {
      // .env may not exist yet
    }
    // Fall back to ConfigService (environment variables)
    return this.configService.get<string>(key);
  }

  validate(username: string, password: string) {
    const adminUsername = this.getCredential('ADMIN_USERNAME');
    const adminPassword = this.getCredential('ADMIN_PASSWORD');

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
