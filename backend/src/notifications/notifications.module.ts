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
import { Body, Controller, Delete, Global, HttpCode, Injectable, Logger, Module, Post } from '@nestjs/common';
import { type Lang, Role, translate, type TKey } from '@timbertrail/shared';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { and, eq, inArray, ne } from 'drizzle-orm';
import { AuthenticatedOnly, CurrentUser } from '../common/decorators';
import type { AuthUser } from '../common/types';
import { Database, InjectDb } from '../db/db.module';
import { exportLoads, importLoads, productionRuns, pushTokens, stockAdjustments, users } from '../db/schema';

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

  /** Fire-and-forget: call after the transaction that changed the record has committed. */
  workflow(actor: AuthUser, kind: WorkflowKind, id: string, action: WorkflowAction) {
    void this.sendWorkflow(actor, kind, id, action).catch((e: unknown) => this.logger.warn(`push for ${kind} ${id} ${action} failed: ${String(e)}`));
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
}

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
