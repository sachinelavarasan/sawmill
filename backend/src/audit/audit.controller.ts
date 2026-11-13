import { Controller, Get, Query } from '@nestjs/common';
import { Permission } from '@sawmill/shared';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import type { AuthUser } from '../common/types';
import { AuditService } from './audit.service';

class AuditQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) take = 50;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) skip = 0;
  @IsOptional() @IsString() entityType?: string;
  @IsOptional() @IsUUID() userId?: string;
}

@Controller('audit-logs')
@RequirePermissions(Permission.AUDIT_VIEW)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser, @Query() q: AuditQuery) {
    const { items, total } = await this.audit.list(user.millId, q);
    return { items, total, take: q.take, skip: q.skip };
  }
}
