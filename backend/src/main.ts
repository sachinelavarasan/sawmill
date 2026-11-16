import 'reflect-metadata';
import { ConsoleLogger, Logger, RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { requestLogger } from './common/request-logger';
import { logFormat, trustProxy } from './config/env';

async function bootstrap() {
  // JSON lines in production (Vercel / journald can search and filter them); readable colours on a dev machine
  const json = logFormat(process.env) === 'json';
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    logger: new ConsoleLogger({ json, colors: !json }),
  });

  // Behind nginx or Vercel, req.ip must be the visitor's address (rate limits, audit log), not the proxy's.
  app.set('trust proxy', trustProxy(process.env.TRUST_PROXY));
  // first, so it times everything that follows: one line per request, with an X-Request-Id
  app.use(requestLogger);
  // The largest real request (an import with all its logs) is well under this.
  app.useBodyParser('json', { limit: '1mb' });
  app.useBodyParser('urlencoded', { limit: '100kb', extended: false });

  app.use(helmet());
  // GET / stays outside /api: it is the status page (and Vercel's deployment preview)
  app.setGlobalPrefix('api', { exclude: [{ path: '/', method: RequestMethod.GET }] });
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map((s) => s.trim()),
    credentials: true,
    // lets the web app read the id to show alongside an error
    exposedHeaders: ['X-Request-Id'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown fields
      forbidNonWhitelisted: true, // ...and reject requests that send them
      transform: true,
    }),
  );
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3000);
  // HOST=127.0.0.1 in production so only nginx on the same server can reach the API.
  const host = process.env.HOST ?? '0.0.0.0';
  await app.listen(port, host);
  new Logger('Bootstrap').log(`TimberTrail API listening on http://${host}:${port}/api (${process.env.NODE_ENV ?? 'development'})`);
}
bootstrap();
