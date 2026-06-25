import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { requireBusiness } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import type { Invoice, InvoiceItem } from '@crm/contracts/invoice';
import { InvoiceForm } from '../../invoice-form';
import { updateInvoice } from '../../actions';
import { loadPickerData } from '../../data';

export default async function EditInvoicePage(props: PageProps<'/invoices/[id]/edit'>) {
  const { id } = await props.params;
  const ctx = await requireBusiness();
  const supabase = await createClient();
  const t = await getTranslations('invoices');
  const tc = await getTranslations('common');
  const locale = await getLocale();

  const [{ data: invoice, error: invErr }, { data: items, error: iErr }] = await Promise.all([
    supabase
      .from('invoices')
      .select('*')
      .eq('id', id)
      .eq('business_id', ctx.businessId)
      .is('deleted_at', null)
      .maybeSingle(),
    supabase.from('invoice_items').select('*').eq('invoice_id', id).order('sort_order'),
  ]);
  if (invErr) throw new Error(invErr.message);
  if (iErr) throw new Error(iErr.message);
  if (!invoice) notFound();
  const inv = invoice as unknown as Invoice;

  if (inv.status !== 'draft') {
    redirect(`/invoices/${id}`);
  }

  const itemRows = ((items ?? []) as unknown as InvoiceItem[]).map((it) => ({
    product_id: it.product_id ?? undefined,
    description: it.description,
    quantity: Number(it.quantity),
    unit_price: Number(it.unit_price),
    discount_pct: Number(it.discount_pct),
    tax_rate: Number(it.tax_rate),
  }));

  const { customers, products, defaultTaxRate, defaultPaymentTermsDays } = await loadPickerData();
  const boundAction = updateInvoice.bind(null, id);

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" render={<Link href={`/invoices/${id}`} />}>
        <ChevronLeft className="h-4 w-4" />
        {tc('back')}
      </Button>
      <h1 className="text-2xl font-semibold">
        {t('editInvoice')} <span className="text-muted-foreground">· {inv.invoice_number}</span>
      </h1>
      <InvoiceForm
        customers={customers}
        products={products}
        defaultTaxRate={defaultTaxRate}
        defaultPaymentTermsDays={defaultPaymentTermsDays}
        currency={inv.currency}
        locale={locale}
        defaults={{
          customer_id: inv.customer_id,
          issue_date: inv.issue_date,
          due_date: inv.due_date ?? undefined,
          notes: inv.notes ?? undefined,
          terms: inv.terms ?? undefined,
          items: itemRows,
        }}
        action={boundAction}
      />
    </div>
  );
}
