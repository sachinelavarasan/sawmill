import { databaseUrl, dbSsl, migrationCredentials } from './url';

const parts = { DB_HOST: 'ep-x-pooler.neon.tech', DB_PORT: '5432', DB_NAME: 'neondb', DB_USER: 'neondb_owner', DB_PASSWORD: 'p@ss:w/rd' };

describe('databaseUrl', () => {
  it('prefers DATABASE_URL', () => {
    expect(databaseUrl({ ...parts, DATABASE_URL: 'postgresql://u:p@h/db' })).toBe('postgresql://u:p@h/db');
  });

  it('builds from DB_* parts without TLS in development', () => {
    expect(databaseUrl({ ...parts, NODE_ENV: 'development' })).toBe('postgresql://neondb_owner:p%40ss%3Aw%2Frd@ep-x-pooler.neon.tech:5432/neondb');
  });

  it('turns TLS on in production', () => {
    expect(databaseUrl({ ...parts, NODE_ENV: 'production' })).toMatch(/\/neondb\?sslmode=verify-full$/);
  });

  it('DB_SSL overrides the default both ways', () => {
    expect(databaseUrl({ ...parts, DB_SSL: 'true' })).toContain('sslmode=verify-full');
    expect(databaseUrl({ ...parts, NODE_ENV: 'production', DB_SSL: 'false' })).not.toContain('sslmode');
  });

  it('needs at least DB_NAME and DB_USER', () => {
    expect(() => databaseUrl({ DB_HOST: 'h' })).toThrow(/DATABASE_URL/);
  });
});

describe('dbSsl', () => {
  it('defaults to production only', () => {
    expect(dbSsl({ NODE_ENV: 'production' })).toBe(true);
    expect(dbSsl({})).toBe(false);
    expect(dbSsl({ DB_SSL: 'TRUE' })).toBe(true);
  });
});

describe('migrationCredentials', () => {
  it('uses DATABASE_URL_UNPOOLED, then DATABASE_URL', () => {
    expect(migrationCredentials({ ...parts, DATABASE_URL: 'postgresql://pooled/db', DATABASE_URL_UNPOOLED: 'postgresql://direct/db' })).toEqual({ url: 'postgresql://direct/db' });
    expect(migrationCredentials({ ...parts, DATABASE_URL: 'postgresql://pooled/db' })).toEqual({ url: 'postgresql://pooled/db' });
  });

  it('builds from DB_* parts, preferring DB_HOST_UNPOOLED, with ssl in production', () => {
    expect(migrationCredentials({ ...parts, NODE_ENV: 'production', DB_HOST_UNPOOLED: 'ep-x.neon.tech' })).toEqual({
      host: 'ep-x.neon.tech',
      port: 5432,
      user: 'neondb_owner',
      password: 'p@ss:w/rd',
      database: 'neondb',
      ssl: true,
    });
  });

  it('uses DB_HOST without ssl in development', () => {
    expect(migrationCredentials(parts)).toMatchObject({ host: 'ep-x-pooler.neon.tech', ssl: false });
  });
});
