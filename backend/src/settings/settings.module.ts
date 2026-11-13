/**
 * [OWNER-ONLY] Mill settings: name, standard unloading rate, default language
 * for new users, and the time zone used for "today" on the dashboards.
 */
import { Body, Controller, Get, Injectable, Module, Patch } from '@nestjs/common';
import { Permission } from '@sawmill/shared';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { eq } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import type { AuthUser } from '../common/types';
import { Database, InjectDb } from '../db/db.module';
import { mills, MillSettings } from '../db/schema';

export class UpdateSettingsDto {
  @IsOptional() @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value)) @IsString() @MinLength(2) @MaxLength(120) name?: string;
  /** ₹ per hour; null removes the default. */
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(1_000_000) defaultUnloadingRatePerHour?: number | null;
  @IsOptional() @IsIn(['en', 'ta']) defaultLanguage?: 'en' | 'ta';
  /** Minutes from UTC (India = 330). */
  @IsOptional() @IsInt() @Min(-720) @Max(840) utcOffsetMinutes?: number;
}

type Mill = typeof mills.$inferSelect;
const view = (m: Mill) => ({
  name: m.name,
  code: m.code,
  defaultUnloadingRatePerHour: m.settings.defaultUnloadingRatePerHour ?? null,
  defaultLanguage: m.settings.defaultLanguage ?? 'en',
  utcOffsetMinutes: m.settings.utcOffsetMinutes ?? 330,
});

@Injectable()
export class SettingsService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  async get(actor: AuthUser) {
    const [mill] = await this.db.select().from(mills).where(eq(mills.id, actor.millId));
    return view(mill);
  }

  async update(actor: AuthUser, dto: UpdateSettingsDto) {
    return this.db.transaction(async (tx) => {
      const [before] = await tx.select().from(mills).where(eq(mills.id, actor.millId)).for('update');
      const settings: MillSettings = { ...before.settings };
      if (dto.defaultUnloadingRatePerHour !== undefined) {
        if (dto.defaultUnloadingRatePerHour === null) delete settings.defaultUnloadingRatePerHour;
        else settings.defaultUnloadingRatePerHour = dto.defaultUnloadingRatePerHour;
      }
      if (dto.defaultLanguage) settings.defaultLanguage = dto.defaultLanguage;
      if (dto.utcOffsetMinutes !== undefined) settings.utcOffsetMinutes = dto.utcOffsetMinutes;
      const [after] = await tx
        .update(mills)
        .set({ name: dto.name, settings, updatedAt: new Date() })
        .where(eq(mills.id, actor.millId))
        .returning();
      await this.audit.log({ millId: actor.millId, userId: actor.id, action: 'UPDATE', entityType: 'Mill', entityId: actor.millId, before, after }, tx);
      return view(after);
    });
  }
}

@Controller('settings')
@RequirePermissions(Permission.SETTINGS_MANAGE)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.settings.get(user);
  }

  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateSettingsDto) {
    return this.settings.update(user, dto);
  }
}

@Module({ controllers: [SettingsController], providers: [SettingsService] })
export class SettingsModule {}
