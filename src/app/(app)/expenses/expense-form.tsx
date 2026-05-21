'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ExpenseActionResult } from './actions';
import type { Expense } from '@/lib/validation/expense';
import { expensePaymentMethods } from '@/lib/validation/expense';

type Props = {
  expense?: Expense;
  defaultCurrency: string;
  action: (
    prev: ExpenseActionResult | null,
    formData: FormData,
  ) => Promise<ExpenseActionResult>;
};

export function ExpenseForm({ expense, defaultCurrency, action }: Props) {
  const t = useTranslations('expenses');
  const tc = useTranslations('common');
  const [state, formAction, pending] = useActionState<ExpenseActionResult | null, FormData>(
    action,
    null,
  );

  const err = (k: string) =>
    state && !state.ok && state.fieldErrors?.[k]?.[0] ? state.fieldErrors[k][0] : null;

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} encType="multipart/form-data" className="space-y-6 max-w-3xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="vendor_name">{t('fields.vendorName')} *</Label>
          <Input
            id="vendor_name"
            name="vendor_name"
            required
            defaultValue={expense?.vendor_name ?? ''}
          />
          {err('vendor_name') && <p className="text-xs text-red-600">{err('vendor_name')}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="vendor_tax_id">{t('fields.vendorTaxId')}</Label>
          <Input
            id="vendor_tax_id"
            name="vendor_tax_id"
            defaultValue={expense?.vendor_tax_id ?? ''}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="expense_date">{t('fields.expenseDate')} *</Label>
          <Input
            id="expense_date"
            name="expense_date"
            type="date"
            required
            defaultValue={expense?.expense_date ?? today}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="category">{t('fields.category')}</Label>
          <Input
            id="category"
            name="category"
            defaultValue={expense?.category ?? ''}
            placeholder="e.g. Office, Software, Travel"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="currency">{t('fields.currency')}</Label>
          <Input
            id="currency"
            name="currency"
            defaultValue={expense?.currency ?? defaultCurrency}
            maxLength={3}
            className="uppercase"
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="description">{t('fields.description')}</Label>
          <Textarea
            id="description"
            name="description"
            rows={2}
            defaultValue={expense?.description ?? ''}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="subtotal">{t('fields.subtotal')} *</Label>
          <Input
            id="subtotal"
            name="subtotal"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={expense?.subtotal ?? 0}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tax_amount">{t('fields.taxAmount')}</Label>
          <Input
            id="tax_amount"
            name="tax_amount"
            type="number"
            step="0.01"
            min="0"
            defaultValue={expense?.tax_amount ?? 0}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="payment_method">{t('fields.paymentMethod')}</Label>
          <Select
            name="payment_method"
            defaultValue={expense?.payment_method ?? undefined}
          >
            <SelectTrigger id="payment_method" className="w-full">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {expensePaymentMethods.map((m) => (
                <SelectItem key={m} value={m}>
                  {t(`paymentMethods.${m}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 sm:col-span-2">
          <Checkbox
            id="has_fiscal_receipt"
            name="has_fiscal_receipt"
            defaultChecked={expense?.has_fiscal_receipt ?? false}
          />
          <Label htmlFor="has_fiscal_receipt" className="cursor-pointer">
            {t('fields.hasFiscalReceipt')}
          </Label>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="fiscal_receipt_number">{t('fields.fiscalReceiptNumber')}</Label>
          <Input
            id="fiscal_receipt_number"
            name="fiscal_receipt_number"
            defaultValue={expense?.fiscal_receipt_number ?? ''}
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="receipt">{t('fields.receipt')}</Label>
          <input
            id="receipt"
            name="receipt"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/heic,application/pdf"
            className="text-sm"
          />
          <p className="text-xs text-muted-foreground">{t('fields.receiptHint')}</p>
        </div>
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
