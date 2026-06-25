'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireBusiness } from '@/lib/auth/session';
import * as api from '@/lib/api/products';
import { productSchema, type ProductInput } from '@crm/contracts/product';

export type ProductActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function parseInput(formData: FormData): ProductInput | { _error: ProductActionResult } {
  const taxRateRaw = formData.get('tax_rate_override');
  const raw = {
    name: formData.get('name'),
    description: formData.get('description'),
    unit_price: formData.get('unit_price'),
    is_taxable: formData.get('is_taxable') === 'on',
    tax_rate_override:
      typeof taxRateRaw === 'string' && taxRateRaw.trim() !== '' ? taxRateRaw : undefined,
    type: formData.get('type') || 'service',
    sku: formData.get('sku'),
    is_active: formData.get('is_active') === 'on',
  };

  const parsed = productSchema.safeParse(raw);
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

export async function createProduct(
  _prev: ProductActionResult | null,
  formData: FormData,
): Promise<ProductActionResult> {
  await requireBusiness();
  const result = parseInput(formData);
  if ('_error' in result) return result._error;

  const res = await api.createProduct(result);
  if (!res.ok) return { ok: false, error: res.error, fieldErrors: res.fieldErrors };

  revalidatePath('/products');
  redirect(`/products/${res.data.id}`);
}

export async function updateProduct(
  id: string,
  _prev: ProductActionResult | null,
  formData: FormData,
): Promise<ProductActionResult> {
  await requireBusiness();
  const result = parseInput(formData);
  if ('_error' in result) return result._error;

  const res = await api.updateProduct(id, result);
  if (!res.ok) return { ok: false, error: res.error, fieldErrors: res.fieldErrors };

  revalidatePath('/products');
  revalidatePath(`/products/${id}`);
  redirect(`/products/${id}`);
}

export async function deactivateProduct(id: string) {
  await requireBusiness();
  const res = await api.deactivateProduct(id);
  if (!res.ok) throw new Error(res.error);
  revalidatePath('/products');
  revalidatePath(`/products/${id}`);
}

export async function reactivateProduct(id: string) {
  await requireBusiness();
  const res = await api.reactivateProduct(id);
  if (!res.ok) throw new Error(res.error);
  revalidatePath('/products');
  revalidatePath(`/products/${id}`);
}
