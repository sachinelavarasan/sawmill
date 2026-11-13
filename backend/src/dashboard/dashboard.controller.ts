import { Controller, Get } from '@nestjs/common';
import { Permission } from '@sawmill/shared';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import type { AuthUser } from '../common/types';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

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
}
