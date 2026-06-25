import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

let cached: SupabaseClient | undefined;

/**
 * Service-role Supabase client used ONLY for storage operations
 * (uploads, deletes, signed URLs). Bypasses RLS. DB writes go through
 * Drizzle, not this client.
 */
export function getSupabaseStorage(): SupabaseClient {
  if (!cached) {
    cached = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );
  }
  return cached;
}

/**
 * Public URLs look like .../storage/v1/object/public/<bucket>/<path>
 * Returns the <path> portion or null if not a recognizable public URL.
 */
export function extractStoragePath(
  publicUrl: string,
  bucket: string,
): string | null {
  const marker = `/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return publicUrl.slice(idx + marker.length);
}
