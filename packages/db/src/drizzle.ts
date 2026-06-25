import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

let cachedPool: Pool | undefined;

/**
 * Creates (or reuses) a Drizzle client backed by node-postgres.
 *
 * Pass the connection string explicitly to keep this module pure and
 * easy to test. In production the api passes `process.env.SUPABASE_DB_POOLER_URL`
 * (and later `process.env.DATABASE_URL` when the DB moves to Railway).
 *
 * The pool is cached per process so we don't open a new connection
 * pool on every call.
 */
export function createDrizzleClient(connectionString: string) {
  if (!cachedPool) {
    cachedPool = new Pool({ connectionString });
  }
  return drizzle(cachedPool, { schema });
}

export type DrizzleClient = ReturnType<typeof createDrizzleClient>;

export { schema };
