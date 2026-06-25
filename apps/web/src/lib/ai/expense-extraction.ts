import { z } from 'zod';

export const expenseAiSupportedMimeTypes = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

export type ExpenseAiSupportedMimeType = (typeof expenseAiSupportedMimeTypes)[number];

export function canExtractExpenseReceipt(mimeType: string) {
  return expenseAiSupportedMimeTypes.includes(mimeType as ExpenseAiSupportedMimeType);
}

export const expenseExtractionWarningCodes = [
  'vendor_name_missing',
  'expense_date_missing',
  'subtotal_missing',
  'tax_missing_set_zero',
  'currency_defaulted',
  'fiscal_receipt_inferred_from_number',
] as const;

export type ExpenseExtractionWarningCode = (typeof expenseExtractionWarningCodes)[number];

const nullableTrimmedText = z
  .string()
  .nullable()
  .optional()
  .transform((value) => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  });

const nullableNumber = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value == null) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const normalized = trimmed.replace(/,/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  });

const nullableBoolean = z.union([z.boolean(), z.null(), z.undefined()]).transform((value) => {
  if (typeof value === 'boolean') return value;
  return null;
});

export const rawExpenseExtractionSchema = z.object({
  vendor_name: nullableTrimmedText,
  vendor_tax_id: nullableTrimmedText,
  expense_date: nullableTrimmedText,
  category: nullableTrimmedText,
  description: nullableTrimmedText,
  subtotal: nullableNumber,
  tax_amount: nullableNumber,
  currency: nullableTrimmedText,
  has_fiscal_receipt: nullableBoolean,
  fiscal_receipt_number: nullableTrimmedText,
});

export type RawExpenseExtraction = z.infer<typeof rawExpenseExtractionSchema>;

export type ExpenseExtractionDraft = {
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

export type NormalizedExpenseExtraction = {
  extracted: ExpenseExtractionDraft;
  warnings: ExpenseExtractionWarningCode[];
};

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeCurrency(value: string | null, fallbackCurrency: string) {
  const fallback = fallbackCurrency.trim().toUpperCase() || 'DOP';
  const normalized = value?.trim().toUpperCase() ?? '';
  if (/^[A-Z]{3}$/.test(normalized)) return { currency: normalized, defaulted: false };
  return { currency: fallback, defaulted: true };
}

function normalizeDate(value: string | null) {
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export function normalizeExpenseExtraction(
  raw: RawExpenseExtraction,
  options: { defaultCurrency: string },
): NormalizedExpenseExtraction {
  const warnings: ExpenseExtractionWarningCode[] = [];

  const vendorName = raw.vendor_name ?? null;
  if (!vendorName) warnings.push('vendor_name_missing');

  const expenseDate = normalizeDate(raw.expense_date);
  if (!expenseDate) warnings.push('expense_date_missing');

  const subtotal =
    raw.subtotal != null && raw.subtotal >= 0 ? roundMoney(raw.subtotal) : null;
  let taxAmount =
    raw.tax_amount != null && raw.tax_amount >= 0 ? roundMoney(raw.tax_amount) : null;

  if (subtotal == null) {
    warnings.push('subtotal_missing');
  } else if (taxAmount == null) {
    taxAmount = 0;
    warnings.push('tax_missing_set_zero');
  }

  const { currency, defaulted } = normalizeCurrency(raw.currency, options.defaultCurrency);
  if (defaulted) warnings.push('currency_defaulted');

  const fiscalReceiptNumber = raw.fiscal_receipt_number ?? null;
  let hasFiscalReceipt = raw.has_fiscal_receipt ?? false;
  if (fiscalReceiptNumber && !hasFiscalReceipt) {
    hasFiscalReceipt = true;
    warnings.push('fiscal_receipt_inferred_from_number');
  }

  return {
    extracted: {
      vendor_name: vendorName,
      vendor_tax_id: raw.vendor_tax_id ?? null,
      expense_date: expenseDate,
      category: raw.category ?? null,
      description: raw.description ?? null,
      subtotal,
      tax_amount: taxAmount,
      currency,
      has_fiscal_receipt: hasFiscalReceipt,
      fiscal_receipt_number: fiscalReceiptNumber,
    },
    warnings,
  };
}
