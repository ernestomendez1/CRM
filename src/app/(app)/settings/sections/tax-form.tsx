'use client';

import { useActionState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateTaxSettings, type SettingsResult } from '../actions';

export type TaxDefaults = {
  default_currency: string;
  default_tax_rate: number;
  default_payment_terms_days: number;
};

export function TaxForm({ defaults }: { defaults: TaxDefaults }) {
  const t = useTranslations('settings.tax.fields');
  const tn = useTranslations('settings');
  const tc = useTranslations('common');
  const [state, action, pending] = useActionState<SettingsResult | null, FormData>(
    updateTaxSettings,
    null,
  );

  useEffect(() => {
    if (state?.ok) toast.success(tn('saved'));
    else if (state && !state.ok && !state.fieldErrors) toast.error(state.error);
  }, [state, tn]);

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-3 max-w-2xl">
      <div className="space-y-1.5">
        <Label htmlFor="default_currency">{t('currency')}</Label>
        <Input
          id="default_currency"
          name="default_currency"
          maxLength={3}
          className="uppercase"
          defaultValue={defaults.default_currency}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="default_tax_rate">{t('defaultTaxRate')}</Label>
        <Input
          id="default_tax_rate"
          name="default_tax_rate"
          type="number"
          inputMode="decimal"
          step="0.0001"
          min="0"
          max="1"
          defaultValue={defaults.default_tax_rate}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="default_payment_terms_days">{t('paymentTerms')}</Label>
        <Input
          id="default_payment_terms_days"
          name="default_payment_terms_days"
          type="number"
          min="0"
          max="365"
          defaultValue={defaults.default_payment_terms_days}
          required
        />
      </div>
      <div className="sm:col-span-3">
        <Button type="submit" disabled={pending}>
          {pending ? '…' : tc('save')}
        </Button>
      </div>
    </form>
  );
}
