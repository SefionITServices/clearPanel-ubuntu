import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';

interface UserSession {
  user?: any;
}

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { session?: UserSession }>();

    // Allow root CLI via internal token from localhost
    const cliToken = req.headers['x-cli-token'];
    const sessionSecret = process.env.SESSION_SECRET;
    const clientIp = req.ip || req.socket?.remoteAddress || '';
    const isLocalhost = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(clientIp);
    if (sessionSecret && cliToken === sessionSecret && isLocalhost) {
      return true;
    }

    if (!req.session) return false;
    const s: any = req.session;
    // Reject pending 2FA challenges
    if (s.twoFactorPending) return false;
    // Allow either a user object or isAuthenticated flag to pass
    return !!s.user || !!s.isAuthenticated;
  }
}
