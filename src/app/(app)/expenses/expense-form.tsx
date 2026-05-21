'use client';

import { useActionState, useRef, useState, type ChangeEvent } from 'react';
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
import {
  canExtractExpenseReceipt,
  type ExpenseExtractionWarningCode,
} from '@/lib/ai/expense-extraction';
import type { ExpenseActionResult } from './actions';
import type { Expense, ExpensePaymentMethod } from '@/lib/validation/expense';
import { expensePaymentMethods } from '@/lib/validation/expense';

type Props = {
  expense?: Expense;
  defaultCurrency: string;
  action: (
    prev: ExpenseActionResult | null,
    formData: FormData,
  ) => Promise<ExpenseActionResult>;
};

type ExpenseFormDraft = {
  vendor_name: string;
  vendor_tax_id: string;
  expense_date: string;
  category: string;
  description: string;
  subtotal: string;
  tax_amount: string;
  currency: string;
  has_fiscal_receipt: boolean;
  fiscal_receipt_number: string;
  payment_method: ExpensePaymentMethod | '';
};

type ExtractedExpenseDraft = {
  vendor_name: string | null;
  vendor_tax_id: string | null;
  expense_date: string | null;
  category: string | null;
  description: string | null;
  subtotal: number | null;
  tax_amount: number | null;
  currency: string;
  has_fiscal_receipt: boolean;
  fiscal_receipt_number: string | null;
};

type ExpenseExtractionApiResponse =
  | {
      ok: true;
      extracted: ExtractedExpenseDraft;
      warnings: ExpenseExtractionWarningCode[];
    }
  | {
      ok: false;
      errorCode: string;
    };

type ExtractionState =
  | { status: 'idle'; warnings: ExpenseExtractionWarningCode[]; errorCode: null }
  | { status: 'loading'; warnings: ExpenseExtractionWarningCode[]; errorCode: null }
  | { status: 'success'; warnings: ExpenseExtractionWarningCode[]; errorCode: null }
  | { status: 'error'; warnings: ExpenseExtractionWarningCode[]; errorCode: string };

function formatMoneyInput(value: number | null | undefined) {
  if (value == null) return '';
  return String(value);
}

function buildInitialDraft(expense: Expense | undefined, defaultCurrency: string): ExpenseFormDraft {
  const today = new Date().toISOString().slice(0, 10);

  return {
    vendor_name: expense?.vendor_name ?? '',
    vendor_tax_id: expense?.vendor_tax_id ?? '',
    expense_date: expense?.expense_date ?? today,
    category: expense?.category ?? '',
    description: expense?.description ?? '',
    subtotal: expense ? formatMoneyInput(expense.subtotal) : '',
    tax_amount: formatMoneyInput(expense?.tax_amount ?? 0),
    currency: expense?.currency ?? defaultCurrency,
    has_fiscal_receipt: expense?.has_fiscal_receipt ?? false,
    fiscal_receipt_number: expense?.fiscal_receipt_number ?? '',
    payment_method: expense?.payment_method ?? '',
  };
}

function applyExtractedDraft(
  current: ExpenseFormDraft,
  extracted: ExtractedExpenseDraft,
  defaultCurrency: string,
  preserveMissingFields: boolean,
): ExpenseFormDraft {
  const shouldOverwriteCurrency =
    extracted.currency !== defaultCurrency ||
    !current.currency ||
    current.currency.toUpperCase() === defaultCurrency.toUpperCase();

  return {
    ...current,
    vendor_name:
      extracted.vendor_name ?? (preserveMissingFields ? current.vendor_name : ''),
    vendor_tax_id: extracted.vendor_tax_id ?? current.vendor_tax_id,
    expense_date:
      extracted.expense_date ?? (preserveMissingFields ? current.expense_date : ''),
    category: extracted.category ?? (preserveMissingFields ? current.category : ''),
    description:
      extracted.description ?? (preserveMissingFields ? current.description : ''),
    subtotal:
      extracted.subtotal != null
        ? formatMoneyInput(extracted.subtotal)
        : preserveMissingFields
          ? current.subtotal
          : '',
    tax_amount:
      extracted.tax_amount != null ? formatMoneyInput(extracted.tax_amount) : current.tax_amount,
    currency: shouldOverwriteCurrency ? extracted.currency : current.currency,
    has_fiscal_receipt: extracted.has_fiscal_receipt,
    fiscal_receipt_number: extracted.fiscal_receipt_number ?? current.fiscal_receipt_number,
  };
}

function getExtractionErrorMessageKey(errorCode: string) {
  switch (errorCode) {
    case 'unsupported_type':
      return 'extraction.errors.unsupportedType';
    case 'missing_api_key':
      return 'extraction.errors.unavailable';
    case 'provider_quota':
      return 'extraction.errors.quota';
    case 'invalid_file':
      return 'extraction.errors.invalidFile';
    default:
      return 'extraction.errors.failed';
  }
}

export function ExpenseForm({ expense, defaultCurrency, action }: Props) {
  const t = useTranslations('expenses');
  const tc = useTranslations('common');
  const [state, formAction, pending] = useActionState<ExpenseActionResult | null, FormData>(
    action,
    null,
  );
  const [draft, setDraft] = useState<ExpenseFormDraft>(() =>
    buildInitialDraft(expense, defaultCurrency),
  );
  const [extractionState, setExtractionState] = useState<ExtractionState>({
    status: 'idle',
    warnings: [],
    errorCode: null,
  });
  const extractionRequestId = useRef(0);

  const err = (k: string) =>
    state && !state.ok && state.fieldErrors?.[k]?.[0] ? state.fieldErrors[k][0] : null;

  async function handleReceiptChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    extractionRequestId.current += 1;
    const requestId = extractionRequestId.current;

    if (!file) {
      setExtractionState({ status: 'idle', warnings: [], errorCode: null });
      return;
    }

    if (!canExtractExpenseReceipt(file.type)) {
      setExtractionState({
        status: 'error',
        warnings: [],
        errorCode: 'unsupported_type',
      });
      return;
    }

    setExtractionState({ status: 'loading', warnings: [], errorCode: null });

    const formData = new FormData();
    formData.append('receipt', file);

    try {
      const response = await fetch('/api/expenses/extract', {
        method: 'POST',
        body: formData,
      });
      const payload = (await response.json()) as ExpenseExtractionApiResponse;

      if (requestId !== extractionRequestId.current) return;

      if (!response.ok || !payload.ok) {
        setExtractionState({
          status: 'error',
          warnings: [],
          errorCode: payload.ok ? 'failed' : payload.errorCode,
        });
        return;
      }

      setDraft((current) =>
        applyExtractedDraft(current, payload.extracted, defaultCurrency, Boolean(expense)),
      );
      setExtractionState({
        status: 'success',
        warnings: payload.warnings,
        errorCode: null,
      });
    } catch {
      if (requestId !== extractionRequestId.current) return;

      setExtractionState({
        status: 'error',
        warnings: [],
        errorCode: 'failed',
      });
    }
  }

  return (
    <form action={formAction} encType="multipart/form-data" className="max-w-3xl space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="vendor_name">{t('fields.vendorName')} *</Label>
          <Input
            id="vendor_name"
            name="vendor_name"
            required
            value={draft.vendor_name}
            onChange={(event) =>
              setDraft((current) => ({ ...current, vendor_name: event.target.value }))
            }
          />
          {err('vendor_name') && <p className="text-xs text-red-600">{err('vendor_name')}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="vendor_tax_id">{t('fields.vendorTaxId')}</Label>
          <Input
            id="vendor_tax_id"
            name="vendor_tax_id"
            value={draft.vendor_tax_id}
            onChange={(event) =>
              setDraft((current) => ({ ...current, vendor_tax_id: event.target.value }))
            }
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="expense_date">{t('fields.expenseDate')} *</Label>
          <Input
            id="expense_date"
            name="expense_date"
            type="date"
            required
            value={draft.expense_date}
            onChange={(event) =>
              setDraft((current) => ({ ...current, expense_date: event.target.value }))
            }
          />
          {err('expense_date') && <p className="text-xs text-red-600">{err('expense_date')}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="category">{t('fields.category')}</Label>
          <Input
            id="category"
            name="category"
            value={draft.category}
            onChange={(event) =>
              setDraft((current) => ({ ...current, category: event.target.value }))
            }
            placeholder="e.g. Office, Software, Travel"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="currency">{t('fields.currency')}</Label>
          <Input
            id="currency"
            name="currency"
            maxLength={3}
            className="uppercase"
            value={draft.currency}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                currency: event.target.value.toUpperCase(),
              }))
            }
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="description">{t('fields.description')}</Label>
          <Textarea
            id="description"
            name="description"
            rows={2}
            value={draft.description}
            onChange={(event) =>
              setDraft((current) => ({ ...current, description: event.target.value }))
            }
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
            value={draft.subtotal}
            onChange={(event) =>
              setDraft((current) => ({ ...current, subtotal: event.target.value }))
            }
          />
          {err('subtotal') && <p className="text-xs text-red-600">{err('subtotal')}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tax_amount">{t('fields.taxAmount')}</Label>
          <Input
            id="tax_amount"
            name="tax_amount"
            type="number"
            step="0.01"
            min="0"
            value={draft.tax_amount}
            onChange={(event) =>
              setDraft((current) => ({ ...current, tax_amount: event.target.value }))
            }
          />
          {err('tax_amount') && <p className="text-xs text-red-600">{err('tax_amount')}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="payment_method">{t('fields.paymentMethod')}</Label>
          <Select
            name="payment_method"
            value={draft.payment_method || undefined}
            onValueChange={(value) =>
              setDraft((current) => ({
                ...current,
                payment_method: value as ExpensePaymentMethod,
              }))
            }
          >
            <SelectTrigger id="payment_method" className="w-full">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {expensePaymentMethods.map((method) => (
                <SelectItem key={method} value={method}>
                  {t(`paymentMethods.${method}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 sm:col-span-2">
          <Checkbox
            id="has_fiscal_receipt"
            name="has_fiscal_receipt"
            checked={draft.has_fiscal_receipt}
            onCheckedChange={(checked) =>
              setDraft((current) => ({
                ...current,
                has_fiscal_receipt: Boolean(checked),
              }))
            }
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
            value={draft.fiscal_receipt_number}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                fiscal_receipt_number: event.target.value,
              }))
            }
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
            onChange={handleReceiptChange}
          />
          <p className="text-xs text-muted-foreground">{t('fields.receiptHint')}</p>
          <p className="text-xs text-muted-foreground">{t('fields.receiptAiHint')}</p>

          {extractionState.status === 'loading' && (
            <p className="text-sm text-muted-foreground">{t('extraction.analyzing')}</p>
          )}

          {extractionState.status === 'success' && (
            <div className="space-y-1">
              <p className="text-sm text-emerald-700">{t('extraction.ready')}</p>
              <p className="text-xs text-muted-foreground">{t('extraction.reviewBeforeSave')}</p>
              {extractionState.warnings.map((warning) => (
                <p key={warning} className="text-xs text-amber-700">
                  {t(`extraction.warnings.${warning}`)}
                </p>
              ))}
            </div>
          )}

          {extractionState.status === 'error' && extractionState.errorCode && (
            <p className="text-sm text-amber-700">
              {t(getExtractionErrorMessageKey(extractionState.errorCode))}
            </p>
          )}
        </div>
      </div>

      {state && !state.ok && !state.fieldErrors && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}

      <Button type="submit" disabled={pending || extractionState.status === 'loading'}>
        {pending ? '…' : tc('save')}
      </Button>
    </form>
  );
}
