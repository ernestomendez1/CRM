'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@crm/db/server';

export type SignInState =
  | { ok: true }
  | { ok: false; error: string };

export async function signInWithPassword(
  _prev: SignInState | null,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '/dashboard');

  if (!email || !password) {
    return { ok: false, error: 'Email and password are required.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };

  redirect(next || '/dashboard');
}

export async function signInWithMagicLink(
  _prev: SignInState | null,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get('email') ?? '').trim();
  if (!email) return { ok: false, error: 'Email is required.' };

  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${appUrl}/auth/callback` },
  });
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
