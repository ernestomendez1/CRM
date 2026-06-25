'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireBusiness } from '@/lib/auth/session';
import { createClient } from '@crm/db/server';
import { calculateTotals } from '@/lib/money/calc';
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

function computeDocumentTotals(items: QuotationInput['items']) {
  const totals = calculateTotals(
    items.map((i) => ({
      quantity: i.quantity,
      unitPrice: i.unit_price,
      discountPct: i.discount_pct ?? 0,
      taxRate: i.tax_rate ?? 0,
    })),
  );
  return totals;
}

export async function createQuotation(
  _prev: QuotationActionResult | null,
  formData: FormData,
): Promise<QuotationActionResult> {
  const ctx = await requireBusiness();
  const parsed = parseFormData(formData);
  if ('_error' in parsed) return parsed._error;

  const supabase = await createClient();

  // Allocate quotation number atomically.
  const { data: numData, error: numErr } = await supabase.rpc('next_quotation_number', {
    p_business_id: ctx.businessId,
  });
  if (numErr) return { ok: false, error: numErr.message };
  const quotationNumber = numData as unknown as string;

  const totals = computeDocumentTotals(parsed.items);

  const { data: q, error: qErr } = await supabase
    .from('quotations')
    .insert({
      business_id: ctx.businessId,
      customer_id: parsed.customer_id,
      quotation_number: quotationNumber,
      issue_date: parsed.issue_date,
      expiry_date: parsed.expiry_date ?? null,
      notes: parsed.notes ?? null,
      terms: parsed.terms ?? null,
      currency: parsed.currency,
      status: 'draft',
      subtotal: totals.subtotal,
      discount_total: totals.discountTotal,
      tax_total: totals.taxTotal,
      total: totals.total,
      created_by: ctx.userId,
    })
    .select('id')
    .single();
  if (qErr) return { ok: false, error: qErr.message };
  const quotationId = (q as { id: string }).id;

  const itemRows = parsed.items.map((it, idx) => ({
    quotation_id: quotationId,
    product_id: it.product_id ?? null,
    description: it.description,
    quantity: it.quantity,
    unit_price: it.unit_price,
    discount_pct: it.discount_pct ?? 0,
    tax_rate: it.tax_rate ?? 0,
    line_subtotal: totals.lines[idx].lineSubtotal,
    line_tax: totals.lines[idx].lineTax,
    line_total: totals.lines[idx].lineTotal,
    sort_order: idx,
  }));
  const { error: itemsErr } = await supabase.from('quotation_items').insert(itemRows);
  if (itemsErr) {
    // Best-effort rollback: delete the empty quotation header.
    await supabase.from('quotations').delete().eq('id', quotationId);
    return { ok: false, error: itemsErr.message };
  }

  revalidatePath('/quotations');
  redirect(`/quotations/${quotationId}`);
}

export async function updateQuotation(
  id: string,
  _prev: QuotationActionResult | null,
  formData: FormData,
): Promise<QuotationActionResult> {
  const ctx = await requireBusiness();
  const parsed = parseFormData(formData);
  if ('_error' in parsed) return parsed._error;

  const supabase = await createClient();
  const totals = computeDocumentTotals(parsed.items);

  // Guard: cannot edit non-draft quotations.
  const { data: existing, error: exErr } = await supabase
    .from('quotations')
    .select('status, converted_invoice_id')
    .eq('id', id)
    .eq('business_id', ctx.businessId)
    .maybeSingle();
  if (exErr) return { ok: false, error: exErr.message };
  if (!existing) return { ok: false, error: 'Not found' };
  if ((existing as { converted_invoice_id: string | null }).converted_invoice_id) {
    return { ok: false, error: 'Already converted to invoice; cannot edit.' };
  }

  const { error: qErr } = await supabase
    .from('quotations')
    .update({
      customer_id: parsed.customer_id,
      issue_date: parsed.issue_date,
      expiry_date: parsed.expiry_date ?? null,
      notes: parsed.notes ?? null,
      terms: parsed.terms ?? null,
      currency: parsed.currency,
      subtotal: totals.subtotal,
      discount_total: totals.discountTotal,
      tax_total: totals.taxTotal,
      total: totals.total,
    })
    .eq('id', id)
    .eq('business_id', ctx.businessId);
  if (qErr) return { ok: false, error: qErr.message };

  // Replace all line items: delete then re-insert.
  const { error: delErr } = await supabase.from('quotation_items').delete().eq('quotation_id', id);
  if (delErr) return { ok: false, error: delErr.message };

  const itemRows = parsed.items.map((it, idx) => ({
    quotation_id: id,
    product_id: it.product_id ?? null,
    description: it.description,
    quantity: it.quantity,
    unit_price: it.unit_price,
    discount_pct: it.discount_pct ?? 0,
    tax_rate: it.tax_rate ?? 0,
    line_subtotal: totals.lines[idx].lineSubtotal,
    line_tax: totals.lines[idx].lineTax,
    line_total: totals.lines[idx].lineTotal,
    sort_order: idx,
  }));
  const { error: insErr } = await supabase.from('quotation_items').insert(itemRows);
  if (insErr) return { ok: false, error: insErr.message };

  revalidatePath('/quotations');
  revalidatePath(`/quotations/${id}`);
  redirect(`/quotations/${id}`);
}

export async function changeQuotationStatus(id: string, status: QuotationStatus) {
  if (!quotationStatuses.includes(status)) throw new Error('Invalid status');
  const ctx = await requireBusiness();
  const supabase = await createClient();

  const { error } = await supabase
    .from('quotations')
    .update({ status })
    .eq('id', id)
    .eq('business_id', ctx.businessId);
  if (error) throw new Error(error.message);

  revalidatePath('/quotations');
  revalidatePath(`/quotations/${id}`);
}

export async function deleteQuotation(id: string) {
  const ctx = await requireBusiness();
  const supabase = await createClient();

  // Block deletion if already converted.
  const { data, error: lookupErr } = await supabase
    .from('quotations')
    .select('converted_invoice_id')
    .eq('id', id)
    .eq('business_id', ctx.businessId)
    .maybeSingle();
  if (lookupErr) throw new Error(lookupErr.message);
  if ((data as { converted_invoice_id: string | null } | null)?.converted_invoice_id) {
    throw new Error('Cannot delete: this quotation is linked to an invoice.');
  }

  const { error } = await supabase
    .from('quotations')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('business_id', ctx.businessId);
  if (error) throw new Error(error.message);

  revalidatePath('/quotations');
}

export async function convertQuotationToInvoice(quotationId: string): Promise<void> {
  const ctx = await requireBusiness();
  const supabase = await createClient();

  // Load source quotation + items + business defaults.
  const [{ data: quotation, error: qErr }, { data: items, error: iErr }, { data: business }] =
    await Promise.all([
      supabase
        .from('quotations')
        .select('*')
        .eq('id', quotationId)
        .eq('business_id', ctx.businessId)
        .is('deleted_at', null)
        .maybeSingle(),
      supabase
        .from('quotation_items')
        .select('*')
        .eq('quotation_id', quotationId)
        .order('sort_order'),
      supabase
        .from('businesses')
        .select('default_payment_terms_days')
        .eq('id', ctx.businessId)
        .maybeSingle(),
    ]);
  if (qErr) throw new Error(qErr.message);
  if (iErr) throw new Error(iErr.message);
  if (!quotation) throw new Error('Quotation not found.');
  const q = quotation as {
    id: string;
    status: string;
    customer_id: string;
    converted_invoice_id: string | null;
    notes: string | null;
    terms: string | null;
    subtotal: number;
    discount_total: number;
    tax_total: number;
    total: number;
    currency: string;
  };

  if (q.converted_invoice_id) {
    throw new Error('This quotation has already been converted.');
  }
  if (q.status !== 'accepted') {
    throw new Error('Only accepted quotations can be converted.');
  }

  const itemRows = (items ?? []) as {
    product_id: string | null;
    description: string;
    quantity: number;
    unit_price: number;
    discount_pct: number;
    tax_rate: number;
    line_subtotal: number;
    line_tax: number;
    line_total: number;
    sort_order: number;
  }[];

  const today = new Date().toISOString().slice(0, 10);
  const termsDays =
    (business as { default_payment_terms_days: number } | null)?.default_payment_terms_days ?? 30;
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + termsDays);
  const dueIso = dueDate.toISOString().slice(0, 10);

  // Allocate invoice number atomically.
  const { data: numData, error: numErr } = await supabase.rpc('next_invoice_number', {
    p_business_id: ctx.businessId,
  });
  if (numErr) throw new Error(numErr.message);
  const invoiceNumber = numData as unknown as string;

  // Create the invoice with copied totals.
  const { data: invRow, error: invErr } = await supabase
    .from('invoices')
    .insert({
      business_id: ctx.businessId,
      customer_id: q.customer_id,
      quotation_id: q.id,
      invoice_number: invoiceNumber,
      issue_date: today,
      due_date: dueIso,
      status: 'draft',
      notes: q.notes,
      terms: q.terms,
      subtotal: q.subtotal,
      discount_total: q.discount_total,
      tax_total: q.tax_total,
      total: q.total,
      amount_paid: 0,
      balance_due: q.total,
      currency: q.currency,
      created_by: ctx.userId,
    })
    .select('id')
    .single();
  if (invErr) throw new Error(invErr.message);
  const invoiceId = (invRow as { id: string }).id;

  // Clone line items.
  const cloned = itemRows.map((it) => ({
    invoice_id: invoiceId,
    product_id: it.product_id,
    description: it.description,
    quantity: it.quantity,
    unit_price: it.unit_price,
    discount_pct: it.discount_pct,
    tax_rate: it.tax_rate,
    line_subtotal: it.line_subtotal,
    line_tax: it.line_tax,
    line_total: it.line_total,
    sort_order: it.sort_order,
  }));
  if (cloned.length > 0) {
    const { error: cloneErr } = await supabase.from('invoice_items').insert(cloned);
    if (cloneErr) {
      // Rollback the empty invoice header.
      await supabase.from('invoices').delete().eq('id', invoiceId);
      throw new Error(cloneErr.message);
    }
  }

  // Link source quotation.
  await supabase
    .from('quotations')
    .update({ converted_invoice_id: invoiceId })
    .eq('id', q.id)
    .eq('business_id', ctx.businessId);

  revalidatePath('/quotations');
  revalidatePath(`/quotations/${q.id}`);
  revalidatePath('/invoices');

  redirect(`/invoices/${invoiceId}`);
}
