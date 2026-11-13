import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import { databaseUrl } from './src/db/url';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: databaseUrl() },
  strict: true,
  verbose: true,
});
