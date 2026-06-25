import 'server-only';

import type { CurrentContext } from '@/lib/auth/session';
import { createClient } from '@crm/db/server';

type DbClient = Awaited<ReturnType<typeof createClient>>;

export type BusinessDefaults = {
  businessName: string;
  defaultCurrency: string;
  defaultTaxRate: number;
  defaultPaymentTermsDays: number;
};

export async function loadBusinessDefaults(
  ctx: CurrentContext,
  client?: DbClient,
): Promise<BusinessDefaults> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from('businesses')
    .select('name, default_currency, default_tax_rate, default_payment_terms_days')
    .eq('id', ctx.businessId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const business = data as
    | {
        name: string | null;
        default_currency: string | null;
        default_tax_rate: number | null;
        default_payment_terms_days: number | null;
      }
    | null;

  return {
    businessName: business?.name?.trim() || 'CRM business',
    defaultCurrency: business?.default_currency?.trim().toUpperCase() || 'DOP',
    defaultTaxRate: Number(business?.default_tax_rate ?? 0.18),
    defaultPaymentTermsDays: Number(business?.default_payment_terms_days ?? 30),
  };
}
