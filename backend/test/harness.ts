/**
 * Integration-test harness: boots the real Nest app against a separate
 * `<DB_NAME>_test` database (created + migrated on first run, wiped before
 * every test file). The development database is never touched.
 */
import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { config as loadEnv } from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { join } from 'path';
import { Client, Pool } from 'pg';

loadEnv({ path: join(__dirname, '..', '.env') });
const baseDb = process.env.DB_NAME ?? 'sawmill';
const TEST_DB = baseDb.endsWith('_test') ? baseDb : `${baseDb}_test`;
// Must be set before AppModule (and ConfigModule) load; dotenv never overrides it.
process.env.DB_NAME = TEST_DB;
delete process.env.DATABASE_URL;
process.env.JWT_ACCESS_SECRET ??= 'integration-test-secret-0123456789';

// Imported after the env switch on purpose.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { databaseUrl } = require('../src/db/url') as typeof import('../src/db/url');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const schema = require('../src/db/schema') as typeof import('../src/db/schema');

export const PASSWORD = 'Passw0rd!test';

export interface Ctx {
  app: INestApplication;
  base: string;
  pool: Pool;
  db: ReturnType<typeof drizzle<typeof schema>>;
  millId: string;
  tokens: { owner: string; accA: string; accB: string; otherMillOwner: string };
}

async function ensureDatabase() {
  const admin = new Client({ connectionString: databaseUrl({ ...process.env, DB_NAME: 'postgres' }) });
  await admin.connect();
  const { rowCount } = await admin.query('select 1 from pg_database where datname = $1', [TEST_DB]);
  if (!rowCount) await admin.query(`CREATE DATABASE "${TEST_DB.replace(/"/g, '')}"`);
  await admin.end();
}

async function resetAndSeed(db: Ctx['db'], pool: Pool) {
  const tables = await pool.query<{ tablename: string }>(
    "select tablename from pg_tables where schemaname = 'public' and tablename <> '__drizzle_migrations'",
  );
  if (tables.rowCount) {
    await pool.query(`TRUNCATE ${tables.rows.map((r) => `"${r.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
  }
  const hash = await bcrypt.hash(PASSWORD, 4); // low cost: tests only

  const [mill] = await db
    .insert(schema.mills)
    .values({ name: 'Test Mill', code: 'TEST', settings: { defaultUnloadingRatePerHour: 400, utcOffsetMinutes: 330 } })
    .returning();
  const [otherMill] = await db.insert(schema.mills).values({ name: 'Other Mill', code: 'OTHER' }).returning();
  await db.insert(schema.users).values([
    { millId: mill.id, username: 't_owner', name: 'Test Owner', role: 'OWNER', passwordHash: hash },
    { millId: mill.id, username: 't_acc_a', name: 'Accountant A', role: 'ACCOUNTANT', passwordHash: hash },
    { millId: mill.id, username: 't_acc_b', name: 'Accountant B', role: 'ACCOUNTANT', passwordHash: hash },
    { millId: otherMill.id, username: 't_other_owner', name: 'Other Owner', role: 'OWNER', passwordHash: hash },
  ]);
  return mill.id;
}

export async function startApp(): Promise<Ctx> {
  await ensureDatabase();
  const pool = new Pool({ connectionString: databaseUrl() });
  const db = drizzle(pool, { schema });
  await migrate(db, { migrationsFolder: join(__dirname, '..', 'drizzle') });
  const millId = await resetAndSeed(db, pool);

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { AppModule } = require('../src/app.module') as typeof import('../src/app.module');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  // Same global setup as src/main.ts
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.listen(0, '127.0.0.1');
  const base = `${await app.getUrl()}/api`.replace('[::1]', '127.0.0.1');

  const login = async (username: string) => {
    const res = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: PASSWORD }),
    });
    if (res.status !== 200) throw new Error(`login ${username} → ${res.status}`);
    return ((await res.json()) as { accessToken: string }).accessToken;
  };

  return {
    app,
    base,
    pool,
    db,
    millId,
    tokens: {
      owner: await login('t_owner'),
      accA: await login('t_acc_a'),
      accB: await login('t_acc_b'),
      otherMillOwner: await login('t_other_owner'),
    },
  };
}

export async function stopApp(ctx: Ctx | undefined) {
  if (!ctx) return;
  await ctx.app.close();
  await ctx.pool.end();
}

/** Small JSON client: `call(ctx, token)('POST', '/imports', body)` → { status, body } */
export function client(ctx: Ctx, token: string) {
  return async <T = any>(method: string, path: string, body?: unknown): Promise<{ status: number; body: T }> => {
    const res = await fetch(`${ctx.base}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, body: (text ? JSON.parse(text) : undefined) as T };
  };
}
