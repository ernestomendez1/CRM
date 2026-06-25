import { defineConfig } from 'drizzle-kit';

const url = process.env.SUPABASE_DB_POOLER_URL ?? process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    'drizzle.config.ts: set SUPABASE_DB_POOLER_URL (or DATABASE_URL) before running drizzle-kit',
  );
}

export default defineConfig({
  schema: './src/schema.ts',
  dialect: 'postgresql',
  dbCredentials: { url },
  introspect: { casing: 'preserve' },
  verbose: true,
  strict: true,
});
