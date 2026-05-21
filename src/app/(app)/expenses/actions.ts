'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireBusiness, type CurrentContext } from '@/lib/auth/session';
import { createExpenseRecord } from '@/lib/domain/expenses';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { expenseSchema, type ExpenseInput } from '@/lib/validation/expense';

export type ExpenseActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const RECEIPT_BUCKET = 'expense-receipts';
const ALLOWED_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
  'application/pdf',
]);
const MAX_BYTES = 10 * 1024 * 1024;

function parseInput(formData: FormData): ExpenseInput | { _error: ExpenseActionResult } {
  const raw = {
    vendor_name: formData.get('vendor_name'),
    vendor_tax_id: formData.get('vendor_tax_id'),
    expense_date: formData.get('expense_date'),
    category: formData.get('category'),
    description: formData.get('description'),
    subtotal: formData.get('subtotal'),
    tax_amount: formData.get('tax_amount'),
    currency: formData.get('currency') || 'DOP',
    has_fiscal_receipt: formData.get('has_fiscal_receipt') === 'on',
    fiscal_receipt_number: formData.get('fiscal_receipt_number'),
    payment_method: formData.get('payment_method') || undefined,
  };
  const parsed = expenseSchema.safeParse(raw);
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

async function uploadReceiptIfPresent(
  formData: FormData,
  ctx: CurrentContext,
): Promise<{ path: string | null } | { error: string }> {
  const file = formData.get('receipt');
  if (!(file instanceof File) || file.size === 0) return { path: null };
  if (!ALLOWED_MIMES.has(file.type)) return { error: `Unsupported file type: ${file.type}` };
  if (file.size > MAX_BYTES) return { error: 'File exceeds 10 MB.' };

  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : 'bin';
  const path = `${ctx.businessId}/${randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const admin = createServiceClient();
  const { error } = await admin.storage
    .from(RECEIPT_BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (error) return { error: error.message };

  return { path };
}

function publicLikePath(path: string) {
  return path; // we store the storage path; signed URLs are generated on demand
}

export async function createExpense(
  _prev: ExpenseActionResult | null,
  formData: FormData,
): Promise<ExpenseActionResult> {
  const ctx = await requireBusiness();
  const parsed = parseInput(formData);
  if ('_error' in parsed) return parsed._error;

  const upload = await uploadReceiptIfPresent(formData, ctx);
  if ('error' in upload) return { ok: false, error: upload.error };

  let created: { id: string };
  try {
    created = await createExpenseRecord(ctx, parsed, {
      receiptFileUrl: upload.path ? publicLikePath(upload.path) : null,
    });
  } catch (error) {
    if (upload.path) {
      const admin = createServiceClient();
      await admin.storage.from(RECEIPT_BUCKET).remove([upload.path]);
    }
    return { ok: false, error: error instanceof Error ? error.message : 'Failed to create expense.' };
  }

  revalidatePath('/expenses');
  redirect(`/expenses/${created.id}`);
}

export async function updateExpense(
  id: string,
  _prev: ExpenseActionResult | null,
  formData: FormData,
): Promise<ExpenseActionResult> {
  const ctx = await requireBusiness();
  const parsed = parseInput(formData);
  if ('_error' in parsed) return parsed._error;

  const upload = await uploadReceiptIfPresent(formData, ctx);
  if ('error' in upload) return { ok: false, error: upload.error };

  const supabase = await createClient();
  const total = parsed.subtotal + parsed.tax_amount;

  // If a new receipt was uploaded, delete the old one.
  if (upload.path) {
    const { data: existing } = await supabase
      .from('expenses')
      .select('receipt_file_url')
      .eq('id', id)
      .eq('business_id', ctx.businessId)
      .maybeSingle();
    const prev = (existing as { receipt_file_url: string | null } | null)?.receipt_file_url;
    if (prev) {
      const admin = createServiceClient();
      await admin.storage.from(RECEIPT_BUCKET).remove([prev]);
    }
  }

  const { error } = await supabase
    .from('expenses')
    .update({
      ...parsed,
      total,
      ...(upload.path ? { receipt_file_url: publicLikePath(upload.path) } : {}),
    })
    .eq('id', id)
    .eq('business_id', ctx.businessId);

  if (error) {
    if (upload.path) {
      const admin = createServiceClient();
      await admin.storage.from(RECEIPT_BUCKET).remove([upload.path]);
    }
    return { ok: false, error: error.message };
  }

  revalidatePath('/expenses');
  revalidatePath(`/expenses/${id}`);
  redirect(`/expenses/${id}`);
}

export async function removeReceipt(id: string) {
  const ctx = await requireBusiness();
  const supabase = await createClient();

  const { data, error: lookupErr } = await supabase
    .from('expenses')
    .select('receipt_file_url')
    .eq('id', id)
    .eq('business_id', ctx.businessId)
    .maybeSingle();
  if (lookupErr) throw new Error(lookupErr.message);

  const path = (data as { receipt_file_url: string | null } | null)?.receipt_file_url;
  if (path) {
    const admin = createServiceClient();
    await admin.storage.from(RECEIPT_BUCKET).remove([path]);
  }

  const { error } = await supabase
    .from('expenses')
    .update({ receipt_file_url: null })
    .eq('id', id)
    .eq('business_id', ctx.businessId);
  if (error) throw new Error(error.message);

  revalidatePath(`/expenses/${id}`);
}

export async function deleteExpense(id: string) {
  const ctx = await requireBusiness();
  const supabase = await createClient();
  const { error } = await supabase
    .from('expenses')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('business_id', ctx.businessId);
  if (error) throw new Error(error.message);

  revalidatePath('/expenses');
}

/**
 * Get a short-lived signed URL for viewing a receipt.
 * The stored value is the storage path (bucket-relative).
 */
export async function getReceiptSignedUrl(path: string): Promise<string | null> {
  await requireBusiness(); // ensures only authenticated members can request
  const admin = createServiceClient();
  const { data, error } = await admin.storage
    .from(RECEIPT_BUCKET)
    .createSignedUrl(path, 60 * 5);
  if (error) return null;
  return data.signedUrl;
}
