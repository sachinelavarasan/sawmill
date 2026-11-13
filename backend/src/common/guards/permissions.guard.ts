import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { hasAllPermissions, type Permission } from '@sawmill/shared';
import { AUTHENTICATED_ONLY_KEY, IS_PUBLIC_KEY, PERMISSIONS_KEY } from '../decorators';
import type { AuthUser } from '../types';

/**
 * Deny-by-default authorisation. A route must declare @Public(),
 * @AuthenticatedOnly() or @RequirePermissions(...); anything else is refused,
 * so a forgotten decorator can never expose data.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const user: AuthUser | undefined = context.switchToHttp().getRequest().user;
    if (!user) throw new ForbiddenException();

    if (this.reflector.getAllAndOverride<boolean>(AUTHENTICATED_ONLY_KEY, targets)) return true;

    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, targets);
    if (!required || required.length === 0) {
      throw new ForbiddenException('Route has no permission policy');
    }
    if (!hasAllPermissions(user.role, required)) {
      throw new ForbiddenException('You do not have access to this information');
    }
    return true;
  }
}
