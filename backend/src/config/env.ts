/**
 * Startup check of the environment. Development stays forgiving; in production
 * the API refuses to start with example secrets, wildcard CORS or a missing
 * database setting — mistakes that otherwise only show up after an incident.
 */
const PLACEHOLDER = /change-?me|example|secret$|^password$/i;

export function validateEnv(env: Record<string, unknown>): Record<string, unknown> {
  const get = (k: string) => (env[k] === undefined || env[k] === null ? '' : String(env[k]).trim());
  const errors: string[] = [];
  const production = get('NODE_ENV') === 'production';

  const secret = get('JWT_ACCESS_SECRET');
  if (secret.length < 16) errors.push('JWT_ACCESS_SECRET must be set (at least 16 characters)');

  const port = Number(get('PORT') || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) errors.push('PORT must be a port number');

  const ttlDays = Number(get('REFRESH_TOKEN_TTL_DAYS') || 30);
  if (!(ttlDays > 0 && ttlDays <= 90)) errors.push('REFRESH_TOKEN_TTL_DAYS must be between 1 and 90');

  if (get('TRUST_PROXY') && !/^(\d+|loopback|true|false)$/.test(get('TRUST_PROXY'))) {
    errors.push('TRUST_PROXY must be a hop count (e.g. 1), "loopback", "true" or "false"');
  }

  if (production) {
    if (secret.length < 32 || PLACEHOLDER.test(secret)) {
      errors.push('JWT_ACCESS_SECRET must be a random value of 32+ characters in production (openssl rand -base64 48)');
    }
    if (!get('DATABASE_URL') && (!get('DB_NAME') || !get('DB_USER'))) {
      errors.push('Set DATABASE_URL or DB_NAME/DB_USER in production');
    }
    const dbPassword = get('DB_PASSWORD');
    if (!get('DATABASE_URL') && (!dbPassword || PLACEHOLDER.test(dbPassword))) {
      errors.push('DB_PASSWORD is empty or still the example value');
    }
    const origins = get('CORS_ORIGINS');
    if (!origins || origins.split(',').some((o) => o.trim() === '*' || o.includes('localhost'))) {
      errors.push('CORS_ORIGINS must list the real https:// web address(es) in production — no "*" or localhost');
    }
    for (const k of ['SEED_OWNER_PASSWORD', 'SEED_ACCOUNTANT_PASSWORD']) {
      if (get(k)) errors.push(`${k} must not be set in production (create the owner with "npm run setup:owner")`);
    }
  }

  if (errors.length) {
    throw new Error(`Invalid environment:\n  - ${errors.join('\n  - ')}`);
  }
  return env;
}

/** Express "trust proxy" value from TRUST_PROXY: a hop count, 'loopback', or a boolean. */
export function trustProxy(raw: string | undefined): boolean | number | string {
  if (!raw || raw === 'false') return false;
  if (raw === 'true') return true;
  return /^\d+$/.test(raw) ? Number(raw) : raw;
}
