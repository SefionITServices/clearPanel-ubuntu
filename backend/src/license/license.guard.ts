import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { LicenseService } from './license.service';

/**
 * Feature-gating guard. Usage:
 *
 *   @UseGuards(AuthGuard, LicenseGuard)
 *   @SetMetadata('requiredPlan', 'pro')        // optional: minimum plan
 *   @SetMetadata('requiredFeature', 'ssh-keys') // optional: specific feature
 *
 * If no metadata is set, the guard simply checks that the panel is not in
 * read-only mode (i.e. license hasn't been expired for 30+ days).
 */
@Injectable()
export class LicenseGuard implements CanActivate {
  constructor(
    private readonly licenseService: LicenseService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Block all write operations if panel is in read-only mode
    if (this.licenseService.isReadOnly()) {
      const req = context.switchToHttp().getRequest();
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        throw new ForbiddenException(
          'License expired — panel is in read-only mode. Renew at clearpanel.io',
        );
      }
    }

    // 2. Check required plan (if specified via @SetMetadata)
    const requiredPlan = this.reflector.get<string>('requiredPlan', context.getHandler());
    if (requiredPlan) {
      const planOrder = ['starter', 'pro', 'enterprise'];
      const currentPlan = this.licenseService.getPlan();
      const currentIdx = planOrder.indexOf(currentPlan);
      const requiredIdx = planOrder.indexOf(requiredPlan);
      if (currentIdx < requiredIdx) {
        throw new ForbiddenException(
          `This feature requires a ${requiredPlan} plan. Current plan: ${currentPlan}`,
        );
      }
    }

    // 3. Check required feature (if specified via @SetMetadata)
    const requiredFeature = this.reflector.get<string>('requiredFeature', context.getHandler());
    if (requiredFeature && !this.licenseService.isFeatureAllowed(requiredFeature)) {
      throw new ForbiddenException(
        `Feature "${requiredFeature}" is not included in your current plan.`,
      );
    }

    return true;
  }
}
