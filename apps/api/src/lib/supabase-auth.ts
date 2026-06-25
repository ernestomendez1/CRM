import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

let cached: SupabaseClient | undefined;

/**
 * Supabase client used ONLY to verify a forwarded JWT via auth.getUser(jwt).
 * We never call DB queries through it (those go through Drizzle). No session
 * persistence, no cookie storage.
 */
export function getSupabaseAuth(): SupabaseClient {
  if (!cached) {
    cached = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );
  }
  return cached;
}
