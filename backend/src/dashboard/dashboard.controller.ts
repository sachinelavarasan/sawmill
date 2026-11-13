import { Controller, Get } from '@nestjs/common';
import { Permission } from '@sawmill/shared';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import type { AuthUser } from '../common/types';
import { ChartsService } from './charts.service';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly charts: ChartsService,
  ) {}

  @Get('owner')
  @RequirePermissions(Permission.DASHBOARD_OWNER)
  owner(@CurrentUser() user: AuthUser) {
    return this.dashboard.owner(user);
  }

  @Get('accountant')
  @RequirePermissions(Permission.DASHBOARD_ACCOUNTANT)
  accountant(@CurrentUser() user: AuthUser) {
    return this.dashboard.accountant(user);
  }

  @Get('owner/charts')
  @RequirePermissions(Permission.DASHBOARD_OWNER)
  ownerCharts(@CurrentUser() user: AuthUser) {
    return this.charts.owner(user);
  }

  @Get('accountant/charts')
  @RequirePermissions(Permission.DASHBOARD_ACCOUNTANT)
  accountantCharts(@CurrentUser() user: AuthUser) {
    return this.charts.accountant(user);
  }
}
