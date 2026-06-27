'use server';

import { revalidatePath } from 'next/cache';
import { leadStatusUpdateSchema } from '@crm/contracts/lead';
import { updateLeadStatusAdmin } from '@/lib/api/leads';

export type UpdateLeadResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateLeadStatusAction(
  _prev: UpdateLeadResult | null,
  formData: FormData,
): Promise<UpdateLeadResult> {
  const leadId = formData.get('lead_id');
  if (typeof leadId !== 'string' || !leadId) {
    return { ok: false, error: 'Falta el id del lead.' };
  }
  const raw = {
    status: formData.get('status'),
    notes: formData.get('notes') || undefined,
  };
  const parsed = leadStatusUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: 'Estado inválido.' };
  }
  const res = await updateLeadStatusAdmin(leadId, parsed.data);
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath('/admin/leads');
  revalidatePath('/admin');
  return { ok: true };
}
