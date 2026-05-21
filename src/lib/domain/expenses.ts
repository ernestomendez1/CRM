import 'server-only';

import type { CurrentContext } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import type { ExpenseInput } from '@/lib/validation/expense';

type DbClient = Awaited<ReturnType<typeof createClient>>;

export type ExpenseSearchResult = {
  id: string;
  vendor_name: string;
  vendor_tax_id: string | null;
  expense_date: string;
  category: string | null;
  total: number;
  currency: string;
  has_fiscal_receipt: boolean;
  fiscal_receipt_number: string | null;
};

export async function createExpenseRecord(
  ctx: CurrentContext,
  input: ExpenseInput,
  options?: { receiptFileUrl?: string | null; client?: DbClient },
): Promise<{ id: string; vendor_name: string }> {
  const supabase = options?.client ?? (await createClient());
  const total = input.subtotal + input.tax_amount;
  const { data, error } = await supabase
    .from('expenses')
    .insert({
      ...input,
      total,
      receipt_file_url: options?.receiptFileUrl ?? null,
      business_id: ctx.businessId,
      created_by: ctx.userId,
    })
    .select('id, vendor_name')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as { id: string; vendor_name: string };
}

export async function searchExpenses(
  ctx: CurrentContext,
  params: {
    query: string;
    from?: string;
    to?: string;
    hasFiscalReceipt?: boolean;
    limit?: number;
  },
  client?: DbClient,
): Promise<ExpenseSearchResult[]> {
  const supabase = client ?? (await createClient());
  let query = supabase
    .from('expenses')
    .select(
      'id, vendor_name, vendor_tax_id, expense_date, category, total, currency, has_fiscal_receipt, fiscal_receipt_number',
    )
    .eq('business_id', ctx.businessId)
    .is('deleted_at', null)
    .order('expense_date', { ascending: false })
    .limit(params.limit ?? 5);

  const term = `%${params.query.trim()}%`;
  query = query.or(`vendor_name.ilike.${term},fiscal_receipt_number.ilike.${term}`);

  if (params.from) query = query.gte('expense_date', params.from);
  if (params.to) query = query.lte('expense_date', params.to);
  if (typeof params.hasFiscalReceipt === 'boolean') {
    query = query.eq('has_fiscal_receipt', params.hasFiscalReceipt);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ExpenseSearchResult[];
}
