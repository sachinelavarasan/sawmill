import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { and, asc, count, eq } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import type { AuthUser } from '../common/types';
import { Database, InjectDb } from '../db/db.module';
import { mills, users } from '../db/schema';
import { CreateUserDto, ResetPasswordDto, UpdateUserDto } from './users.dto';

/** Columns safe to return / audit — never the password hash. */
const PUBLIC_FIELDS = {
  id: users.id,
  name: users.name,
  username: users.username,
  phone: users.phone,
  role: users.role,
  isActive: users.isActive,
  preferredLanguage: users.preferredLanguage,
  lastLoginAt: users.lastLoginAt,
  createdAt: users.createdAt,
};

@Injectable()
export class UsersService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
  ) {}

  list(actor: AuthUser) {
    return this.db
      .select(PUBLIC_FIELDS)
      .from(users)
      .where(eq(users.millId, actor.millId))
      .orderBy(asc(users.role), asc(users.name));
  }

  async create(actor: AuthUser, dto: CreateUserDto) {
    const username = dto.username.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(dto.password, 12);

    return this.db.transaction(async (tx) => {
      // no language chosen → the mill's default (set by the owner in Settings)
      const [mill] = await tx.select({ settings: mills.settings }).from(mills).where(eq(mills.id, actor.millId));
      const [user] = await tx
        .insert(users)
        .values({
          millId: actor.millId,
          name: dto.name.trim(),
          username,
          phone: dto.phone,
          role: dto.role ?? 'ACCOUNTANT',
          preferredLanguage: dto.preferredLanguage ?? mill?.settings.defaultLanguage ?? 'en',
          passwordHash,
          createdById: actor.id,
        })
        .onConflictDoNothing({ target: users.username })
        .returning(PUBLIC_FIELDS);
      if (!user) throw new ConflictException('Username is already taken');

      await this.audit.log(
        { millId: actor.millId, userId: actor.id, action: 'CREATE', entityType: 'User', entityId: user.id, after: user },
        tx,
      );
      return user;
    });
  }

  async update(actor: AuthUser, id: string, dto: UpdateUserDto) {
    const before = await this.findInMill(actor, id);
    if (Object.values(dto).every((v) => v === undefined)) return before;
    const roleChanging = dto.role !== undefined && dto.role !== before.role;

    if (id === actor.id && (dto.isActive === false || roleChanging)) {
      throw new BadRequestException('You cannot disable or change the role of your own account');
    }
    const after = await this.db.transaction(async (tx) => {
      if (before.role === 'OWNER' && (dto.isActive === false || dto.role === 'ACCOUNTANT')) {
        // Lock the active owners first, so two owners disabling each other at the
        // same moment can't both pass the check and leave the mill with none.
        const owners = await tx
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.millId, actor.millId), eq(users.role, 'OWNER'), eq(users.isActive, true)))
          .orderBy(users.id)
          .for('update');
        if (owners.length <= 1) throw new BadRequestException('The mill must keep at least one active owner');
      }

      const [updated] = await tx
        .update(users)
        .set({
          name: dto.name,
          phone: dto.phone,
          isActive: dto.isActive,
          role: dto.role,
          preferredLanguage: dto.preferredLanguage,
        })
        .where(and(eq(users.id, id), eq(users.millId, actor.millId)))
        .returning(PUBLIC_FIELDS);
      await this.audit.log(
        { millId: actor.millId, userId: actor.id, action: 'UPDATE', entityType: 'User', entityId: id, before, after: updated },
        tx,
      );
      return updated;
    });

    if (dto.isActive === false || roleChanging) await this.auth.revokeAllSessions(id);
    return after;
  }

  async resetPassword(actor: AuthUser, id: string, dto: ResetPasswordDto) {
    await this.findInMill(actor, id);
    await this.db
      .update(users)
      .set({ passwordHash: await bcrypt.hash(dto.password, 12) })
      .where(and(eq(users.id, id), eq(users.millId, actor.millId)));
    await this.auth.revokeAllSessions(id);
    await this.audit.log({ millId: actor.millId, userId: actor.id, action: 'RESET_PASSWORD', entityType: 'User', entityId: id });
  }

  /** Tenant-scoped lookup: a user from another mill is reported as "not found". */
  private async findInMill(actor: AuthUser, id: string) {
    const [user] = await this.db
      .select(PUBLIC_FIELDS)
      .from(users)
      .where(and(eq(users.id, id), eq(users.millId, actor.millId)))
      .limit(1);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
