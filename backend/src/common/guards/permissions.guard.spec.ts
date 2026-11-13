import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission, Role } from '@sawmill/shared';
import { AUTHENTICATED_ONLY_KEY, IS_PUBLIC_KEY, PERMISSIONS_KEY } from '../decorators';
import { PermissionsGuard } from './permissions.guard';

function ctx(user: unknown, meta: Record<string, unknown>): { context: ExecutionContext; reflector: Reflector } {
  const handler = () => undefined;
  const reflector = new Reflector();
  jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: unknown) => meta[key as string]);
  const context = {
    getHandler: () => handler,
    getClass: () => Object,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
  return { context, reflector };
}

const owner = { id: '1', millId: 'm', role: Role.OWNER };
const accountant = { id: '2', millId: 'm', role: Role.ACCOUNTANT };

describe('PermissionsGuard', () => {
  it('allows public routes without a user', () => {
    const { context, reflector } = ctx(undefined, { [IS_PUBLIC_KEY]: true });
    expect(new PermissionsGuard(reflector).canActivate(context)).toBe(true);
  });

  it('denies routes with no declared policy (deny by default)', () => {
    const { context, reflector } = ctx(owner, {});
    expect(() => new PermissionsGuard(reflector).canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows authenticated-only routes for any logged-in user', () => {
    const { context, reflector } = ctx(accountant, { [AUTHENTICATED_ONLY_KEY]: true });
    expect(new PermissionsGuard(reflector).canActivate(context)).toBe(true);
  });

  it('blocks accountant from owner dashboard and finance', () => {
    for (const p of [Permission.DASHBOARD_OWNER, Permission.FINANCE_VIEW, Permission.USERS_MANAGE]) {
      const { context, reflector } = ctx(accountant, { [PERMISSIONS_KEY]: [p] });
      expect(() => new PermissionsGuard(reflector).canActivate(context)).toThrow(ForbiddenException);
    }
  });

  it('allows owner everywhere and accountant on operational routes', () => {
    const a = ctx(owner, { [PERMISSIONS_KEY]: [Permission.FINANCE_VIEW] });
    expect(new PermissionsGuard(a.reflector).canActivate(a.context)).toBe(true);
    const b = ctx(accountant, { [PERMISSIONS_KEY]: [Permission.DASHBOARD_ACCOUNTANT] });
    expect(new PermissionsGuard(b.reflector).canActivate(b.context)).toBe(true);
  });
});
