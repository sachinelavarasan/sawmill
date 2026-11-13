import { Body, Controller, Delete, Get, HttpCode, Module, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { Permission } from '@sawmill/shared';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import type { AuthUser } from '../common/types';
import { RejectDto } from '../imports/imports.dto';
import { CreateExportDto, ExportFinancialsDto, ExportLineDto, ListExportsQuery, UpdateExportDto } from './exports.dto';
import { ExportsService } from './exports.service';

const Id = (name: string) => Param(name, ParseUUIDPipe);

/**
 * Export loads and their measured lines (operational). The two `financials`
 * routes read the owner-only export_financials table and also need `finance:view`.
 */
@Controller('exports')
@RequirePermissions(Permission.OPERATIONS_CREATE)
export class ExportsController {
  constructor(private readonly exports: ExportsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: ListExportsQuery) {
    return this.exports.list(user, q);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateExportDto) {
    return this.exports.create(user, dto);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Id('id') id: string) {
    return this.exports.detail(user, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Id('id') id: string, @Body() dto: UpdateExportDto) {
    return this.exports.update(user, id, dto);
  }

  @Post(':id/measurements')
  addLine(@CurrentUser() user: AuthUser, @Id('id') id: string, @Body() dto: ExportLineDto) {
    return this.exports.addLine(user, id, dto);
  }

  @Patch(':id/measurements/:lineId')
  updateLine(@CurrentUser() user: AuthUser, @Id('id') id: string, @Id('lineId') lineId: string, @Body() dto: ExportLineDto) {
    return this.exports.updateLine(user, id, lineId, dto);
  }

  @Delete(':id/measurements/:lineId')
  removeLine(@CurrentUser() user: AuthUser, @Id('id') id: string, @Id('lineId') lineId: string) {
    return this.exports.removeLine(user, id, lineId);
  }

  @Post(':id/submit')
  @HttpCode(200)
  @RequirePermissions(Permission.OPERATIONS_SUBMIT)
  submit(@CurrentUser() user: AuthUser, @Id('id') id: string) {
    return this.exports.submit(user, id);
  }

  @Post(':id/approve')
  @HttpCode(200)
  @RequirePermissions(Permission.OPERATIONS_APPROVE)
  approve(@CurrentUser() user: AuthUser, @Id('id') id: string) {
    return this.exports.approve(user, id);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @RequirePermissions(Permission.OPERATIONS_APPROVE)
  reject(@CurrentUser() user: AuthUser, @Id('id') id: string, @Body() dto: RejectDto) {
    return this.exports.reject(user, id, dto.reason);
  }

  // ── owner only: sale side ──

  @Get(':id/financials')
  @RequirePermissions(Permission.OPERATIONS_CREATE, Permission.FINANCE_VIEW)
  financials(@CurrentUser() user: AuthUser, @Id('id') id: string) {
    return this.exports.financials(user, id);
  }

  @Put(':id/financials')
  @RequirePermissions(Permission.OPERATIONS_CREATE, Permission.FINANCE_VIEW)
  saveFinancials(@CurrentUser() user: AuthUser, @Id('id') id: string, @Body() dto: ExportFinancialsDto) {
    return this.exports.saveFinancials(user, id, dto);
  }
}

@Module({
  controllers: [ExportsController],
  providers: [ExportsService],
})
export class ExportsModule {}
