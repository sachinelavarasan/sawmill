import { Injectable, Logger } from '@nestjs/common';
import { and, count, desc, eq, SQL } from 'drizzle-orm';
import { Database, DbOrTx, InjectDb } from '../db/db.module';
import { auditLogs, users } from '../db/schema';

export interface AuditEntry {
  millId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}

const SECRET_FIELDS = ['passwordHash', 'password', 'tokenHash'];

function scrub(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  const json = JSON.parse(JSON.stringify(value));
  if (json && typeof json === 'object') {
    for (const f of SECRET_FIELDS) delete (json as Record<string, unknown>)[f];
  }
  return json;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@InjectDb() private readonly db: Database) {}

  /**
   * Write an audit row. Pass `tx` to make the audit part of the same
   * transaction as the change it records (it then fails loudly and rolls back).
   */
  async log(entry: AuditEntry, tx?: DbOrTx): Promise<void> {
    try {
      await (tx ?? this.db).insert(auditLogs).values({
        millId: entry.millId,
        userId: entry.userId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        before: scrub(entry.before),
        after: scrub(entry.after),
        ip: entry.ip ?? null,
      });
    } catch (err) {
      if (tx) throw err;
      this.logger.error(`Failed to write audit log: ${(err as Error).message}`);
    }
  }

  async list(millId: string, opts: { take: number; skip: number; entityType?: string; userId?: string }) {
    const conditions: SQL[] = [eq(auditLogs.millId, millId)];
    if (opts.entityType) conditions.push(eq(auditLogs.entityType, opts.entityType));
    if (opts.userId) conditions.push(eq(auditLogs.userId, opts.userId));
    const where = and(...conditions);

    const [items, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: auditLogs.id,
          action: auditLogs.action,
          entityType: auditLogs.entityType,
          entityId: auditLogs.entityId,
          before: auditLogs.before,
          after: auditLogs.after,
          ip: auditLogs.ip,
          createdAt: auditLogs.createdAt,
          user: { name: users.name, username: users.username, role: users.role },
        })
        .from(auditLogs)
        .leftJoin(users, eq(users.id, auditLogs.userId))
        .where(where)
        .orderBy(desc(auditLogs.createdAt))
        .limit(opts.take)
        .offset(opts.skip),
      this.db.select({ total: count() }).from(auditLogs).where(where),
    ]);
    return { items, total };
  }
}
