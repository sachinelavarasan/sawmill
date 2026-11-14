/**
 * [OWNER-ONLY] master data for the people the mill trades with: suppliers (who
 * sell logs) and clients (who buy sawn wood). Both have the same fields and
 * rules, so one factory builds the service, controller and module for each.
 */
import { BadRequestException, Body, Controller, DynamicModule, Get, Inject, Injectable, NotFoundException, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { PartialType } from '@nestjs/mapped-types';
import type { Permission } from '@sawmill/shared';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { and, asc, eq } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service';
import { Database, InjectDb } from '../db/db.module';
import { clients, suppliers } from '../db/schema';
import { CurrentUser, RequirePermissions } from './decorators';
import { MOBILE_RE, Trim } from './dto';
import type { AuthUser } from './types';

export class CreatePartyDto {
  @Trim() @IsString() @IsNotEmpty() @MaxLength(120) name: string;
  @Trim() @IsOptional() @Matches(MOBILE_RE, { message: 'Mobile number: 7–15 digits' }) phone?: string | null;
  @Trim() @IsOptional() @IsString() @MaxLength(300) address?: string | null;
  @Trim() @IsOptional() @IsString() @MaxLength(20) gstNumber?: string | null;
  @Trim() @IsOptional() @IsString() @MaxLength(1000) notes?: string | null;
}
export class UpdatePartyDto extends PartialType(CreatePartyDto) {}

type PartyTable = typeof suppliers | typeof clients;

interface PartyConfig {
  /** URL path, e.g. 'suppliers' */
  path: string;
  table: PartyTable;
  /** audit entity type, e.g. 'Supplier' */
  entityType: string;
  permission: Permission;
}

export function partyModule(cfg: PartyConfig): DynamicModule {
  const { table } = cfg;

  @Injectable()
  class PartyService {
    constructor(
      @InjectDb() private readonly db: Database,
      private readonly audit: AuditService,
    ) {}

    list(user: AuthUser) {
      return this.db.select().from(table).where(eq(table.millId, user.millId)).orderBy(asc(table.name));
    }

    create(user: AuthUser, dto: CreatePartyDto) {
      return this.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(table)
          .values({ millId: user.millId, ...dto })
          .returning();
        await this.audit.log({ millId: user.millId, userId: user.id, action: 'CREATE', entityType: cfg.entityType, entityId: row.id, after: row }, tx);
        return row;
      });
    }

    async update(user: AuthUser, id: string, dto: UpdatePartyDto) {
      if (dto.name === null) throw new BadRequestException('name cannot be empty');
      const where = and(eq(table.id, id), eq(table.millId, user.millId));
      const [before] = await this.db.select().from(table).where(where);
      if (!before) throw new NotFoundException(`${cfg.entityType} not found`);
      return this.db.transaction(async (tx) => {
        const [after] = await tx
          .update(table)
          .set({ ...dto, name: dto.name ?? undefined, updatedAt: new Date() })
          .where(where)
          .returning();
        await this.audit.log({ millId: user.millId, userId: user.id, action: 'UPDATE', entityType: cfg.entityType, entityId: id, before, after }, tx);
        return after;
      });
    }
  }

  @Controller(cfg.path)
  @RequirePermissions(cfg.permission)
  class PartyController {
    constructor(@Inject(PartyService) private readonly service: PartyService) {}

    @Get()
    list(@CurrentUser() user: AuthUser) {
      return this.service.list(user);
    }

    @Post()
    create(@CurrentUser() user: AuthUser, @Body() dto: CreatePartyDto) {
      return this.service.create(user, dto);
    }

    @Patch(':id')
    update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePartyDto) {
      return this.service.update(user, id, dto);
    }
  }

  class PartyModule {}

  // Distinct class names keep Nest's logs and module tokens readable and unique.
  Object.defineProperty(PartyService, 'name', { value: `${cfg.entityType}Service` });
  Object.defineProperty(PartyController, 'name', { value: `${cfg.entityType}Controller` });
  Object.defineProperty(PartyModule, 'name', { value: `${cfg.entityType}Module` });

  return { module: PartyModule, controllers: [PartyController], providers: [PartyService] };
}
