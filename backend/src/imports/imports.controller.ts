import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { Permission } from '@sawmill/shared';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import type { AuthUser } from '../common/types';
import {
  CreateImportDto,
  CreateUnloadingDto,
  FinancialsDto,
  ListImportsQuery,
  LogDto,
  RejectDto,
  UpdateImportDto,
  UpdateUnloadingDto,
} from './imports.dto';
import { ImportsService } from './imports.service';

const Id = (name: string) => Param(name, ParseUUIDPipe);

/**
 * Import loads, their unloading entries and log measurements.
 * Everything here is operational data except the two `financials` routes, which read the
 * owner-only import_financials table and additionally require `finance:view`.
 */
@Controller('imports')
@RequirePermissions(Permission.OPERATIONS_CREATE)
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: ListImportsQuery) {
    return this.imports.list(user, q);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateImportDto) {
    return this.imports.create(user, dto);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Id('id') id: string) {
    return this.imports.detail(user, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Id('id') id: string, @Body() dto: UpdateImportDto) {
    return this.imports.update(user, id, dto);
  }

  @Post(':id/unloading')
  addUnloading(@CurrentUser() user: AuthUser, @Id('id') id: string, @Body() dto: CreateUnloadingDto) {
    return this.imports.addUnloading(user, id, dto);
  }

  @Patch(':id/unloading/:unloadingId')
  updateUnloading(
    @CurrentUser() user: AuthUser,
    @Id('id') id: string,
    @Id('unloadingId') unloadingId: string,
    @Body() dto: UpdateUnloadingDto,
  ) {
    return this.imports.updateUnloading(user, id, unloadingId, dto);
  }

  @Delete(':id/unloading/:unloadingId')
  @HttpCode(204)
  removeUnloading(@CurrentUser() user: AuthUser, @Id('id') id: string, @Id('unloadingId') unloadingId: string) {
    return this.imports.removeUnloading(user, id, unloadingId);
  }

  @Post(':id/logs')
  addLog(@CurrentUser() user: AuthUser, @Id('id') id: string, @Body() dto: LogDto) {
    return this.imports.addLog(user, id, dto);
  }

  @Patch(':id/logs/:logId')
  updateLog(@CurrentUser() user: AuthUser, @Id('id') id: string, @Id('logId') logId: string, @Body() dto: LogDto) {
    return this.imports.updateLog(user, id, logId, dto);
  }

  @Delete(':id/logs/:logId')
  removeLog(@CurrentUser() user: AuthUser, @Id('id') id: string, @Id('logId') logId: string) {
    return this.imports.removeLog(user, id, logId);
  }

  // ── approval workflow ──

  @Post(':id/submit')
  @HttpCode(200)
  @RequirePermissions(Permission.OPERATIONS_SUBMIT)
  submit(@CurrentUser() user: AuthUser, @Id('id') id: string) {
    return this.imports.submit(user, id);
  }

  @Post(':id/approve')
  @HttpCode(200)
  @RequirePermissions(Permission.OPERATIONS_APPROVE)
  approve(@CurrentUser() user: AuthUser, @Id('id') id: string) {
    return this.imports.approve(user, id);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @RequirePermissions(Permission.OPERATIONS_APPROVE)
  reject(@CurrentUser() user: AuthUser, @Id('id') id: string, @Body() dto: RejectDto) {
    return this.imports.reject(user, id, dto.reason);
  }

  // ── owner only: purchase side ──

  @Get(':id/financials')
  @RequirePermissions(Permission.OPERATIONS_CREATE, Permission.FINANCE_VIEW)
  financials(@CurrentUser() user: AuthUser, @Id('id') id: string) {
    return this.imports.financials(user, id);
  }

  @Put(':id/financials')
  @RequirePermissions(Permission.OPERATIONS_CREATE, Permission.FINANCE_VIEW)
  saveFinancials(@CurrentUser() user: AuthUser, @Id('id') id: string, @Body() dto: FinancialsDto) {
    return this.imports.saveFinancials(user, id, dto);
  }
}
