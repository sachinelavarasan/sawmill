import { Body, Controller, Get, HttpCode, Module, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Permission } from '@sawmill/shared';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import type { AuthUser } from '../common/types';
import { RejectDto } from '../imports/imports.dto';
import { CreateAdjustmentDto, ListAdjustmentsQuery, MovementsQuery, UpdateAdjustmentDto } from './stock.dto';
import { StockService } from './stock.service';

const Id = (name: string) => Param(name, ParseUUIDPipe);

/** Stock balances and the movement ledger: quantities only, mill-wide, no prices. */
@Controller('stock')
@RequirePermissions(Permission.OPERATIONS_CREATE)
export class StockController {
  constructor(private readonly stock: StockService) {}

  @Get()
  balances(@CurrentUser() user: AuthUser) {
    return this.stock.balances(user);
  }

  @Get('movements')
  movements(@CurrentUser() user: AuthUser, @Query() q: MovementsQuery) {
    return this.stock.movements(user, q);
  }
}

/** Stock corrections; they reach the ledger only when the owner approves them. */
@Controller('stock-adjustments')
@RequirePermissions(Permission.OPERATIONS_CREATE)
export class StockAdjustmentsController {
  constructor(private readonly stock: StockService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: ListAdjustmentsQuery) {
    return this.stock.listAdjustments(user, q);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAdjustmentDto) {
    return this.stock.createAdjustment(user, dto);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Id('id') id: string) {
    return this.stock.adjustment(user, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Id('id') id: string, @Body() dto: UpdateAdjustmentDto) {
    return this.stock.updateAdjustment(user, id, dto);
  }

  @Post(':id/submit')
  @HttpCode(200)
  @RequirePermissions(Permission.OPERATIONS_SUBMIT)
  submit(@CurrentUser() user: AuthUser, @Id('id') id: string) {
    return this.stock.submitAdjustment(user, id);
  }

  @Post(':id/approve')
  @HttpCode(200)
  @RequirePermissions(Permission.OPERATIONS_APPROVE)
  approve(@CurrentUser() user: AuthUser, @Id('id') id: string) {
    return this.stock.approveAdjustment(user, id);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @RequirePermissions(Permission.OPERATIONS_APPROVE)
  reject(@CurrentUser() user: AuthUser, @Id('id') id: string, @Body() dto: RejectDto) {
    return this.stock.rejectAdjustment(user, id, dto.reason);
  }
}

@Module({
  controllers: [StockController, StockAdjustmentsController],
  providers: [StockService],
})
export class StockModule {}
