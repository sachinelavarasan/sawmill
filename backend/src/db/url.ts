/**
 * Postgres connection string from env: DATABASE_URL if set, otherwise built
 * from DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASSWORD (URL-encoded, so
 * passwords containing @ : / # work).
 */
export function databaseUrl(env: Record<string, string | undefined> = process.env): string {
  if (env.DATABASE_URL) return env.DATABASE_URL;
  const { DB_HOST = 'localhost', DB_PORT = '5432', DB_NAME, DB_USER, DB_PASSWORD = '' } = env;
  if (!DB_NAME || !DB_USER) {
    throw new Error('Set DATABASE_URL, or DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD');
  }
  const auth = `${encodeURIComponent(DB_USER)}:${encodeURIComponent(DB_PASSWORD)}`;
  return `postgresql://${auth}@${DB_HOST}:${DB_PORT}/${encodeURIComponent(DB_NAME)}`;
}
