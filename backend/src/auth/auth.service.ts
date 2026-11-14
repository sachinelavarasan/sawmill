import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ROLE_PERMISSIONS } from '@sawmill/shared';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { and, count, eq, gt, inArray, isNull, max, sql } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service';
import { Database, InjectDb } from '../db/db.module';
import { auditLogs, mills, refreshTokens, Role, users } from '../db/schema';

/** Account lockout: this many wrong passwords within the window locks the account for the window. */
export const LOCKOUT_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;

// Used so that "unknown user" and "wrong password" take the same time.
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser', 12);

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

export interface ClientInfo {
  ip?: string;
  userAgent?: string;
}

const userWithMill = {
  id: users.id,
  millId: users.millId,
  name: users.name,
  username: users.username,
  role: users.role,
  isActive: users.isActive,
  passwordHash: users.passwordHash,
  tokenVersion: users.tokenVersion,
  preferredLanguage: users.preferredLanguage,
  mill: { id: mills.id, name: mills.name, code: mills.code },
};

interface ProfileSource {
  id: string;
  name: string;
  username: string;
  role: Role;
  preferredLanguage: string;
  mill: { id: string; name: string; code: string };
}

@Injectable()
export class AuthService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  private async findUser(where: ReturnType<typeof eq>) {
    const [row] = await this.db
      .select(userWithMill)
      .from(users)
      .innerJoin(mills, eq(mills.id, users.millId))
      .where(where)
      .limit(1);
    return row;
  }

  async login(usernameRaw: string, password: string, client: ClientInfo) {
    const username = usernameRaw.trim().toLowerCase();
    const user = await this.findUser(eq(users.username, username));

    const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

    // Checked after bcrypt so a locked account answers in the same time as any other.
    if (user?.isActive && (await this.recentFailures(user.id)) >= LOCKOUT_ATTEMPTS) {
      await this.audit.log({ millId: user.millId, userId: user.id, action: 'LOGIN_LOCKED', entityType: 'User', entityId: user.id, ip: client.ip });
      throw new HttpException(
        `Too many wrong passwords. Try again in ${LOCKOUT_MINUTES} minutes, or ask the owner to reset your password.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!user || !passwordOk || !user.isActive) {
      if (user) {
        await this.audit.log({
          millId: user.millId,
          userId: user.id,
          action: user.isActive ? 'LOGIN_FAILED' : 'LOGIN_BLOCKED_DISABLED',
          entityType: 'User',
          entityId: user.id,
          ip: client.ip,
        });
      }
      throw new UnauthorizedException('Invalid username or password');
    }

    await this.db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
    await this.audit.log({
      millId: user.millId,
      userId: user.id,
      action: 'LOGIN',
      entityType: 'User',
      entityId: user.id,
      ip: client.ip,
    });

    const tokens = await this.issueTokens(user, client);
    return { ...tokens, user: this.profile(user) };
  }

  /** Rotate a refresh token. Re-use of an already-rotated token revokes every session of that user. */
  async refresh(rawToken: string, client: ClientInfo) {
    const expired = () => new UnauthorizedException('Session expired, please log in again');

    const [record] = await this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, sha256(rawToken)))
      .limit(1);
    if (!record) throw expired();

    const user = await this.findUser(eq(users.id, record.userId));
    if (!user) throw expired();

    if (record.revokedAt) {
      await this.revokeAllSessions(record.userId);
      await this.audit.log({
        millId: user.millId,
        userId: user.id,
        action: 'REFRESH_TOKEN_REUSE',
        entityType: 'User',
        entityId: user.id,
        ip: client.ip,
      });
      throw expired();
    }
    if (record.expiresAt < new Date() || !user.isActive) throw expired();

    // Conditional update makes rotation atomic: only one concurrent caller wins.
    const rotated = await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.id, record.id), isNull(refreshTokens.revokedAt)))
      .returning({ id: refreshTokens.id });
    if (rotated.length === 0) throw expired();

    const tokens = await this.issueTokens(user, client);
    return { ...tokens, user: this.profile(user) };
  }

  async logout(userId: string, millId: string, rawToken: string | undefined, client: ClientInfo) {
    if (rawToken) {
      await this.db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(refreshTokens.tokenHash, sha256(rawToken)),
            eq(refreshTokens.userId, userId),
            isNull(refreshTokens.revokedAt),
          ),
        );
    }
    await this.audit.log({ millId, userId, action: 'LOGOUT', entityType: 'User', entityId: userId, ip: client.ip });
  }

  async me(userId: string) {
    const user = await this.findUser(eq(users.id, userId));
    if (!user) throw new UnauthorizedException();
    return this.profile(user);
  }

  /**
   * Wrong passwords in the last LOCKOUT_MINUTES, counted from the last successful
   * login or owner password reset (either one clears the count). Uses the audit
   * log, so no extra table — and every attempt stays on record.
   */
  private async recentFailures(userId: string): Promise<number> {
    const forUser = and(eq(auditLogs.entityType, 'User'), eq(auditLogs.entityId, userId));
    const [cleared] = await this.db
      .select({ at: max(auditLogs.createdAt) })
      .from(auditLogs)
      .where(and(forUser, inArray(auditLogs.action, ['LOGIN', 'RESET_PASSWORD'])));
    const windowStart = new Date(Date.now() - LOCKOUT_MINUTES * 60_000);
    const since = cleared?.at && cleared.at > windowStart ? cleared.at : windowStart;
    const [row] = await this.db
      .select({ n: count() })
      .from(auditLogs)
      .where(and(forUser, eq(auditLogs.action, 'LOGIN_FAILED'), gt(auditLogs.createdAt, since)));
    return row?.n ?? 0;
  }

  /** Ends every session of a user now: refresh tokens are revoked and already-issued access tokens stop working. */
  async revokeAllSessions(userId: string) {
    await this.db
      .update(users)
      .set({ tokenVersion: sql`${users.tokenVersion} + 1` })
      .where(eq(users.id, userId));
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
  }

  private async issueTokens(user: { id: string; tokenVersion: number }, client: ClientInfo) {
    const userId = user.id;
    const accessToken = await this.jwt.signAsync({ sub: userId, tv: user.tokenVersion });
    const refreshToken = randomBytes(48).toString('base64url');
    const days = Number(this.config.get('REFRESH_TOKEN_TTL_DAYS') ?? 30);
    await this.db.insert(refreshTokens).values({
      userId,
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(Date.now() + days * 86_400_000),
      userAgent: client.userAgent?.slice(0, 255),
    });
    return { accessToken, refreshToken };
  }

  private profile(user: ProfileSource) {
    return {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      preferredLanguage: user.preferredLanguage,
      mill: user.mill,
      permissions: ROLE_PERMISSIONS[user.role],
    };
  }
}
