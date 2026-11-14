/**
 * Browser sessions. The web app keeps its tokens in httpOnly cookies, so page scripts can
 * never read them; the mobile app keeps using the JSON tokens with `Authorization: Bearer`.
 *
 * A request says it is the web app with the header `X-Sawmill-Client: web`. That header does
 * two jobs:
 *  - on login / refresh it asks for cookies instead of tokens in the response body;
 *  - on every cookie-authenticated request it is the CSRF check: another site can make a
 *    browser send our cookies, but it cannot add a custom header without a CORS preflight,
 *    and CORS only admits the origins in CORS_ORIGINS. The cookies are SameSite=Strict as well.
 */
import type { CookieOptions, Request, Response } from 'express';

export const CLIENT_HEADER = 'x-sawmill-client';
export const WEB_CLIENT = 'web';
export const ACCESS_COOKIE = 'sawmill_at';
export const REFRESH_COOKIE = 'sawmill_rt';
/** The refresh cookie is only ever sent to the auth routes. */
const REFRESH_PATH = '/api/auth';

export const isWebClient = (req: Request) => req.headers[CLIENT_HEADER] === WEB_CLIENT;

/** One cookie from the request, without a cookie-parsing dependency. */
export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === name) {
      try {
        return decodeURIComponent(part.slice(eq + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

/** '15m', '2h', '900s', '1d' or plain seconds → milliseconds (15 minutes if unreadable). */
export function ttlMs(raw: string | undefined): number {
  const m = /^(\d+)\s*([smhd])?$/.exec((raw ?? '').trim());
  if (!m) return 15 * 60_000;
  return Number(m[1]) * { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[(m[2] ?? 's') as 's' | 'm' | 'h' | 'd'];
}

const base = (): CookieOptions => ({
  httpOnly: true,
  // plain http only on a developer's machine
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
});

export function setSessionCookies(res: Response, tokens: { accessToken: string; refreshToken: string }) {
  const refreshDays = Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30);
  res.cookie(ACCESS_COOKIE, tokens.accessToken, { ...base(), path: '/api', maxAge: ttlMs(process.env.JWT_ACCESS_TTL) });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, { ...base(), path: REFRESH_PATH, maxAge: refreshDays * 86_400_000 });
}

export function clearSessionCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, { ...base(), path: '/api' });
  res.clearCookie(REFRESH_COOKIE, { ...base(), path: REFRESH_PATH });
}

/**
 * Whether a cookie-authenticated request really comes from our web app: it carries the
 * client header, and its Origin (browsers send one on every cross-origin and every
 * non-GET request) is this host or one of CORS_ORIGINS.
 */
export function isTrustedWebRequest(req: Request): boolean {
  if (!isWebClient(req)) return false;
  const origin = req.headers.origin;
  if (!origin) return true; // same-origin GET: the browser sends no Origin
  const allowed = (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map((s) => s.trim());
  if (allowed.includes(origin)) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}
