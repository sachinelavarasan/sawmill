import { trustProxy, validateEnv } from './env';

const good = {
  NODE_ENV: 'production',
  JWT_ACCESS_SECRET: 'q8Zr2vN7xL0pT4yB6mK1cH9sW3eD5gJ8aF2uR7iO0nV',
  DB_NAME: 'sawmill',
  DB_USER: 'sawmill',
  DB_PASSWORD: 'Xk29-long-random',
  CORS_ORIGINS: 'https://mill.example.in',
};

describe('validateEnv', () => {
  it('accepts a complete production environment', () => {
    expect(() => validateEnv(good)).not.toThrow();
  });

  it('is forgiving in development', () => {
    expect(() => validateEnv({ JWT_ACCESS_SECRET: 'change-me-access-secret', CORS_ORIGINS: 'http://localhost:5173' })).not.toThrow();
  });

  it('always needs a JWT secret', () => {
    expect(() => validateEnv({})).toThrow(/JWT_ACCESS_SECRET/);
  });

  it.each([
    ['example JWT secret', { JWT_ACCESS_SECRET: 'change-me-access-secret-but-quite-long-now' }, /JWT_ACCESS_SECRET/],
    ['short JWT secret', { JWT_ACCESS_SECRET: 'only-twenty-chars!!!' }, /JWT_ACCESS_SECRET/],
    ['example DB password', { DB_PASSWORD: 'change-me' }, /DB_PASSWORD/],
    ['wildcard CORS', { CORS_ORIGINS: '*' }, /CORS_ORIGINS/],
    ['localhost CORS', { CORS_ORIGINS: 'https://mill.example.in,http://localhost:5173' }, /CORS_ORIGINS/],
    ['seed password', { SEED_OWNER_PASSWORD: 'Owner@123' }, /SEED_OWNER_PASSWORD/],
    ['bad refresh TTL', { REFRESH_TOKEN_TTL_DAYS: '365' }, /REFRESH_TOKEN_TTL_DAYS/],
    ['bad TRUST_PROXY', { TRUST_PROXY: 'yes please' }, /TRUST_PROXY/],
  ])('refuses %s in production', (_, override, message) => {
    expect(() => validateEnv({ ...good, ...override })).toThrow(message);
  });

  it('a DATABASE_URL replaces the DB_* values', () => {
    expect(() => validateEnv({ ...good, DB_NAME: '', DB_USER: '', DB_PASSWORD: '', DATABASE_URL: 'postgresql://u:p@db/sawmill' })).not.toThrow();
  });
});

describe('trustProxy', () => {
  it.each([
    [undefined, false],
    ['false', false],
    ['true', true],
    ['1', 1],
    ['loopback', 'loopback'],
  ])('%s → %s', (raw, expected) => expect(trustProxy(raw)).toBe(expected));
});
