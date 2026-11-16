type Env = Record<string, string | undefined>;

/**
 * Whether to connect over TLS when the URL is built from DB_* parts: DB_SSL=true/false,
 * defaulting to on in production (managed Postgres such as Neon requires it) and off
 * elsewhere (a local Docker Postgres has no certificate).
 */
export function dbSsl(env: Env = process.env): boolean {
  const v = env.DB_SSL?.trim().toLowerCase();
  if (v === 'true') return true;
  if (v === 'false') return false;
  return env.NODE_ENV === 'production';
}

/** postgresql://… from the DB_* parts (URL-encoded, so passwords containing @ : / # work). */
function fromParts(env: Env, host: string | undefined): string {
  const { DB_PORT = '5432', DB_NAME, DB_USER, DB_PASSWORD = '' } = env;
  if (!DB_NAME || !DB_USER) {
    throw new Error('Set DATABASE_URL, or DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD');
  }
  const auth = `${encodeURIComponent(DB_USER)}:${encodeURIComponent(DB_PASSWORD)}`;
  // verify-full: encrypted and the server's certificate is checked (what pg's "require" does today)
  const ssl = dbSsl(env) ? '?sslmode=verify-full' : '';
  return `postgresql://${auth}@${host || 'localhost'}:${DB_PORT}/${encodeURIComponent(DB_NAME)}${ssl}`;
}

/**
 * Postgres connection string for the app: DATABASE_URL if set, otherwise built from
 * DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASSWORD (+ DB_SSL).
 */
export function databaseUrl(env: Env = process.env): string {
  if (env.DATABASE_URL) return env.DATABASE_URL;
  return fromParts(env, env.DB_HOST);
}

export type MigrationCredentials =
  | { url: string }
  | { host: string; port: number; user: string; password: string; database: string; ssl: boolean };

/**
 * drizzle-kit connection (migrations, studio), same order as the app: a URL if one is set,
 * otherwise the DB_* parts — like the app, with ssl from DB_SSL (default: on in production).
 *
 * DDL should not go through Neon's pgbouncer pooler, so the direct host wins when given:
 * DATABASE_URL_UNPOOLED (as Neon's Vercel integration names it) over DATABASE_URL, and
 * DB_HOST_UNPOOLED over DB_HOST.
 */
export function migrationCredentials(env: Env = process.env): MigrationCredentials {
  if (env.DATABASE_URL_UNPOOLED) return { url: env.DATABASE_URL_UNPOOLED };
  if (env.DATABASE_URL) return { url: env.DATABASE_URL };
  const { DB_PORT = '5432', DB_NAME, DB_USER, DB_PASSWORD = '' } = env;
  if (!DB_NAME || !DB_USER) {
    throw new Error('Set DATABASE_URL, or DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD');
  }
  return {
    host: env.DB_HOST_UNPOOLED || env.DB_HOST || 'localhost',
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    ssl: dbSsl(env),
  };
}
