import { Body, Controller, Delete, Get, Module, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Permission } from '@timbertrail/shared';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import type { AuthUser } from '../common/types';
import { CreatePaymentDto } from './payments.dto';
import { PaymentsService } from './payments.service';

const Id = (name: string) => Param(name, ParseUUIDPipe);

/**
 * [OWNER-ONLY] Payments paid to suppliers against import loads and received from clients
 * against export loads, and each party's statement. Create / delete return the load's
 * updated payment summary so a screen can refresh in one round trip.
 */
@Controller()
@RequirePermissions(Permission.FINANCE_VIEW)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('imports/:id/payments')
  importPayments(@CurrentUser() user: AuthUser, @Id('id') id: string) {
    return this.payments.list(user, 'IMPORT', id);
  }

  @Post('imports/:id/payments')
  addImportPayment(@CurrentUser() user: AuthUser, @Id('id') id: string, @Body() dto: CreatePaymentDto) {
    return this.payments.create(user, 'IMPORT', id, dto);
  }

  @Delete('imports/:id/payments/:paymentId')
  removeImportPayment(@CurrentUser() user: AuthUser, @Id('id') id: string, @Id('paymentId') paymentId: string) {
    return this.payments.remove(user, 'IMPORT', id, paymentId);
  }

  @Get('exports/:id/payments')
  exportPayments(@CurrentUser() user: AuthUser, @Id('id') id: string) {
    return this.payments.list(user, 'EXPORT', id);
  }

  @Post('exports/:id/payments')
  addExportPayment(@CurrentUser() user: AuthUser, @Id('id') id: string, @Body() dto: CreatePaymentDto) {
    return this.payments.create(user, 'EXPORT', id, dto);
  }

  @Delete('exports/:id/payments/:paymentId')
  removeExportPayment(@CurrentUser() user: AuthUser, @Id('id') id: string, @Id('paymentId') paymentId: string) {
    return this.payments.remove(user, 'EXPORT', id, paymentId);
  }

  @Get('suppliers/:id/statement')
  supplierStatement(@CurrentUser() user: AuthUser, @Id('id') id: string) {
    return this.payments.statement(user, 'IMPORT', id);
  }

  @Get('clients/:id/statement')
  clientStatement(@CurrentUser() user: AuthUser, @Id('id') id: string) {
    return this.payments.statement(user, 'EXPORT', id);
  }
}

@Module({ controllers: [PaymentsController], providers: [PaymentsService] })
export class PaymentsModule {}
