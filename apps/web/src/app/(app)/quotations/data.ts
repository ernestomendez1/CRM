import { requireBusiness } from '@/lib/auth/session';
import { createClient } from '@crm/db/server';
import type { CustomerOption } from './quotation-form';
import type { ProductOption } from '@/components/forms/line-items-table';

export async function loadPickerData(): Promise<{
  customers: CustomerOption[];
  products: ProductOption[];
  defaultCurrency: string;
  defaultTaxRate: number;
}> {
  const ctx = await requireBusiness();
  const supabase = await createClient();

  const [{ data: customers }, { data: products }, { data: business }] = await Promise.all([
    supabase
      .from('customers')
      .select('id, name, company_name')
      .eq('business_id', ctx.businessId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name'),
    supabase
      .from('products')
      .select('id, name, unit_price, is_taxable, tax_rate_override')
      .eq('business_id', ctx.businessId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name'),
    supabase
      .from('businesses')
      .select('default_currency, default_tax_rate')
      .eq('id', ctx.businessId)
      .maybeSingle(),
  ]);

  return {
    customers: (customers ?? []) as CustomerOption[],
    products: (products ?? []) as ProductOption[],
    defaultCurrency:
      (business as { default_currency: string } | null)?.default_currency ?? 'DOP',
    defaultTaxRate: Number(
      (business as { default_tax_rate: number } | null)?.default_tax_rate ?? 0.18,
    ),
  };
}
