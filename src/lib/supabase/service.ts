import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

/**
 * Service-role client. Bypasses RLS. Use only in server-only code
 * that needs elevated privileges (admin invites, migrations, scheduled jobs).
 * NEVER expose this client or its key to a browser context.
 */
export function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
