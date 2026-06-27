'use server';

import { redirect } from 'next/navigation';
import { leadInputSchema, type LeadInput } from '@crm/contracts/lead';
import { submitLead } from '@/lib/api/leads';

export type SubmitLeadResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function submitLeadAction(
  _prev: SubmitLeadResult | null,
  formData: FormData,
): Promise<SubmitLeadResult> {
  const raw: Record<string, unknown> = {
    business_name: formData.get('business_name'),
    contact_name: formData.get('contact_name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    rnc: formData.get('rnc'),
    employees_band: formData.get('employees_band') || undefined,
    current_tool: formData.get('current_tool'),
    interest_note: formData.get('interest_note'),
  };
  const parsed = leadInputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Por favor revisa los campos.',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const turnstileToken = (formData.get('cf-turnstile-response') as string) || undefined;
  const res = await submitLead(parsed.data as LeadInput, turnstileToken);
  if (!res.ok) {
    return { ok: false, error: res.error, fieldErrors: res.fieldErrors };
  }
  redirect('/solicitar-acceso/thanks');
}
