/*
 * Production setup: create a mill with its basic settings, its first owner and (optionally)
 * its first accountant — all in one go. (The demo seed is for development only.)
 *
 *   npm run setup:mill -- --mill "Sri Murugan Saw Mill" --code SMSM \
 *       --name "R. Murugan" --username murugan \
 *       [--accountant-name "K. Selvi" --accountant-username selvi] \
 *       [--lang ta] [--utc-offset 330] [--unloading-rate 500] [--wood-types "Teak,Sal,Neem"]
 *
 * (`npm run setup:owner -- …` is the same script.)
 *
 * Passwords are asked for on the terminal (typed twice, not echoed) so they never land in
 * shell history. Everything is created in one transaction: if anything fails, nothing is
 * created. Refuses to run if the mill code or a username already exists. More users are
 * added later from the web app (Users page); settings can be changed there too.
 */
import 'dotenv/config';
import * as bcrypt from 'bcryptjs';
import { eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { createInterface } from 'readline';
import * as schema from './schema';
import { databaseUrl } from './url';

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{10,72}$/;
const USERNAME_RULE = /^[a-z0-9._-]{3,32}$/;

const USAGE = `Usage: npm run setup:mill -- --mill "<mill name>" --code <CODE> --name "<owner name>" --username <login>
         [--accountant-name "<name>" --accountant-username <login>]
         [--lang en|ta] [--utc-offset 330] [--unloading-rate 500] [--wood-types "Teak,Sal"]`;

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

/** Ask for a password twice and check it against the rule. */
async function askPassword(username: string): Promise<string> {
  const password = await askHidden(`Password for ${username} (10+ characters, letters and numbers): `);
  if (!PASSWORD_RULE.test(password)) fail('Password must be 10–72 characters with letters and numbers');
  if ((await askHidden('Type it again: ')) !== password) fail('The two passwords do not match');
  return password;
}

interface NewUser {
  name: string;
  username: string;
  role: 'OWNER' | 'ACCOUNTANT';
  password: string;
}

async function main() {
  const a = args(process.argv.slice(2));
  const millName = a.mill?.trim();
  const code = a.code?.trim().toUpperCase();
  const ownerName = a.name?.trim();
  const ownerUsername = a.username?.trim().toLowerCase();
  const accountantName = a['accountant-name']?.trim();
  const accountantUsername = a['accountant-username']?.trim().toLowerCase();
  const lang = (a.lang ?? 'en') as 'en' | 'ta';
  const offset = Number(a['utc-offset'] ?? 330);
  const rate = a['unloading-rate'] === undefined ? undefined : Number(a['unloading-rate']);
  const woodTypes = a['wood-types']
    ? [...new Set(a['wood-types'].split(',').map((w) => w.trim()).filter(Boolean))]
    : undefined;

  if (!millName || !code || !ownerName || !ownerUsername) fail(USAGE);
  if (!/^[A-Z0-9]{2,10}$/.test(code)) fail('--code: 2–10 letters/numbers, e.g. SMSM');
  if (!USERNAME_RULE.test(ownerUsername)) fail('--username: 3–32 letters, numbers, . _ -');
  if (Boolean(accountantName) !== Boolean(accountantUsername)) fail('Give both --accountant-name and --accountant-username (or neither)');
  if (accountantUsername && !USERNAME_RULE.test(accountantUsername)) fail('--accountant-username: 3–32 letters, numbers, . _ -');
  if (accountantUsername && accountantUsername === ownerUsername) fail('The owner and the accountant need different usernames');
  if (!['en', 'ta'].includes(lang)) fail('--lang must be en or ta');
  if (!Number.isInteger(offset) || offset < -720 || offset > 840) fail('--utc-offset is minutes from UTC, e.g. 330 for India');
  if (rate !== undefined && !(Number.isFinite(rate) && rate >= 0)) fail('--unloading-rate must be a number (₹ per hour), e.g. 500');
  if (woodTypes && woodTypes.length === 0) fail('--wood-types: comma-separated names, e.g. "Teak,Sal"');

  const users: NewUser[] = [{ name: ownerName, username: ownerUsername, role: 'OWNER', password: await askPassword(ownerUsername) }];
  if (accountantName && accountantUsername) {
    users.push({ name: accountantName, username: accountantUsername, role: 'ACCOUNTANT', password: await askPassword(accountantUsername) });
  }

  const settings: schema.MillSettings = {
    defaultLanguage: lang,
    utcOffsetMinutes: offset,
    ...(rate !== undefined && { defaultUnloadingRatePerHour: rate }),
    ...(woodTypes && { woodTypes }),
  };

  const pool = new Pool({ connectionString: databaseUrl() });
  const db = drizzle(pool, { schema });
  try {
    await db.transaction(async (tx) => {
      if ((await tx.select({ id: schema.mills.id }).from(schema.mills).where(eq(schema.mills.code, code))).length) {
        fail(`A mill with code ${code} already exists`);
      }
      const taken = await tx
        .select({ username: schema.users.username })
        .from(schema.users)
        .where(inArray(schema.users.username, users.map((u) => u.username)));
      if (taken.length) fail(`Username already taken: ${taken.map((t) => t.username).join(', ')}`);

      const [mill] = await tx.insert(schema.mills).values({ name: millName, code, settings }).returning({ id: schema.mills.id });

      let ownerId: string | null = null;
      for (const u of users) {
        const [row]: { id: string }[] = await tx
          .insert(schema.users)
          .values({
            millId: mill.id,
            name: u.name,
            username: u.username,
            role: u.role,
            preferredLanguage: lang,
            passwordHash: await bcrypt.hash(u.password, 12),
            createdById: ownerId,
          })
          .returning({ id: schema.users.id });
        ownerId ??= row.id; // the owner is created first; the accountant is "created by" them
        await tx.insert(schema.auditLogs).values({
          millId: mill.id,
          userId: ownerId,
          action: 'CREATE',
          entityType: 'User',
          entityId: row.id,
          after: { name: u.name, username: u.username, role: u.role, via: 'setup:mill' },
        });
      }
    });

    console.log(`\n✓ Created mill "${millName}" (${code})`);
    for (const u of users) console.log(`  ${u.role === 'OWNER' ? 'owner     ' : 'accountant'}  ${u.username}  (${u.name})`);
    console.log(
      `  settings    language ${lang} · UTC${offset >= 0 ? '+' : '-'}${Math.floor(Math.abs(offset) / 60)}:${String(Math.abs(offset) % 60).padStart(2, '0')}` +
        `${rate !== undefined ? ` · unloading ₹${rate}/h` : ''}${woodTypes ? ` · wood types ${woodTypes.join(', ')}` : ''}`,
    );
    console.log('\nSign in on the web app; more users and settings are under Users / Settings.\n');
  } finally {
    await pool.end();
  }
}

main().catch((e) => fail((e as Error).message));
