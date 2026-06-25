import { eq } from 'drizzle-orm';
import { businessMembers } from '@crm/db/schema';
import type { MiddlewareHandler } from 'hono';
import { getDb } from '../lib/db';
import { forbiddenError, AppError } from '../lib/errors';
import { getSupabaseAuth } from '../lib/supabase-auth';

export type Ctx = {
  userId: string;
  email: string;
  businessId: string;
  role: string;
  jwt: string;
};

export type AuthEnv = {
  Variables: { ctx: Ctx };
};

export const authMiddleware: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const header = c.req.header('authorization') ?? c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new AppError(401, 'Missing bearer token');
  }
  const jwt = header.slice('Bearer '.length).trim();
  if (!jwt) {
    throw new AppError(401, 'Empty bearer token');
  }

  const supabase = getSupabaseAuth();
  const { data, error } = await supabase.auth.getUser(jwt);
  if (error || !data.user) {
    throw new AppError(401, 'Invalid or expired token');
  }

  const db = getDb();
  const member = await db
    .select({ businessId: businessMembers.businessId, role: businessMembers.role })
    .from(businessMembers)
    .where(eq(businessMembers.userId, data.user.id))
    .limit(1);

  if (member.length === 0 || !member[0]) {
    throw forbiddenError('No business membership');
  }

  c.set('ctx', {
    userId: data.user.id,
    email: data.user.email ?? '',
    businessId: member[0].businessId,
    role: member[0].role,
    jwt,
  });

  await next();
};

export function getCtx(c: { get: (key: 'ctx') => Ctx | undefined }): Ctx {
  const ctx = c.get('ctx');
  if (!ctx) {
    throw new AppError(500, 'auth middleware did not run before handler');
  }
  return ctx;
}
