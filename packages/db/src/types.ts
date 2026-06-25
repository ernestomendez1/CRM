/**
 * Placeholder Database type. Until we generate proper types from a live
 * Supabase project, queries are typed loosely. Generate real types with:
 *   supabase gen types typescript --linked > src/lib/supabase/types.ts
 *
 * Note: using `any` for table shapes is deliberate while we bootstrap.
 * Replace before shipping to production.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export type Database = any;
