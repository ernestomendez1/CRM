'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireBusiness } from '@/lib/auth/session';
import { createProductRecord } from '@/lib/domain/products';
import { createClient } from '@/lib/supabase/server';
import { productSchema, type ProductInput } from '@/lib/validation/product';

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
  const ctx = await requireBusiness();
  const result = parseInput(formData);
  if ('_error' in result) return result._error;

  let created: { id: string };
  try {
    created = await createProductRecord(ctx, result);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Failed to create product.' };
  }

  revalidatePath('/products');
  redirect(`/products/${created.id}`);
}

export async function updateProduct(
  id: string,
  _prev: ProductActionResult | null,
  formData: FormData,
): Promise<ProductActionResult> {
  const ctx = await requireBusiness();
  const result = parseInput(formData);
  if ('_error' in result) return result._error;

  const supabase = await createClient();
  const { error } = await supabase
    .from('products')
    .update(result)
    .eq('id', id)
    .eq('business_id', ctx.businessId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/products');
  revalidatePath(`/products/${id}`);
  redirect(`/products/${id}`);
}

export async function deactivateProduct(id: string) {
  const ctx = await requireBusiness();
  const supabase = await createClient();
  const { error } = await supabase
    .from('products')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', id)
    .eq('business_id', ctx.businessId);

  if (error) throw new Error(error.message);

  revalidatePath('/products');
  revalidatePath(`/products/${id}`);
}

export async function reactivateProduct(id: string) {
  const ctx = await requireBusiness();
  const supabase = await createClient();
  const { error } = await supabase
    .from('products')
    .update({ deleted_at: null, is_active: true })
    .eq('id', id)
    .eq('business_id', ctx.businessId);

  if (error) throw new Error(error.message);

  revalidatePath('/products');
  revalidatePath(`/products/${id}`);
}
