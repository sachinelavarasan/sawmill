import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { validateEnv } from './config/env';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { DashboardModule } from './dashboard/dashboard.module';
import { HealthController } from './health.controller';
import { ImportsModule } from './imports/imports.module';
import { ClientsModule, SuppliersModule } from './suppliers/suppliers.module';
import { ExportsModule } from './exports/exports.controller';
import { ApprovalsModule } from './approvals/approvals.module';
import { SettingsModule } from './settings/settings.module';
import { AccountsModule } from './accounts/accounts.module';
import { ReportsModule } from './reports/reports.module';
import { ProductionModule } from './production/production.controller';
import { StockModule } from './stock/stock.controller';
import { DbModule } from './db/db.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_ACCESS_SECRET');
        if (!secret || secret.length < 16) {
          throw new Error('JWT_ACCESS_SECRET must be set (at least 16 characters)');
        }
        // @nestjs/jwt 11 types expiresIn as an `ms`-style duration literal, not a bare string
        const expiresIn = (config.get<string>('JWT_ACCESS_TTL') ?? '15m') as NonNullable<JwtSignOptions['expiresIn']>;
        return { secret, signOptions: { expiresIn } };
      },
    }),
    DbModule,
    AuditModule,
    AuthModule,
    UsersModule,
    DashboardModule,
    ImportsModule,
    SuppliersModule,
    ProductionModule,
    StockModule,
    ClientsModule,
    ExportsModule,
    ApprovalsModule,
    SettingsModule,
    AccountsModule,
    ReportsModule,
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: rate limit → authenticate → authorise.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
