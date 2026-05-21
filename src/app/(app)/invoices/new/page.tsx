import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { InvoiceForm } from '../invoice-form';
import { createInvoice } from '../actions';
import { loadPickerData } from '../data';

export default async function NewInvoicePage() {
  const t = await getTranslations('invoices');
  const tc = await getTranslations('common');
  const locale = await getLocale();
  const { customers, products, defaultCurrency, defaultTaxRate, defaultPaymentTermsDays } =
    await loadPickerData();

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" render={<Link href="/invoices" />}>
        <ChevronLeft className="h-4 w-4" />
        {tc('back')}
      </Button>
      <h1 className="text-2xl font-semibold">{t('newInvoice')}</h1>
      <InvoiceForm
        customers={customers}
        products={products}
        defaultTaxRate={defaultTaxRate}
        defaultPaymentTermsDays={defaultPaymentTermsDays}
        currency={defaultCurrency}
        locale={locale}
        action={createInvoice}
      />
    </div>
  );
}
