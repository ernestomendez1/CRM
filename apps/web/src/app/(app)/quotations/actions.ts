'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireBusiness } from '@/lib/auth/session';
import * as api from '@/lib/api/quotations';
import {
  quotationSchema,
  quotationStatuses,
  type QuotationInput,
  type QuotationStatus,
} from '@crm/contracts/quotation';

export type QuotationActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function parseFormData(formData: FormData): QuotationInput | { _error: QuotationActionResult } {
  let items: unknown;
  try {
    items = JSON.parse(String(formData.get('items') ?? '[]'));
  } catch {
    return { _error: { ok: false, error: 'Invalid items payload.' } };
  }

  const raw = {
    customer_id: formData.get('customer_id'),
    issue_date: formData.get('issue_date'),
    expiry_date: formData.get('expiry_date'),
    notes: formData.get('notes'),
    terms: formData.get('terms'),
    currency: formData.get('currency') || 'DOP',
    items,
  };

  const parsed = quotationSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      _error: {
        ok: false,
        error: 'Validation failed',
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      },
    };
  }
  return parsed.data;
}

export async function createQuotation(
  _prev: QuotationActionResult | null,
  formData: FormData,
): Promise<QuotationActionResult> {
  await requireBusiness();
  const parsed = parseFormData(formData);
  if ('_error' in parsed) return parsed._error;

  const res = await api.createQuotation(parsed);
  if (!res.ok) return { ok: false, error: res.error, fieldErrors: res.fieldErrors };

  revalidatePath('/quotations');
  redirect(`/quotations/${res.data.id}`);
}

export async function updateQuotation(
  id: string,
  _prev: QuotationActionResult | null,
  formData: FormData,
): Promise<QuotationActionResult> {
  await requireBusiness();
  const parsed = parseFormData(formData);
  if ('_error' in parsed) return parsed._error;

  const res = await api.updateQuotation(id, parsed);
  if (!res.ok) return { ok: false, error: res.error, fieldErrors: res.fieldErrors };

  revalidatePath('/quotations');
  revalidatePath(`/quotations/${id}`);
  redirect(`/quotations/${id}`);
}

export async function changeQuotationStatus(id: string, status: QuotationStatus) {
  if (!quotationStatuses.includes(status)) throw new Error('Invalid status');
  await requireBusiness();
  const res = await api.changeQuotationStatus(id, status);
  if (!res.ok) throw new Error(res.error);
  revalidatePath('/quotations');
  revalidatePath(`/quotations/${id}`);
}

export async function deleteQuotation(id: string) {
  await requireBusiness();
  const res = await api.deleteQuotation(id);
  if (!res.ok) throw new Error(res.error);
  revalidatePath('/quotations');
}

export async function convertQuotationToInvoice(quotationId: string): Promise<void> {
  await requireBusiness();
  const res = await api.convertQuotationToInvoice(quotationId);
  if (!res.ok) throw new Error(res.error);
  revalidatePath('/quotations');
  revalidatePath(`/quotations/${quotationId}`);
  revalidatePath('/invoices');
  redirect(`/invoices/${res.data.id}`);
}
