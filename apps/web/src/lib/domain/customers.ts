import 'server-only';

import type { CurrentContext } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import type { CustomerInput, TaxIdType } from '@crm/contracts/customer';

type DbClient = Awaited<ReturnType<typeof createClient>>;

export type CustomerSearchResult = {
  id: string;
  name: string;
  company_name: string | null;
  tax_id: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  tax_id_type?: TaxIdType;
};

export async function createCustomerRecord(
  ctx: CurrentContext,
  input: CustomerInput,
  client?: DbClient,
): Promise<{ id: string; name: string }> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from('customers')
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

export async function searchCustomers(
  ctx: CurrentContext,
  params: { query: string; limit?: number; includeInactive?: boolean },
  client?: DbClient,
): Promise<CustomerSearchResult[]> {
  const supabase = client ?? (await createClient());
  let query = supabase
    .from('customers')
    .select('id, name, company_name, tax_id, email, phone, is_active, tax_id_type')
    .eq('business_id', ctx.businessId)
    .is('deleted_at', null)
    .order('name', { ascending: true })
    .limit(params.limit ?? 5);

  if (!params.includeInactive) {
    query = query.eq('is_active', true);
  }

  const term = `%${params.query.trim()}%`;
  query = query.or(`name.ilike.${term},company_name.ilike.${term},tax_id.ilike.${term}`);

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as CustomerSearchResult[];
}
