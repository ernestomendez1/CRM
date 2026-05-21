'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireBusiness } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { applyPayments, calculateTotals } from '@/lib/money/calc';
import {
  invoiceSchema,
  type InvoiceInput,
  type InvoiceStatus,
} from '@/lib/validation/invoice';
import { paymentSchema } from '@/lib/validation/payment';

export type InvoiceActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function parseFormData(formData: FormData): InvoiceInput | { _error: InvoiceActionResult } {
  let items: unknown;
  try {
    items = JSON.parse(String(formData.get('items') ?? '[]'));
  } catch {
    return { _error: { ok: false, error: 'Invalid items payload.' } };
  }
  const raw = {
    customer_id: formData.get('customer_id'),
    issue_date: formData.get('issue_date'),
    due_date: formData.get('due_date'),
    notes: formData.get('notes'),
    terms: formData.get('terms'),
    currency: formData.get('currency') || 'DOP',
    items,
  };
  const parsed = invoiceSchema.safeParse(raw);
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

function computeDocTotals(items: InvoiceInput['items']) {
  return calculateTotals(
    items.map((i) => ({
      quantity: i.quantity,
      unitPrice: i.unit_price,
      discountPct: i.discount_pct ?? 0,
      taxRate: i.tax_rate ?? 0,
    })),
  );
}

export async function createInvoice(
  _prev: InvoiceActionResult | null,
  formData: FormData,
): Promise<InvoiceActionResult> {
  const ctx = await requireBusiness();
  const parsed = parseFormData(formData);
  if ('_error' in parsed) return parsed._error;

  const supabase = await createClient();

  const { data: numData, error: numErr } = await supabase.rpc('next_invoice_number', {
    p_business_id: ctx.businessId,
  });
  if (numErr) return { ok: false, error: numErr.message };
  const invoiceNumber = numData as unknown as string;

  const totals = computeDocTotals(parsed.items);

  const { data: inv, error: invErr } = await supabase
    .from('invoices')
    .insert({
      business_id: ctx.businessId,
      customer_id: parsed.customer_id,
      invoice_number: invoiceNumber,
      issue_date: parsed.issue_date,
      due_date: parsed.due_date ?? null,
      notes: parsed.notes ?? null,
      terms: parsed.terms ?? null,
      currency: parsed.currency,
      status: 'draft',
      subtotal: totals.subtotal,
      discount_total: totals.discountTotal,
      tax_total: totals.taxTotal,
      total: totals.total,
      amount_paid: 0,
      balance_due: totals.total,
      created_by: ctx.userId,
    })
    .select('id')
    .single();
  if (invErr) return { ok: false, error: invErr.message };
  const invoiceId = (inv as { id: string }).id;

  const itemRows = parsed.items.map((it, idx) => ({
    invoice_id: invoiceId,
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
  const { error: itemsErr } = await supabase.from('invoice_items').insert(itemRows);
  if (itemsErr) {
    await supabase.from('invoices').delete().eq('id', invoiceId);
    return { ok: false, error: itemsErr.message };
  }

  revalidatePath('/invoices');
  redirect(`/invoices/${invoiceId}`);
}

export async function updateInvoice(
  id: string,
  _prev: InvoiceActionResult | null,
  formData: FormData,
): Promise<InvoiceActionResult> {
  const ctx = await requireBusiness();
  const parsed = parseFormData(formData);
  if ('_error' in parsed) return parsed._error;

  const supabase = await createClient();

  const { data: existing, error: exErr } = await supabase
    .from('invoices')
    .select('status, amount_paid')
    .eq('id', id)
    .eq('business_id', ctx.businessId)
    .maybeSingle();
  if (exErr) return { ok: false, error: exErr.message };
  if (!existing) return { ok: false, error: 'Not found' };
  if ((existing as { status: InvoiceStatus }).status !== 'draft') {
    return { ok: false, error: 'Only draft invoices can be edited.' };
  }

  const totals = computeDocTotals(parsed.items);

  const { error: invErr } = await supabase
    .from('invoices')
    .update({
      customer_id: parsed.customer_id,
      issue_date: parsed.issue_date,
      due_date: parsed.due_date ?? null,
      notes: parsed.notes ?? null,
      terms: parsed.terms ?? null,
      currency: parsed.currency,
      subtotal: totals.subtotal,
      discount_total: totals.discountTotal,
      tax_total: totals.taxTotal,
      total: totals.total,
      balance_due: totals.total, // draft, so amount_paid is 0
    })
    .eq('id', id)
    .eq('business_id', ctx.businessId);
  if (invErr) return { ok: false, error: invErr.message };

  const { error: delErr } = await supabase.from('invoice_items').delete().eq('invoice_id', id);
  if (delErr) return { ok: false, error: delErr.message };

  const itemRows = parsed.items.map((it, idx) => ({
    invoice_id: id,
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
  const { error: insErr } = await supabase.from('invoice_items').insert(itemRows);
  if (insErr) return { ok: false, error: insErr.message };

  revalidatePath('/invoices');
  revalidatePath(`/invoices/${id}`);
  redirect(`/invoices/${id}`);
}

export async function changeInvoiceStatus(id: string, target: 'issued' | 'cancelled' | 'draft') {
  const ctx = await requireBusiness();
  const supabase = await createClient();

  if (target === 'cancelled' || target === 'draft' || target === 'issued') {
    const { error } = await supabase
      .from('invoices')
      .update({ status: target })
      .eq('id', id)
      .eq('business_id', ctx.businessId);
    if (error) throw new Error(error.message);
  }
  // Recompute against payments to flip to partially_paid / paid / overdue if appropriate.
  await recomputeInvoiceStatus(id);

  revalidatePath('/invoices');
  revalidatePath(`/invoices/${id}`);
}

export async function deleteInvoice(id: string) {
  const ctx = await requireBusiness();
  const supabase = await createClient();

  const { data, error: lookupErr } = await supabase
    .from('invoices')
    .select('status')
    .eq('id', id)
    .eq('business_id', ctx.businessId)
    .maybeSingle();
  if (lookupErr) throw new Error(lookupErr.message);
  if ((data as { status: InvoiceStatus } | null)?.status !== 'draft') {
    throw new Error('Only draft invoices can be deleted.');
  }

  const { error } = await supabase
    .from('invoices')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('business_id', ctx.businessId);
  if (error) throw new Error(error.message);

  revalidatePath('/invoices');
}

/**
 * Recompute amount_paid, balance_due, status from the current payment rows.
 * Idempotent; called whenever payments are added/removed or status changes.
 */
async function recomputeInvoiceStatus(invoiceId: string) {
  const supabase = await createClient();
  const { data: inv, error: invErr } = await supabase
    .from('invoices')
    .select('total, due_date, status')
    .eq('id', invoiceId)
    .maybeSingle();
  if (invErr || !inv) return;
  const row = inv as { total: number; due_date: string | null; status: InvoiceStatus };

  const { data: pays } = await supabase
    .from('payments')
    .select('amount')
    .eq('invoice_id', invoiceId)
    .is('deleted_at', null);

  const r = applyPayments(
    Number(row.total),
    ((pays ?? []) as { amount: number }[]).map((p) => ({ amount: Number(p.amount) })),
    { dueDate: row.due_date, currentStatus: row.status },
  );

  await supabase
    .from('invoices')
    .update({
      amount_paid: r.amountPaid,
      balance_due: r.balanceDue,
      status: r.status,
    })
    .eq('id', invoiceId);
}

export type PaymentActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function addPayment(
  _prev: PaymentActionResult | null,
  formData: FormData,
): Promise<PaymentActionResult> {
  const ctx = await requireBusiness();
  const parsed = paymentSchema.safeParse({
    invoice_id: formData.get('invoice_id'),
    payment_date: formData.get('payment_date'),
    amount: formData.get('amount'),
    method: formData.get('method'),
    reference: formData.get('reference'),
    notes: formData.get('notes'),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('payments').insert({
    business_id: ctx.businessId,
    invoice_id: parsed.data.invoice_id,
    payment_date: parsed.data.payment_date,
    amount: parsed.data.amount,
    method: parsed.data.method,
    reference: parsed.data.reference ?? null,
    notes: parsed.data.notes ?? null,
    created_by: ctx.userId,
  });
  if (error) return { ok: false, error: error.message };

  await recomputeInvoiceStatus(parsed.data.invoice_id);

  revalidatePath(`/invoices/${parsed.data.invoice_id}`);
  return { ok: true };
}

export async function deletePayment(invoiceId: string, paymentId: string) {
  const ctx = await requireBusiness();
  const supabase = await createClient();

  const { error } = await supabase
    .from('payments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', paymentId)
    .eq('invoice_id', invoiceId)
    .eq('business_id', ctx.businessId);
  if (error) throw new Error(error.message);

  await recomputeInvoiceStatus(invoiceId);

  revalidatePath(`/invoices/${invoiceId}`);
}
