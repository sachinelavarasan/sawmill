import { Body, Controller, Get, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { PartialType } from '@nestjs/mapped-types';
import { Permission } from '@sawmill/shared';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { and, asc, eq } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import { MOBILE_RE, Trim } from '../common/dto';
import type { AuthUser } from '../common/types';
import { Database, InjectDb } from '../db/db.module';
import { suppliers } from '../db/schema';

class CreateSupplierDto {
  @Trim() @IsString() @IsNotEmpty() @MaxLength(120) name: string;
  @Trim() @IsOptional() @Matches(MOBILE_RE, { message: 'Mobile number: 7–15 digits' }) phone?: string | null;
  @Trim() @IsOptional() @IsString() @MaxLength(300) address?: string | null;
  @Trim() @IsOptional() @IsString() @MaxLength(20) gstNumber?: string | null;
  @Trim() @IsOptional() @IsString() @MaxLength(1000) notes?: string | null;
}
class UpdateSupplierDto extends PartialType(CreateSupplierDto) {}

/** [OWNER-ONLY] Supplier master data. */
@Injectable()
export class SuppliersService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  list(user: AuthUser) {
    return this.db.select().from(suppliers).where(eq(suppliers.millId, user.millId)).orderBy(asc(suppliers.name));
  }

  create(user: AuthUser, dto: CreateSupplierDto) {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(suppliers)
        .values({ millId: user.millId, ...dto })
        .returning();
      await this.audit.log({ millId: user.millId, userId: user.id, action: 'CREATE', entityType: 'Supplier', entityId: row.id, after: row }, tx);
      return row;
    });
  }

  async update(user: AuthUser, id: string, dto: UpdateSupplierDto) {
    if (dto.name === null) throw new NotFoundException('name cannot be empty');
    const where = and(eq(suppliers.id, id), eq(suppliers.millId, user.millId));
    const [before] = await this.db.select().from(suppliers).where(where);
    if (!before) throw new NotFoundException('Supplier not found');
    return this.db.transaction(async (tx) => {
      const [after] = await tx
        .update(suppliers)
        .set({ ...dto, name: dto.name ?? undefined })
        .where(where)
        .returning();
      await this.audit.log({ millId: user.millId, userId: user.id, action: 'UPDATE', entityType: 'Supplier', entityId: id, before, after }, tx);
      return after;
    });
  }
}

@Controller('suppliers')
@RequirePermissions(Permission.SUPPLIERS_MANAGE)
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.suppliers.list(user);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSupplierDto) {
    return this.suppliers.create(user, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSupplierDto) {
    return this.suppliers.update(user, id, dto);
  }
}

@Module({
  controllers: [SuppliersController],
  providers: [SuppliersService],
})
export class SuppliersModule {}
