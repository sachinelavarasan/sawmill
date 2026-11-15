/* Development seed: one demo mill, one owner, one accountant. Safe to re-run. */
import 'dotenv/config';
import * as bcrypt from 'bcryptjs';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { databaseUrl } from './url';

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('The demo seed (known passwords) must not run in production. Use "npm run setup:owner -w backend" instead.');
  }
  const pool = new Pool({ connectionString: databaseUrl() });
  const db = drizzle(pool, { schema });

  await db
    .insert(schema.mills)
    .values({
      name: 'Demo Sawmill',
      code: 'DEMO',
      settings: { defaultUnloadingRatePerHour: 500, defaultLanguage: 'en', utcOffsetMinutes: 330 },
    })
    .onConflictDoNothing({ target: schema.mills.code });
  const mill = await db.query.mills.findFirst({ where: (m, { eq }) => eq(m.code, 'DEMO') });
  if (!mill) throw new Error('Mill seed failed');

  const accounts = [
    {
      username: (process.env.SEED_OWNER_USERNAME ?? 'owner').toLowerCase(),
      password: process.env.SEED_OWNER_PASSWORD ?? 'Owner@123',
      name: 'Mill Owner',
      role: 'OWNER' as const,
    },
    {
      username: (process.env.SEED_ACCOUNTANT_USERNAME ?? 'accountant').toLowerCase(),
      password: process.env.SEED_ACCOUNTANT_PASSWORD ?? 'Accountant@123',
      name: 'Accountant One',
      role: 'ACCOUNTANT' as const,
    },
  ];

  for (const a of accounts) {
    const inserted = await db
      .insert(schema.users)
      .values({
        millId: mill.id,
        username: a.username,
        name: a.name,
        role: a.role,
        passwordHash: await bcrypt.hash(a.password, 12),
      })
      .onConflictDoNothing({ target: schema.users.username })
      .returning({ id: schema.users.id });
    console.log(`${inserted.length ? 'Created' : 'Exists '} ${a.role.toLowerCase()}: ${a.username}`);
  }

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
