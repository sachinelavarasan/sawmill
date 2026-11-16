/**
 * [OWNER-ONLY] Mill settings: name, standard unloading rate, default language
 * for new users, the time zone used for "today" on the dashboards, and the list of
 * wood types (read by everyone who enters loads through GET /wood-types).
 */
import { Body, Controller, Get, Injectable, Module, Patch, Post } from '@nestjs/common';
import { cleanWoodTypeList, matchWoodType, Permission, tidyWoodType } from '@timbertrail/shared';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { eq } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import type { AuthUser } from '../common/types';
import { Database, InjectDb } from '../db/db.module';
import { mills, MillSettings } from '../db/schema';
import { woodTypeChoices } from '../common/wood-types';

export class UpdateSettingsDto {
  @IsOptional() @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value)) @IsString() @MinLength(2) @MaxLength(120) name?: string;
  /** ₹ per hour; null removes the default. */
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(1_000_000) defaultUnloadingRatePerHour?: number | null;
  @IsOptional() @IsIn(['en', 'ta']) defaultLanguage?: 'en' | 'ta';
  /** Minutes from UTC (India = 330). */
  @IsOptional() @IsInt() @Min(-720) @Max(840) utcOffsetMinutes?: number;
  /** The whole list (replaces it). Tidied, case-insensitive repeats dropped, sorted. [] = no list (any name accepted). */
  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsString({ each: true }) @MinLength(2, { each: true }) @MaxLength(60, { each: true }) woodTypes?: string[];
}

/** One wood type added from a load form, without sending the whole list back. */
export class AddWoodTypeDto {
  @Transform(({ value }) => (typeof value === 'string' ? tidyWoodType(value) : value)) @IsString() @MinLength(2) @MaxLength(60) name: string;
}

type Mill = typeof mills.$inferSelect;
const view = (m: Mill) => ({
  name: m.name,
  code: m.code,
  defaultUnloadingRatePerHour: m.settings.defaultUnloadingRatePerHour ?? null,
  defaultLanguage: m.settings.defaultLanguage ?? 'en',
  utcOffsetMinutes: m.settings.utcOffsetMinutes ?? 330,
  woodTypes: m.settings.woodTypes ?? [],
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
      if (dto.woodTypes !== undefined) {
        const list = cleanWoodTypeList(dto.woodTypes);
        if (list.length) settings.woodTypes = list;
        else delete settings.woodTypes;
      }
      const [after] = await tx
        .update(mills)
        .set({ name: dto.name, settings, updatedAt: new Date() })
        .where(eq(mills.id, actor.millId))
        .returning();
      await this.audit.log({ millId: actor.millId, userId: actor.id, action: 'UPDATE', entityType: 'Mill', entityId: actor.millId, before, after }, tx);
      return view(after);
    });
  }

  /**
   * Adds one name to the list and answers with the spelling to use. A name already on it
   * (ignoring case and spacing) is not added twice: its listed spelling comes back instead.
   */
  async addWoodType(actor: AuthUser, name: string) {
    return this.db.transaction(async (tx) => {
      const [before] = await tx.select().from(mills).where(eq(mills.id, actor.millId)).for('update');
      const list = before.settings.woodTypes ?? [];
      const known = matchWoodType(list, name);
      if (known) return { name: known, items: list };
      const items = cleanWoodTypeList([...list, name]);
      const [after] = await tx
        .update(mills)
        .set({ settings: { ...before.settings, woodTypes: items }, updatedAt: new Date() })
        .where(eq(mills.id, actor.millId))
        .returning();
      await this.audit.log({ millId: actor.millId, userId: actor.id, action: 'UPDATE', entityType: 'Mill', entityId: actor.millId, before, after }, tx);
      return { name, items };
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

  /** The owner adds a wood type straight from a load form. */
  @Post('wood-types')
  addWoodType(@CurrentUser() user: AuthUser, @Body() dto: AddWoodTypeDto) {
    return this.settings.addWoodType(user, dto.name);
  }
}

/** The wood types the load forms offer — readable by everyone who enters loads. */
@Controller('wood-types')
@RequirePermissions(Permission.OPERATIONS_CREATE)
export class WoodTypesController {
  constructor(@InjectDb() private readonly db: Database) {}

  /** `fixed`: the owner set up a list, so only these (and names already in use) are accepted. */
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return woodTypeChoices(this.db, user.millId);
  }
}

@Module({ controllers: [SettingsController, WoodTypesController], providers: [SettingsService] })
export class SettingsModule {}
