'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  CustomerCombobox,
  type CustomerOption,
} from '@/components/forms/customer-combobox';
import { LineItemsTable, type LineItemRow } from '@/components/forms/line-items-table';
import type { ProductOption } from '@/components/forms/product-combobox';
import type { QuotationActionResult } from './actions';

export type { CustomerOption } from '@/components/forms/customer-combobox';

type Props = {
  customers: CustomerOption[];
  products: ProductOption[];
  defaultTaxRate: number;
  currency: string;
  locale: string;
  defaults?: {
    customer_id?: string;
    issue_date?: string;
    expiry_date?: string;
    notes?: string;
    terms?: string;
    items?: LineItemRow[];
  };
  action: (
    prev: QuotationActionResult | null,
    formData: FormData,
  ) => Promise<QuotationActionResult>;
};

export function QuotationForm({
  customers: customersProp,
  products: productsProp,
  defaultTaxRate,
  currency,
  locale,
  defaults,
  action,
}: Props) {
  const t = useTranslations('quotations');
  const tc = useTranslations('common');
  const [state, formAction, pending] = useActionState<QuotationActionResult | null, FormData>(
    action,
    null,
  );

  const [customers, setCustomers] = useState<CustomerOption[]>(customersProp);
  const [products, setProducts] = useState<ProductOption[]>(productsProp);

  const err = (key: string) =>
    state && !state.ok && state.fieldErrors?.[key]?.[0] ? state.fieldErrors[key][0] : null;

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 max-w-4xl">
        <div className="space-y-1.5">
          <Label htmlFor="customer_id">{t('fields.customer')} *</Label>
          <CustomerCombobox
            id="customer_id"
            name="customer_id"
            required
            customers={customers}
            defaultValue={defaults?.customer_id}
            onCreated={(c) => setCustomers((prev) => [c, ...prev])}
          />
          {err('customer_id') && <p className="text-xs text-red-600">{err('customer_id')}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="currency">{t('fields.currency')}</Label>
          <Input
            id="currency"
            name="currency"
            defaultValue={currency}
            maxLength={3}
            className="uppercase"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="issue_date">{t('fields.issueDate')} *</Label>
          <Input
            id="issue_date"
            name="issue_date"
            type="date"
            required
            defaultValue={defaults?.issue_date ?? today}
          />
          {err('issue_date') && <p className="text-xs text-red-600">{err('issue_date')}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="expiry_date">{t('fields.expiryDate')}</Label>
          <Input
            id="expiry_date"
            name="expiry_date"
            type="date"
            defaultValue={defaults?.expiry_date ?? ''}
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="notes">{t('fields.notes')}</Label>
          <Textarea id="notes" name="notes" rows={2} defaultValue={defaults?.notes ?? ''} />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="terms">{t('fields.terms')}</Label>
          <Textarea id="terms" name="terms" rows={2} defaultValue={defaults?.terms ?? ''} />
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">{t('lineItems.title')}</h2>
        <LineItemsTable
          products={products}
          defaultTaxRate={defaultTaxRate}
          currency={currency}
          locale={locale}
          initial={defaults?.items}
          onProductCreated={(p) => setProducts((prev) => [p, ...prev])}
        />
        {err('items') && <p className="text-xs text-red-600 mt-1">{err('items')}</p>}
      </div>

      {state && !state.ok && !state.fieldErrors && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? '…' : tc('save')}
      </Button>
    </form>
  );
}
