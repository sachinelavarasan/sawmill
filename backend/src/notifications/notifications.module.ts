/**
 * Push notifications through Expo's push service (https://docs.expo.dev/push-notifications/sending-notifications/).
 *
 *  - The app registers its Expo push token after sign-in (POST /notifications/tokens) and
 *    removes it on sign-out (DELETE /notifications/tokens).
 *  - Workflow events notify the people who need to act:
 *      submitted         → every active owner of the mill (except whoever submitted it)
 *      approved/rejected → the person who created the record
 *    Text is in each recipient's own language; the payload names the record so a tap opens it.
 *  - Sending never blocks or fails the request that caused it: it runs after the database
 *    transaction has committed, and errors are only logged. Tokens Expo reports as dead
 *    (app uninstalled) are deleted.
 *
 * Optional: EXPO_ACCESS_TOKEN, if "enhanced push security" is turned on for the Expo project.
 */
import { Body, Controller, Delete, Get, Global, HttpCode, Injectable, Logger, Module, Post, Query } from '@nestjs/common';
import { waitUntil } from '@vercel/functions';
import { Type } from 'class-transformer';
import { type Lang, Role, translate, type TKey } from '@timbertrail/shared';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { and, count, desc, eq, inArray, isNull, ne } from 'drizzle-orm';
import { AuthenticatedOnly, CurrentUser } from '../common/decorators';
import type { AuthUser } from '../common/types';
import { Database, InjectDb } from '../db/db.module';
import { exportLoads, importLoads, notifications, productionRuns, pushTokens, stockAdjustments, users } from '../db/schema';

export type WorkflowKind = 'IMPORT' | 'PRODUCTION' | 'EXPORT' | 'ADJUSTMENT';
export type WorkflowAction = 'SUBMIT' | 'APPROVE' | 'REJECT';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
/** Expo accepts at most 100 messages per request */
const BATCH = 100;

const TABLES = {
  IMPORT: importLoads,
  PRODUCTION: productionRuns,
  EXPORT: exportLoads,
  ADJUSTMENT: stockAdjustments,
} as const;

const KIND_LABEL: Record<WorkflowKind, TKey> = {
  IMPORT: 'pushKindImport',
  PRODUCTION: 'pushKindProduction',
  EXPORT: 'pushKindExport',
  ADJUSTMENT: 'pushKindAdjustment',
};

interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data: Record<string, string>;
  sound: 'default';
  channelId: string;
  priority: 'high';
}

const lang = (l: string): Lang => (l === 'ta' ? 'ta' : 'en');

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(@InjectDb() private readonly db: Database) {}

  /** This phone now belongs to `actor` (re-registering moves a token to the new user). */
  async register(actor: AuthUser, token: string, platform?: string) {
    await this.db
      .insert(pushTokens)
      .values({ token, platform, userId: actor.id, millId: actor.millId })
      .onConflictDoUpdate({ target: pushTokens.token, set: { userId: actor.id, millId: actor.millId, platform, updatedAt: new Date() } });
  }

  async unregister(actor: AuthUser, token: string) {
    await this.db.delete(pushTokens).where(and(eq(pushTokens.token, token), eq(pushTokens.userId, actor.id)));
  }

  // ───────── inbox ─────────

  async inbox(actor: AuthUser, take: number, skip: number) {
    const mine = eq(notifications.userId, actor.id);
    const [items, [{ total }], [{ unread }]] = await Promise.all([
      this.db.select().from(notifications).where(mine).orderBy(desc(notifications.createdAt), desc(notifications.id)).limit(take).offset(skip),
      this.db.select({ total: count() }).from(notifications).where(mine),
      this.db.select({ unread: count() }).from(notifications).where(and(mine, isNull(notifications.readAt))),
    ]);
    return { items, total, unread };
  }

  async unreadCount(actor: AuthUser) {
    const [{ unread }] = await this.db.select({ unread: count() }).from(notifications).where(and(eq(notifications.userId, actor.id), isNull(notifications.readAt)));
    return { unread };
  }

  /** Mark some (ids) or all of this person's notifications read. */
  async markRead(actor: AuthUser, ids?: string[]) {
    const mine = and(eq(notifications.userId, actor.id), isNull(notifications.readAt));
    await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(ids?.length ? and(mine, inArray(notifications.id, ids)) : mine);
  }

  /**
   * Fire-and-forget: call after the transaction that changed the record has committed.
   * On Vercel, waitUntil keeps the function alive until the inbox rows and pushes are done
   * (otherwise it may be frozen as soon as the response is sent); on a normal server it's a no-op.
   */
  workflow(actor: AuthUser, kind: WorkflowKind, id: string, action: WorkflowAction) {
    const task = this.sendWorkflow(actor, kind, id, action).catch((e: unknown) => this.logger.warn(`push for ${kind} ${id} ${action} failed: ${String(e)}`));
    waitUntil(task);
  }

  private async sendWorkflow(actor: AuthUser, kind: WorkflowKind, id: string, action: WorkflowAction) {
    const table = TABLES[kind];
    const [rec] = await this.db
      .select({ code: table.code, createdById: table.createdById, rejectionReason: table.rejectionReason })
      .from(table)
      .where(and(eq(table.id, id), eq(table.millId, actor.millId)));
    if (!rec) return;

    // who hears about it
    const recipients =
      action === 'SUBMIT'
        ? await this.db
            .select({ id: users.id, lang: users.preferredLanguage })
            .from(users)
            .where(and(eq(users.millId, actor.millId), eq(users.role, Role.OWNER), eq(users.isActive, true), ne(users.id, actor.id)))
        : rec.createdById === actor.id
          ? []
          : await this.db
              .select({ id: users.id, lang: users.preferredLanguage })
              .from(users)
              .where(and(eq(users.id, rec.createdById), eq(users.isActive, true)));
    if (!recipients.length) return;

    // the inbox gets every event, whether or not the phone allows pushes
    await this.db.insert(notifications).values(
      recipients.map((r) => ({
        millId: actor.millId,
        userId: r.id,
        kind,
        recordId: id,
        action,
        code: rec.code,
        actorName: actor.name,
        reason: action === 'REJECT' ? rec.rejectionReason : null,
      })),
    );

    const tokens = await this.db
      .select({ token: pushTokens.token, userId: pushTokens.userId })
      .from(pushTokens)
      .where(inArray(
        pushTokens.userId,
        recipients.map((r) => r.id),
      ));
    if (!tokens.length) return;

    const langOf = new Map(recipients.map((r) => [r.id, lang(r.lang)]));
    const messages: ExpoMessage[] = tokens.map(({ token, userId }) => {
      const l = langOf.get(userId) ?? 'en';
      const vars = { code: rec.code, name: actor.name, kind: translate(l, KIND_LABEL[kind]), reason: rec.rejectionReason ?? '' };
      const [title, body] =
        action === 'SUBMIT'
          ? [translate(l, 'pushSubmittedTitle', vars), translate(l, 'pushSubmittedBody', vars)]
          : action === 'APPROVE'
            ? [translate(l, 'pushApprovedTitle', vars), translate(l, 'pushApprovedBody', vars)]
            : [translate(l, 'pushRejectedTitle', vars), translate(l, 'pushRejectedBody', vars)];
      return { to: token, title, body, data: { type: 'workflow', kind, id, action }, sound: 'default', channelId: 'default', priority: 'high' };
    });
    await this.send(messages);
  }

  /** POST to Expo in batches; delete tokens Expo says no longer exist. */
  async send(messages: ExpoMessage[]) {
    const headers: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json' };
    if (process.env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
    const dead: string[] = [];
    for (let i = 0; i < messages.length; i += BATCH) {
      const batch = messages.slice(i, i + BATCH);
      const res = await fetch(EXPO_PUSH_URL, { method: 'POST', headers, body: JSON.stringify(batch), signal: AbortSignal.timeout(10_000) });
      if (!res.ok) {
        this.logger.warn(`Expo push HTTP ${res.status}: ${await res.text().catch(() => '')}`);
        continue;
      }
      const json = (await res.json()) as { data?: { status: string; details?: { error?: string } }[] };
      json.data?.forEach((ticket, n) => {
        if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') dead.push(batch[n].to);
      });
    }
    if (dead.length) await this.db.delete(pushTokens).where(inArray(pushTokens.token, dead));
  }
}

class TokenDto {
  @IsString()
  @MaxLength(200)
  @Matches(/^(ExponentPushToken|ExpoPushToken)\[.+\]$/, { message: 'Not an Expo push token' })
  token!: string;

  @IsOptional()
  @IsIn(['android', 'ios'])
  platform?: string;
}

class InboxQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) take = 30;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) skip = 0;
}

class MarkReadDto {
  /** omit to mark everything read */
  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsUUID('all', { each: true }) ids?: string[];
}

class RemoveTokenDto {
  @IsString()
  @MaxLength(200)
  token!: string;
}

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post('tokens')
  @HttpCode(204)
  @AuthenticatedOnly()
  register(@CurrentUser() user: AuthUser, @Body() dto: TokenDto) {
    return this.notifications.register(user, dto.token, dto.platform);
  }

  @Delete('tokens')
  @HttpCode(204)
  @AuthenticatedOnly()
  unregister(@CurrentUser() user: AuthUser, @Body() dto: RemoveTokenDto) {
    return this.notifications.unregister(user, dto.token);
  }

  /** My inbox, newest first, with the unread count. */
  @Get()
  @AuthenticatedOnly()
  inbox(@CurrentUser() user: AuthUser, @Query() q: InboxQuery) {
    return this.notifications.inbox(user, q.take, q.skip);
  }

  @Get('unread-count')
  @AuthenticatedOnly()
  unread(@CurrentUser() user: AuthUser) {
    return this.notifications.unreadCount(user);
  }

  @Post('read')
  @HttpCode(204)
  @AuthenticatedOnly()
  read(@CurrentUser() user: AuthUser, @Body() dto: MarkReadDto) {
    return this.notifications.markRead(user, dto.ids);
  }
}

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
