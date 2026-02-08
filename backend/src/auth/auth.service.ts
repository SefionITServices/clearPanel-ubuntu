import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly configService: ConfigService) {
    const adminUsername = this.configService.get<string>('ADMIN_USERNAME', 'admin');
    const adminPassword = this.configService.get<string>('ADMIN_PASSWORD', 'admin123');
    this.logger.log(`AuthService initialized with username ${adminUsername}`);
    if (adminPassword === 'admin123') {
      this.logger.warn('Default admin password still in use. Change ADMIN_PASSWORD for security.');
    }
  }

  validate(username: string, password: string) {
    const adminUsername = this.configService.get<string>('ADMIN_USERNAME', 'admin');
    const adminPassword = this.configService.get<string>('ADMIN_PASSWORD', 'admin123');

    const valid = username === adminUsername && password === adminPassword;
    if (!valid) {
      this.logger.warn(`Invalid login attempt for username: ${username}`);
    }
    return valid;
  }
}
