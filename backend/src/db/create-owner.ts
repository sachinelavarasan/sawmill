/*
 * Production setup: create the mill and its first owner (the demo seed is for development only).
 *
 *   npm run setup:owner -w backend -- --mill "Sri Murugan Saw Mill" --code SMSM \
 *       --name "R. Murugan" --username murugan [--lang ta] [--utc-offset 330]
 *
 * The password is asked for on the terminal (typed twice, not echoed) so it never
 * lands in shell history. Refuses to run if the mill code or username already exists.
 * More accountants and owners are then added from the web app (Users page).
 */
import 'dotenv/config';
import * as bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { createInterface } from 'readline';
import * as schema from './schema';
import { databaseUrl } from './url';

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{10,72}$/;

function args(argv: string[]) {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const m = /^--([a-z-]+)$/.exec(argv[i]);
    if (m && argv[i + 1] !== undefined) out[m[1]] = argv[++i];
  }
  return out;
}

/** Read a line without echoing it. */
function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const write = (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput;
    (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) => {
      if (s.startsWith(question)) write.call(rl, question);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

function fail(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

async function main() {
  const a = args(process.argv.slice(2));
  const millName = a.mill?.trim();
  const code = a.code?.trim().toUpperCase();
  const name = a.name?.trim();
  const username = a.username?.trim().toLowerCase();
  const lang = (a.lang ?? 'en') as 'en' | 'ta';
  const offset = Number(a['utc-offset'] ?? 330);

  if (!millName || !code || !name || !username) {
    fail('Usage: npm run setup:owner -w backend -- --mill "<mill name>" --code <CODE> --name "<owner name>" --username <login> [--lang en|ta] [--utc-offset 330]');
  }
  if (!/^[A-Z0-9]{2,10}$/.test(code)) fail('--code: 2–10 letters/numbers, e.g. SMSM');
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) fail('--username: 3–32 letters, numbers, . _ -');
  if (!['en', 'ta'].includes(lang)) fail('--lang must be en or ta');
  if (!Number.isInteger(offset) || offset < -720 || offset > 840) fail('--utc-offset is minutes from UTC, e.g. 330 for India');

  const password = await askHidden(`Password for ${username} (10+ characters, letters and numbers): `);
  if (!PASSWORD_RULE.test(password)) fail('Password must be 10–72 characters with letters and numbers');
  if ((await askHidden('Type it again: ')) !== password) fail('The two passwords do not match');

  const pool = new Pool({ connectionString: databaseUrl() });
  const db = drizzle(pool, { schema });
  try {
    await db.transaction(async (tx) => {
      if ((await tx.select({ id: schema.mills.id }).from(schema.mills).where(eq(schema.mills.code, code))).length) {
        fail(`A mill with code ${code} already exists`);
      }
      if ((await tx.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.username, username))).length) {
        fail(`The username ${username} is already taken`);
      }
      const [mill] = await tx
        .insert(schema.mills)
        .values({ name: millName, code, settings: { defaultLanguage: lang, utcOffsetMinutes: offset } })
        .returning({ id: schema.mills.id });
      const [owner] = await tx
        .insert(schema.users)
        .values({ millId: mill.id, name, username, role: 'OWNER', preferredLanguage: lang, passwordHash: await bcrypt.hash(password, 12) })
        .returning({ id: schema.users.id });
      await tx.insert(schema.auditLogs).values({ millId: mill.id, userId: owner.id, action: 'CREATE', entityType: 'User', entityId: owner.id, after: { name, username, role: 'OWNER', via: 'setup:owner' } });
    });
    console.log(`\n✓ Created mill "${millName}" (${code}) and owner "${username}". Sign in on the web app and add accountants from Users.\n`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => fail((e as Error).message));
