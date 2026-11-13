import { Controller, Get, Module, Param, Query, Res, StreamableFile } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Permission } from '@sawmill/shared';
import { IsIn, IsOptional } from 'class-validator';
import type { Response } from 'express';
import { AccountsModule } from '../accounts/accounts.module';
import { AuthenticatedOnly, CurrentUser, RequirePermissions } from '../common/decorators';
import { PeriodQuery } from '../common/period';
import type { AuthUser } from '../common/types';
import { ReportsService } from './reports.service';

class ReportQueryDto extends PeriodQuery {
  @IsOptional() @IsIn(['APPROVED', 'ALL']) status?: 'APPROVED' | 'ALL';
  @IsOptional() @IsIn(['en', 'ta']) lang?: 'en' | 'ta';
}
class LangQuery {
  @IsOptional() @IsIn(['en', 'ta']) lang?: 'en' | 'ta';
}

/**
 * Reports for the screen/print view (JSON) and as Excel downloads.
 * Each report checks its own permission (operational vs financial) in the service.
 */
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  @AuthenticatedOnly()
  list(@CurrentUser() user: AuthUser, @Query() q: LangQuery) {
    return this.reports.list(user, q.lang);
  }

  @Get(':key')
  @RequirePermissions(Permission.REPORTS_OPERATIONAL)
  run(@CurrentUser() user: AuthUser, @Param('key') key: string, @Query() q: ReportQueryDto) {
    return this.reports.run(user, key, q);
  }

  @Get(':key/xlsx')
  @RequirePermissions(Permission.REPORTS_OPERATIONAL)
  @Throttle({ default: { limit: 20, ttl: 60_000 } }) // building a workbook is the heaviest request
  async xlsx(@CurrentUser() user: AuthUser, @Param('key') key: string, @Query() q: ReportQueryDto, @Res({ passthrough: true }) res: Response) {
    const { filename, buffer } = await this.reports.excel(user, key, q);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    return new StreamableFile(buffer);
  }
}

@Module({ imports: [AccountsModule], controllers: [ReportsController], providers: [ReportsService] })
export class ReportsModule {}
