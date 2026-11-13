import { Body, Controller, Get, HttpCode, Module, Param, ParseUUIDPipe, Patch, Post, Delete, Query } from '@nestjs/common';
import { Permission } from '@sawmill/shared';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import type { AuthUser } from '../common/types';
import { RejectDto } from '../imports/imports.dto';
import { CreateProductionDto, ListProductionQuery, OutputDto, UpdateProductionDto } from './production.dto';
import { ProductionService } from './production.service';

const Id = (name: string) => Param(name, ParseUUIDPipe);

/** Production runs and their finished sizes. Operational data only; no prices live here. */
@Controller('production')
@RequirePermissions(Permission.OPERATIONS_CREATE)
export class ProductionController {
  constructor(private readonly production: ProductionService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: ListProductionQuery) {
    return this.production.list(user, q);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProductionDto) {
    return this.production.create(user, dto);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Id('id') id: string) {
    return this.production.detail(user, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Id('id') id: string, @Body() dto: UpdateProductionDto) {
    return this.production.update(user, id, dto);
  }

  @Post(':id/outputs')
  addOutput(@CurrentUser() user: AuthUser, @Id('id') id: string, @Body() dto: OutputDto) {
    return this.production.addOutput(user, id, dto);
  }

  @Patch(':id/outputs/:outputId')
  updateOutput(@CurrentUser() user: AuthUser, @Id('id') id: string, @Id('outputId') outputId: string, @Body() dto: OutputDto) {
    return this.production.updateOutput(user, id, outputId, dto);
  }

  @Delete(':id/outputs/:outputId')
  removeOutput(@CurrentUser() user: AuthUser, @Id('id') id: string, @Id('outputId') outputId: string) {
    return this.production.removeOutput(user, id, outputId);
  }

  @Post(':id/submit')
  @HttpCode(200)
  @RequirePermissions(Permission.OPERATIONS_SUBMIT)
  submit(@CurrentUser() user: AuthUser, @Id('id') id: string) {
    return this.production.submit(user, id);
  }

  @Post(':id/approve')
  @HttpCode(200)
  @RequirePermissions(Permission.OPERATIONS_APPROVE)
  approve(@CurrentUser() user: AuthUser, @Id('id') id: string) {
    return this.production.approve(user, id);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @RequirePermissions(Permission.OPERATIONS_APPROVE)
  reject(@CurrentUser() user: AuthUser, @Id('id') id: string, @Body() dto: RejectDto) {
    return this.production.reject(user, id, dto.reason);
  }
}

@Module({
  controllers: [ProductionController],
  providers: [ProductionService],
})
export class ProductionModule {}
