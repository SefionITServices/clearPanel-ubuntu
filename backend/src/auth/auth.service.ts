import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {
  private adminUsername = process.env.ADMIN_USERNAME || 'admin';
  private adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  validate(username: string, password: string) {
    return username === this.adminUsername && password === this.adminPassword;
  }
}
