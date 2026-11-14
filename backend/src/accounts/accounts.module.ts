import { Body, Controller, Delete, Get, HttpCode, Module, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Permission } from '@sawmill/shared';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import { PeriodQuery } from '../common/period';
import type { AuthUser } from '../common/types';
import { CreateExpenseDto, ListExpensesQuery, UpdateExpenseDto } from './accounts.dto';
import { AccountsService } from './accounts.service';

/** [OWNER-ONLY] Profit & loss, outstanding payments and other expenses. */
@Controller()
@RequirePermissions(Permission.FINANCE_VIEW)
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get('accounts/summary')
  summary(@CurrentUser() user: AuthUser, @Query() q: PeriodQuery) {
    return this.accounts.summary(user, q);
  }

  @Get('expenses')
  list(@CurrentUser() user: AuthUser, @Query() q: ListExpensesQuery) {
    return this.accounts.listExpenses(user, q);
  }

  @Post('expenses')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateExpenseDto) {
    return this.accounts.createExpense(user, dto);
  }

  @Patch('expenses/:id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateExpenseDto) {
    return this.accounts.updateExpense(user, id, dto);
  }

  @Delete('expenses/:id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.accounts.removeExpense(user, id);
  }
}

@Module({ controllers: [AccountsController], providers: [AccountsService], exports: [AccountsService] })
export class AccountsModule {}
