import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { Request } from 'express';
import { AuthenticatedOnly, CurrentUser, Public } from '../common/decorators';
import type { AuthUser } from '../common/types';
import { AuthService, ClientInfo } from './auth.service';

class LoginDto {
  @IsString() @MinLength(1) @MaxLength(64) username: string;
  @IsString() @MinLength(1) @MaxLength(128) password: string;
}

class RefreshDto {
  @IsString() @MinLength(20) @MaxLength(200) refreshToken: string;
}

class LogoutDto {
  @IsOptional() @IsString() @MaxLength(200) refreshToken?: string;
}

const clientInfo = (req: Request): ClientInfo => ({ ip: req.ip, userAgent: req.headers['user-agent'] });

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } }) // 10 login attempts / minute / IP
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto.username, dto.password, clientInfo(req));
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, clientInfo(req));
  }

  @AuthenticatedOnly()
  @Post('logout')
  @HttpCode(204)
  async logout(@CurrentUser() user: AuthUser, @Body() dto: LogoutDto, @Req() req: Request) {
    await this.auth.logout(user.id, user.millId, dto.refreshToken, clientInfo(req));
  }

  @AuthenticatedOnly()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }
}
