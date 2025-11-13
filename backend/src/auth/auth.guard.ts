import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';

interface UserSession {
  user?: any;
}

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { session?: UserSession }>();
    if (!req.session) return false;
    const s: any = req.session;
    // Allow either a user object or isAuthenticated flag to pass
    return !!s.user || !!s.isAuthenticated;
  }
}
