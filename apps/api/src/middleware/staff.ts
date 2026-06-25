import { eq } from 'drizzle-orm';
import type { MiddlewareHandler } from 'hono';
import { staffUsers } from '@crm/db/schema';
import { getDb } from '../lib/db';
import { AppError, forbiddenError } from '../lib/errors';
import { getSupabaseAuth } from '../lib/supabase-auth';

export type StaffCtx = {
  userId: string;
  email: string;
  staffRole: 'admin' | 'support';
  jwt: string;
};

export type StaffEnv = {
  Variables: { staff: StaffCtx };
};

/**
 * Same JWT verification as authMiddleware, but instead of looking up
 * a business membership, looks up a row in staff_users. If absent → 403.
 */
export const staffMiddleware: MiddlewareHandler<StaffEnv> = async (c, next) => {
  const header = c.req.header('authorization') ?? c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new AppError(401, 'Missing bearer token');
  }
  const jwt = header.slice('Bearer '.length).trim();
  if (!jwt) throw new AppError(401, 'Empty bearer token');

  const supabase = getSupabaseAuth();
  const { data, error } = await supabase.auth.getUser(jwt);
  if (error || !data.user) {
    throw new AppError(401, 'Invalid or expired token');
  }

  const db = getDb();
  const rows = await db
    .select({ role: staffUsers.role })
    .from(staffUsers)
    .where(eq(staffUsers.userId, data.user.id))
    .limit(1);

  const row = rows[0];
  if (!row) throw forbiddenError('Not a staff user');

  c.set('staff', {
    userId: data.user.id,
    email: data.user.email ?? '',
    staffRole: row.role as 'admin' | 'support',
    jwt,
  });

  await next();
};

export function getStaff(c: { get: (key: 'staff') => StaffCtx | undefined }): StaffCtx {
  const staff = c.get('staff');
  if (!staff) {
    throw new AppError(500, 'staff middleware did not run before handler');
  }
  return staff;
}
