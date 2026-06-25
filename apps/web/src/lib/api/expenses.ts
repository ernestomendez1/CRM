import 'server-only';
import type {
  Expense,
  ExpensePaymentMethod,
} from '@crm/contracts/expense';
import {
  apiDelete,
  apiFetch,
  apiGet,
  apiPost,
  type ApiResult,
} from '../api-client';

type DrizzleExpense = {
  id: string;
  businessId: string;
  vendorName: string;
  vendorTaxId: string | null;
  expenseDate: string;
  category: string | null;
  description: string | null;
  subtotal: string;
  taxAmount: string;
  total: string;
  currency: string;
  hasFiscalReceipt: boolean;
  fiscalReceiptNumber: string | null;
  receiptFileUrl: string | null;
  paymentMethod: ExpensePaymentMethod | null;
  deletedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

function expenseFromDrizzle(row: DrizzleExpense): Expense {
  return {
    id: row.id,
    business_id: row.businessId,
    vendor_name: row.vendorName,
    vendor_tax_id: row.vendorTaxId,
    expense_date: row.expenseDate,
    category: row.category,
    description: row.description,
    subtotal: Number(row.subtotal),
    tax_amount: Number(row.taxAmount),
    total: Number(row.total),
    currency: row.currency,
    has_fiscal_receipt: row.hasFiscalReceipt,
    fiscal_receipt_number: row.fiscalReceiptNumber,
    receipt_file_url: row.receiptFileUrl,
    payment_method: row.paymentMethod,
    deleted_at: row.deletedAt,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export type ExpenseListRow = {
  id: string;
  vendor_name: string;
  vendor_tax_id: string | null;
  expense_date: string;
  category: string | null;
  total: string;
  currency: string;
  has_fiscal_receipt: boolean;
  fiscal_receipt_number: string | null;
};

export type ExpenseList = {
  rows: ExpenseListRow[];
  count: number;
  page: number;
  size: number;
};

export async function listExpenses(params: {
  q?: string;
  from?: string;
  to?: string;
  fiscal?: 'yes' | 'no';
  page?: number;
  size?: number;
}): Promise<ApiResult<ExpenseList>> {
  const sp = new URLSearchParams();
  if (params.q) sp.set('q', params.q);
  if (params.from) sp.set('from', params.from);
  if (params.to) sp.set('to', params.to);
  if (params.fiscal) sp.set('fiscal', params.fiscal);
  if (params.page) sp.set('page', String(params.page));
  if (params.size) sp.set('size', String(params.size));
  const qs = sp.toString();
  return apiGet<ExpenseList>(`/v1/expenses${qs ? `?${qs}` : ''}`);
}

export async function getExpense(id: string): Promise<ApiResult<Expense>> {
  const res = await apiGet<DrizzleExpense>(`/v1/expenses/${id}`);
  if (!res.ok) return res;
  return { ok: true, data: expenseFromDrizzle(res.data) };
}

/** Create with multipart formData containing fields + optional `receipt` file. */
export const createExpense = (form: FormData) =>
  apiFetch<{ id: string; vendor_name: string }>('/v1/expenses', {
    method: 'POST',
    form,
  });

export const updateExpense = (id: string, form: FormData) =>
  apiFetch<{ id: string }>(`/v1/expenses/${id}`, {
    method: 'PUT',
    form,
  });

export const deleteExpense = (id: string) =>
  apiDelete<undefined>(`/v1/expenses/${id}`);

export const removeReceipt = (id: string) =>
  apiDelete<undefined>(`/v1/expenses/${id}/receipt`);

export const getReceiptSignedUrl = (id: string) =>
  apiPost<{ signedUrl: string | null }>(`/v1/expenses/${id}/receipt-url`);
