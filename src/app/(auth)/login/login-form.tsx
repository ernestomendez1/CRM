'use client';

import { useActionState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signInWithMagicLink, signInWithPassword, type SignInState } from './actions';

export function LoginForm() {
  const t = useTranslations('auth');
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/dashboard';

  const [pwState, pwAction, pwPending] = useActionState<SignInState | null, FormData>(
    signInWithPassword,
    null,
  );
  const [magicState, magicAction, magicPending] = useActionState<SignInState | null, FormData>(
    signInWithMagicLink,
    null,
  );

  const error =
    (pwState && !pwState.ok && pwState.error) ||
    (magicState && !magicState.ok && magicState.error) ||
    null;

  return (
    <div className="space-y-6">
      <form action={pwAction} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <div className="space-y-2">
          <Label htmlFor="email">{t('email')}</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">{t('password')}</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={pwPending}>
          {pwPending ? '…' : t('signInButton')}
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">or</span>
        </div>
      </div>

      <form action={magicAction} className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="magic-email">{t('email')}</Label>
          <Input id="magic-email" name="email" type="email" autoComplete="email" required />
        </div>
        <Button type="submit" variant="outline" className="w-full" disabled={magicPending}>
          {magicPending ? '…' : t('magicLink')}
        </Button>
      </form>

      {magicState?.ok && (
        <p className="text-sm text-green-600 text-center">{t('magicLinkSent')}</p>
      )}
      {error && <p className="text-sm text-red-600 text-center">{error}</p>}
    </div>
  );
}
