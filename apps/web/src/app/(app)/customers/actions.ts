'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireBusiness } from '@/lib/auth/session';
import { createCustomerRecord } from '@/lib/domain/customers';
import { createClient } from '@/lib/supabase/server';
import { customerSchema, type CustomerInput } from '@crm/contracts/customer';

export type CustomerActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function parseInput(formData: FormData): CustomerInput | { _error: CustomerActionResult } {
  const raw = {
    name: formData.get('name'),
    company_name: formData.get('company_name'),
    tax_id_type: formData.get('tax_id_type') || undefined,
    tax_id: formData.get('tax_id'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    address: formData.get('address'),
    city: formData.get('city'),
    country: formData.get('country'),
    notes: formData.get('notes'),
    is_active: formData.get('is_active') === 'on',
  };

  const parsed = customerSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      _error: {
        ok: false,
        error: 'Validation failed',
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
    };
  }
  return parsed.data;
}

export async function createCustomer(
  _prev: CustomerActionResult | null,
  formData: FormData,
): Promise<CustomerActionResult> {
  const ctx = await requireBusiness();
  const result = parseInput(formData);
  if ('_error' in result) return result._error;

  let created: { id: string };
  try {
    created = await createCustomerRecord(ctx, result);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Failed to create customer.' };
  }

  revalidatePath('/customers');
  redirect(`/customers/${created.id}`);
}

export async function updateCustomer(
  id: string,
  _prev: CustomerActionResult | null,
  formData: FormData,
): Promise<CustomerActionResult> {
  const ctx = await requireBusiness();
  const result = parseInput(formData);
  if ('_error' in result) return result._error;

  const supabase = await createClient();
  const { error } = await supabase
    .from('customers')
    .update(result)
    .eq('id', id)
    .eq('business_id', ctx.businessId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/customers');
  revalidatePath(`/customers/${id}`);
  redirect(`/customers/${id}`);
}

export async function deactivateCustomer(id: string) {
  const ctx = await requireBusiness();
  const supabase = await createClient();
  const { error } = await supabase
    .from('customers')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', id)
    .eq('business_id', ctx.businessId);

  if (error) throw new Error(error.message);

  revalidatePath('/customers');
  revalidatePath(`/customers/${id}`);
}

export async function reactivateCustomer(id: string) {
  const ctx = await requireBusiness();
  const supabase = await createClient();
  const { error } = await supabase
    .from('customers')
    .update({ deleted_at: null, is_active: true })
    .eq('id', id)
    .eq('business_id', ctx.businessId);

  if (error) throw new Error(error.message);

  revalidatePath('/customers');
  revalidatePath(`/customers/${id}`);
}
