'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { updateProfile, type SettingsResult } from '../actions';

export type ProfileDefaults = {
  name?: string;
  legal_name?: string;
  tax_id?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
};

export function ProfileForm({ defaults }: { defaults: ProfileDefaults }) {
  const t = useTranslations('settings.profile.fields');
  const tn = useTranslations('settings');
  const tc = useTranslations('common');
  const [state, action, pending] = useActionState<SettingsResult | null, FormData>(
    updateProfile,
    null,
  );

  useEffect(() => {
    if (state?.ok) toast.success(tn('saved'));
    else if (state && !state.ok && !state.fieldErrors) toast.error(state.error);
  }, [state, tn]);

  const err = (k: string) =>
    state && !state.ok && state.fieldErrors?.[k]?.[0] ? state.fieldErrors[k][0] : null;

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2 max-w-2xl">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="name">{t('name')} *</Label>
        <Input id="name" name="name" required defaultValue={defaults.name ?? ''} />
        {err('name') && <p className="text-xs text-red-600">{err('name')}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="legal_name">{t('legalName')}</Label>
        <Input id="legal_name" name="legal_name" defaultValue={defaults.legal_name ?? ''} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="tax_id">{t('taxId')}</Label>
        <Input id="tax_id" name="tax_id" defaultValue={defaults.tax_id ?? ''} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">{t('email')}</Label>
        <Input id="email" name="email" type="email" defaultValue={defaults.email ?? ''} />
        {err('email') && <p className="text-xs text-red-600">{err('email')}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone">{t('phone')}</Label>
        <Input id="phone" name="phone" defaultValue={defaults.phone ?? ''} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="address">{t('address')}</Label>
        <Textarea id="address" name="address" rows={2} defaultValue={defaults.address ?? ''} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="city">{t('city')}</Label>
        <Input id="city" name="city" defaultValue={defaults.city ?? ''} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="country">{t('country')}</Label>
        <Input
          id="country"
          name="country"
          maxLength={2}
          className="uppercase"
          defaultValue={defaults.country ?? 'DO'}
        />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? '…' : tc('save')}
        </Button>
      </div>
    </form>
  );
}
