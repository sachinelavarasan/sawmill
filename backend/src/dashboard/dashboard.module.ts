import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { ChartsService } from './charts.service';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [AccountsModule],
  controllers: [DashboardController],
  providers: [DashboardService, ChartsService],
})
export class DashboardModule {}
