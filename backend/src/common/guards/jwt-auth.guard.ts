import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import { Database, InjectDb } from '../../db/db.module';
import { users } from '../../db/schema';
import { IS_PUBLIC_KEY } from '../decorators';
import type { AuthUser, JwtPayload } from '../types';

/**
 * Verifies the bearer token, then re-loads the user from the database so that a
 * disabled account or a role change takes effect immediately.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    @InjectDb() private readonly db: Database,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const header: string | undefined = request.headers['authorization'];
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) throw new UnauthorizedException('Login required');

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Session expired, please log in again');
    }

    const [user] = await this.db
      .select({
        id: users.id,
        millId: users.millId,
        name: users.name,
        username: users.username,
        role: users.role,
        isActive: users.isActive,
        tokenVersion: users.tokenVersion,
      })
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);
    if (!user || !user.isActive) throw new UnauthorizedException('Account is disabled');
    // password reset / disable / role change since this token was issued
    if ((payload.tv ?? 0) !== user.tokenVersion) throw new UnauthorizedException('Session expired, please log in again');

    const authUser: AuthUser = {
      id: user.id,
      millId: user.millId,
      name: user.name,
      username: user.username,
      role: user.role,
    };
    request.user = authUser;
    return true;
  }
}
