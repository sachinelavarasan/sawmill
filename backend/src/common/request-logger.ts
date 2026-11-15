/**
 * One log line per request, written when the response has been sent:
 *
 *   POST /api/imports/3f…/submit 201 84ms · owner · 203.0.113.7 · rid=6b1c…
 *
 *  - Level follows the outcome: 5xx → error, 4xx or slower than SLOW_MS → warn, else log.
 *  - Every response carries an X-Request-Id (the caller's own if it sent a sane one, else
 *    Vercel's id, else a new UUID). Someone reporting a problem can quote it, and the
 *    matching line is easy to find in the logs.
 *  - Only the path is logged, never the query string (searches can hold names) or bodies.
 *  - Successful health checks are skipped: uptime monitors would otherwise flood the log.
 *  - A request the client gave up on before the answer was sent is logged as "aborted".
 *
 * Plain Express middleware (registered first in main.ts), so it times the whole request,
 * guards and body parsing included. The signed-in user is read when the response finishes,
 * after JwtAuthGuard has set it.
 */
import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import type { AuthUser } from './types';

const SLOW_MS = 1500;
const SAFE_ID = /^[\w.:-]{1,128}$/;
const logger = new Logger('HTTP');

function requestId(req: Request): string {
  const given = req.headers['x-request-id'];
  if (typeof given === 'string' && SAFE_ID.test(given)) return given;
  const vercel = req.headers['x-vercel-id'];
  if (typeof vercel === 'string' && SAFE_ID.test(vercel)) return vercel;
  return randomUUID();
}

export function requestLogger(req: Request & { user?: AuthUser }, res: Response, next: NextFunction) {
  const started = process.hrtime.bigint();
  const id = requestId(req);
  res.setHeader('X-Request-Id', id);

  // 'close' fires once for every response, after 'finish' when it was sent in full
  res.on('close', () => {
    const aborted = !res.writableFinished;
    const ms = Number((process.hrtime.bigint() - started) / 1_000_000n);
    const path = req.originalUrl.split('?')[0];
    const status = res.statusCode;
    if (!aborted && status < 400 && path.endsWith('/health')) return;

    const who = req.user?.username ?? '-';
    const line = `${req.method} ${path} ${aborted ? 'aborted' : status} ${ms}ms · ${who} · ${req.ip ?? '-'} · rid=${id}`;
    if (status >= 500) logger.error(line);
    else if (aborted || status >= 400 || ms > SLOW_MS) logger.warn(line);
    else logger.log(line);
  });
  next();
}
