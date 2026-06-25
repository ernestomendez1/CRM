'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireBusiness } from '@/lib/auth/session';
import * as api from '@/lib/api/customers';
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
  await requireBusiness();
  const result = parseInput(formData);
  if ('_error' in result) return result._error;

  const res = await api.createCustomer(result);
  if (!res.ok) return { ok: false, error: res.error, fieldErrors: res.fieldErrors };

  revalidatePath('/customers');
  redirect(`/customers/${res.data.id}`);
}

export async function updateCustomer(
  id: string,
  _prev: CustomerActionResult | null,
  formData: FormData,
): Promise<CustomerActionResult> {
  await requireBusiness();
  const result = parseInput(formData);
  if ('_error' in result) return result._error;

  const res = await api.updateCustomer(id, result);
  if (!res.ok) return { ok: false, error: res.error, fieldErrors: res.fieldErrors };

  revalidatePath('/customers');
  revalidatePath(`/customers/${id}`);
  redirect(`/customers/${id}`);
}

export async function deactivateCustomer(id: string) {
  await requireBusiness();
  const res = await api.deactivateCustomer(id);
  if (!res.ok) throw new Error(res.error);
  revalidatePath('/customers');
  revalidatePath(`/customers/${id}`);
}

export async function reactivateCustomer(id: string) {
  await requireBusiness();
  const res = await api.reactivateCustomer(id);
  if (!res.ok) throw new Error(res.error);
  revalidatePath('/customers');
  revalidatePath(`/customers/${id}`);
}
