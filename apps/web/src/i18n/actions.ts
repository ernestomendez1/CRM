'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { LOCALE_COOKIE, locales, type Locale } from './config';

export async function setLocale(locale: Locale) {
  if (!(locales as readonly string[]).includes(locale)) {
    throw new Error(`Unsupported locale: ${locale}`);
  }
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    httpOnly: false,
  });
  revalidatePath('/', 'layout');
}
