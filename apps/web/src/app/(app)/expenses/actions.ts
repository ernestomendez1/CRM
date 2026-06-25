'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireBusiness } from '@/lib/auth/session';
import * as api from '@/lib/api/expenses';

export type ExpenseActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function createExpense(
  _prev: ExpenseActionResult | null,
  formData: FormData,
): Promise<ExpenseActionResult> {
  await requireBusiness();
  // Forward the FormData (with all fields + optional receipt file) to the api.
  const res = await api.createExpense(formData);
  if (!res.ok) {
    return { ok: false, error: res.error, fieldErrors: res.fieldErrors };
  }
  revalidatePath('/expenses');
  redirect(`/expenses/${res.data.id}`);
}

export async function updateExpense(
  id: string,
  _prev: ExpenseActionResult | null,
  formData: FormData,
): Promise<ExpenseActionResult> {
  await requireBusiness();
  const res = await api.updateExpense(id, formData);
  if (!res.ok) {
    return { ok: false, error: res.error, fieldErrors: res.fieldErrors };
  }
  revalidatePath('/expenses');
  revalidatePath(`/expenses/${id}`);
  redirect(`/expenses/${id}`);
}

export async function removeReceipt(id: string) {
  await requireBusiness();
  const res = await api.removeReceipt(id);
  if (!res.ok) throw new Error(res.error);
  revalidatePath(`/expenses/${id}`);
}

export async function deleteExpense(id: string) {
  await requireBusiness();
  const res = await api.deleteExpense(id);
  if (!res.ok) throw new Error(res.error);
  revalidatePath('/expenses');
}

/**
 * Get a short-lived signed URL for viewing a receipt.
 * Accepts an expense id (not a storage path) — the api looks up the
 * path internally.
 */
export async function getReceiptSignedUrl(expenseId: string): Promise<string | null> {
  await requireBusiness();
  const res = await api.getReceiptSignedUrl(expenseId);
  if (!res.ok) return null;
  return res.data.signedUrl;
}
