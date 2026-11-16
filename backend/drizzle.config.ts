import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import { migrationCredentials } from './src/db/url';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  // host/port/user/password/database/ssl from DB_* (or a URL if one is set) — see src/db/url.ts
  dbCredentials: migrationCredentials(),
  strict: true,
  verbose: true,
});
