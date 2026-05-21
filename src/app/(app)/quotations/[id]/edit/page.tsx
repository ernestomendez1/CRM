import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { requireBusiness } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import type { Quotation, QuotationItem } from '@/lib/validation/quotation';
import { QuotationForm } from '../../quotation-form';
import { updateQuotation } from '../../actions';
import { loadPickerData } from '../../data';

export default async function EditQuotationPage(props: PageProps<'/quotations/[id]/edit'>) {
  const { id } = await props.params;
  const ctx = await requireBusiness();
  const supabase = await createClient();
  const t = await getTranslations('quotations');
  const tc = await getTranslations('common');
  const locale = await getLocale();

  const [{ data: quotation, error: qErr }, { data: items, error: iErr }] = await Promise.all([
    supabase
      .from('quotations')
      .select('*')
      .eq('id', id)
      .eq('business_id', ctx.businessId)
      .is('deleted_at', null)
      .maybeSingle(),
    supabase
      .from('quotation_items')
      .select('*')
      .eq('quotation_id', id)
      .order('sort_order'),
  ]);

  if (qErr) throw new Error(qErr.message);
  if (iErr) throw new Error(iErr.message);
  if (!quotation) notFound();
  const q = quotation as unknown as Quotation;

  if (q.converted_invoice_id) {
    // Already converted — cannot edit.
    redirect(`/quotations/${id}`);
  }

  const itemRows = ((items ?? []) as unknown as QuotationItem[]).map((it) => ({
    product_id: it.product_id ?? undefined,
    description: it.description,
    quantity: Number(it.quantity),
    unit_price: Number(it.unit_price),
    discount_pct: Number(it.discount_pct),
    tax_rate: Number(it.tax_rate),
  }));

  const { customers, products, defaultTaxRate } = await loadPickerData();
  const boundAction = updateQuotation.bind(null, id);

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" render={<Link href={`/quotations/${id}`} />}>
        <ChevronLeft className="h-4 w-4" />
        {tc('back')}
      </Button>
      <h1 className="text-2xl font-semibold">
        {t('editQuotation')} <span className="text-muted-foreground">· {q.quotation_number}</span>
      </h1>
      <QuotationForm
        customers={customers}
        products={products}
        defaultTaxRate={defaultTaxRate}
        currency={q.currency}
        locale={locale}
        defaults={{
          customer_id: q.customer_id,
          issue_date: q.issue_date,
          expiry_date: q.expiry_date ?? undefined,
          notes: q.notes ?? undefined,
          terms: q.terms ?? undefined,
          items: itemRows,
        }}
        action={boundAction}
      />
    </div>
  );
}
