import { Body, Controller, Get, HttpCode, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { Request, Response } from 'express';
import { AuthenticatedOnly, CurrentUser, Public } from '../common/decorators';
import type { AuthUser } from '../common/types';
import { AuthService, ClientInfo } from './auth.service';
import { clearSessionCookies, isTrustedWebRequest, isWebClient, readCookie, REFRESH_COOKIE, setSessionCookies } from './cookies';

class LoginDto {
  @IsString() @MinLength(1) @MaxLength(64) username: string;
  @IsString() @MinLength(1) @MaxLength(128) password: string;
}

class RefreshDto {
  /** The mobile app sends its refresh token here; the web app's is in its cookie. */
  @IsOptional() @IsString() @MinLength(20) @MaxLength(200) refreshToken?: string;
}

class LogoutDto {
  @IsOptional() @IsString() @MaxLength(200) refreshToken?: string;
}

const clientInfo = (req: Request): ClientInfo => ({ ip: req.ip, userAgent: req.headers['user-agent'] });

type Session = Awaited<ReturnType<AuthService['login']>>;
/**
 * Hands a new session to the caller: the web app gets its tokens as httpOnly cookies and
 * only the profile in the body; any other client (the mobile app) gets the tokens as JSON.
 */
function deliver(req: Request, res: Response, session: Session) {
  if (!isWebClient(req)) return session;
  setSessionCookies(res, session);
  return { user: session.user };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } }) // 10 login attempts / minute / IP
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return deliver(req, res, await this.auth.login(dto.username, dto.password, clientInfo(req)));
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() dto: RefreshDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // a cookie is only accepted from our own web app (the same check the guard makes)
    const token = dto.refreshToken ?? (isTrustedWebRequest(req) ? readCookie(req, REFRESH_COOKIE) : undefined);
    if (!token) throw new UnauthorizedException('Session expired, please log in again');
    try {
      return deliver(req, res, await this.auth.refresh(token, clientInfo(req)));
    } catch (err) {
      if (isWebClient(req)) clearSessionCookies(res); // the browser's session is over: drop the dead cookies
      throw err;
    }
  }

  @AuthenticatedOnly()
  @Post('logout')
  @HttpCode(204)
  async logout(@CurrentUser() user: AuthUser, @Body() dto: LogoutDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(user.id, user.millId, dto.refreshToken ?? readCookie(req, REFRESH_COOKIE), clientInfo(req));
    clearSessionCookies(res);
  }

  @AuthenticatedOnly()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }
}
