import { createDrizzleClient, type DrizzleClient } from '@crm/db/drizzle';
import { env } from './env';

let cached: DrizzleClient | undefined;

export function getDb(): DrizzleClient {
  if (!cached) {
    cached = createDrizzleClient(env.SUPABASE_DB_POOLER_URL);
  }
  return cached;
}
