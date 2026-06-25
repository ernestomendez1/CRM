import 'server-only';

import type { CurrentContext } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import type { ProductInput, ProductType } from '@crm/contracts/product';

type DbClient = Awaited<ReturnType<typeof createClient>>;

export type ProductSearchResult = {
  id: string;
  name: string;
  sku: string | null;
  type: ProductType;
  unit_price: number;
  is_taxable: boolean;
  is_active: boolean;
};

export async function createProductRecord(
  ctx: CurrentContext,
  input: ProductInput,
  client?: DbClient,
): Promise<{ id: string; name: string }> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from('products')
    .insert({
      ...input,
      business_id: ctx.businessId,
      created_by: ctx.userId,
    })
    .select('id, name')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as { id: string; name: string };
}

export async function searchProducts(
  ctx: CurrentContext,
  params: { query: string; limit?: number; includeInactive?: boolean },
  client?: DbClient,
): Promise<ProductSearchResult[]> {
  const supabase = client ?? (await createClient());
  let query = supabase
    .from('products')
    .select('id, name, sku, type, unit_price, is_taxable, is_active')
    .eq('business_id', ctx.businessId)
    .is('deleted_at', null)
    .order('name', { ascending: true })
    .limit(params.limit ?? 5);

  if (!params.includeInactive) {
    query = query.eq('is_active', true);
  }

  const term = `%${params.query.trim()}%`;
  query = query.or(`name.ilike.${term},sku.ilike.${term}`);

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ProductSearchResult[];
}
