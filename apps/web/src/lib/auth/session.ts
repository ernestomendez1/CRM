import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@crm/db/server';

export async function getSession() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

export async function requireUser() {
  const user = await getSession();
  if (!user) redirect('/login');
  return user;
}

export type CurrentContext = {
  userId: string;
  email: string;
  businessId: string;
  role: string;
};

export type CurrentContextResult =
  | { status: 'ready'; context: CurrentContext }
  | { status: 'unauthenticated' }
  | { status: 'no_business' };

export async function getCurrentContextResult(): Promise<CurrentContextResult> {
  const user = await getSession();
  if (!user) return { status: 'unauthenticated' };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('business_members')
    .select('business_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load business membership: ${error.message}`);
  }

  if (!data) {
    return { status: 'no_business' };
  }

  return {
    status: 'ready',
    context: {
      userId: user.id,
      email: user.email ?? '',
      businessId: (data as { business_id: string }).business_id,
      role: (data as { role: string }).role,
    },
  };
}

/**
 * Returns the authenticated user + their first business membership.
 * Throws (redirects to /login) if unauthenticated.
 * Throws (redirects to /no-business) if the user has no business yet.
 *
 * For multi-business support later: replace this with a business switcher
 * that reads selected business from a cookie or URL param.
 */
export async function requireBusiness(): Promise<CurrentContext> {
  const result = await getCurrentContextResult();
  if (result.status === 'unauthenticated') {
    redirect('/login');
  }
  if (result.status === 'no_business') {
    redirect('/no-business');
  }
  return result.context;
}

export type StaffContext = {
  userId: string;
  email: string;
  staffRole: 'admin' | 'support';
};

/**
 * Returns the authenticated user if they are platform staff. Distinct from
 * business roles (owner/admin/accountant/viewer) — staff lives in the
 * `staff_users` table and operates the platform itself (admin console).
 *
 * Redirects to /login if unauthenticated, /dashboard if logged in but not staff.
 */
export async function requireStaff(): Promise<StaffContext> {
  const user = await getSession();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('staff_users')
    .select('role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load staff membership: ${error.message}`);
  }
  if (!data) redirect('/dashboard');

  return {
    userId: user.id,
    email: user.email ?? '',
    staffRole: (data as { role: 'admin' | 'support' }).role,
  };
}
