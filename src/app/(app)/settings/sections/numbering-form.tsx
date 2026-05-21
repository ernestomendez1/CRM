'use client';

import { useActionState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateNumbering, type SettingsResult } from '../actions';

export type NumberingDefaults = {
  invoice_prefix: string;
  invoice_next_number: number;
  quotation_prefix: string;
  quotation_next_number: number;
};

export function NumberingForm({ defaults }: { defaults: NumberingDefaults }) {
  const t = useTranslations('settings.numbering.fields');
  const tn = useTranslations('settings');
  const tc = useTranslations('common');
  const [state, action, pending] = useActionState<SettingsResult | null, FormData>(
    updateNumbering,
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
      <div className="space-y-1.5">
        <Label htmlFor="invoice_prefix">{t('invoicePrefix')}</Label>
        <Input
          id="invoice_prefix"
          name="invoice_prefix"
          defaultValue={defaults.invoice_prefix}
          maxLength={10}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="invoice_next_number">{t('invoiceNext')}</Label>
        <Input
          id="invoice_next_number"
          name="invoice_next_number"
          type="number"
          min={defaults.invoice_next_number}
          defaultValue={defaults.invoice_next_number}
          required
        />
        {err('invoice_next_number') && (
          <p className="text-xs text-red-600">{err('invoice_next_number')}</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="quotation_prefix">{t('quotationPrefix')}</Label>
        <Input
          id="quotation_prefix"
          name="quotation_prefix"
          defaultValue={defaults.quotation_prefix}
          maxLength={10}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="quotation_next_number">{t('quotationNext')}</Label>
        <Input
          id="quotation_next_number"
          name="quotation_next_number"
          type="number"
          min={defaults.quotation_next_number}
          defaultValue={defaults.quotation_next_number}
          required
        />
        {err('quotation_next_number') && (
          <p className="text-xs text-red-600">{err('quotation_next_number')}</p>
        )}
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? '…' : tc('save')}
        </Button>
      </div>
    </form>
  );
}
