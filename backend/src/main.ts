import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { trustProxy } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });

  // Behind nginx, req.ip must be the visitor's address (rate limits, audit log), not 127.0.0.1.
  app.set('trust proxy', trustProxy(process.env.TRUST_PROXY));
  // The largest real request (an import with all its logs) is well under this.
  app.useBodyParser('json', { limit: '1mb' });
  app.useBodyParser('urlencoded', { limit: '100kb', extended: false });

  app.use(helmet());
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map((s) => s.trim()),
    credentials: true,
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
