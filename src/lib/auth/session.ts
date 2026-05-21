import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

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

/**
 * Returns the authenticated user + their first business membership.
 * Throws (redirects to /login) if unauthenticated.
 * Throws (redirects to /no-business) if the user has no business yet.
 *
 * For multi-business support later: replace this with a business switcher
 * that reads selected business from a cookie or URL param.
 */
export async function requireBusiness(): Promise<CurrentContext> {
  const user = await requireUser();
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
    redirect('/no-business');
  }

  return {
    userId: user.id,
    email: user.email ?? '',
    businessId: (data as { business_id: string }).business_id,
    role: (data as { role: string }).role,
  };
}
