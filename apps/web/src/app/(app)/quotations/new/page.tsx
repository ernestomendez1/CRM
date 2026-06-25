import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { QuotationForm } from '../quotation-form';
import { createQuotation } from '../actions';
import { loadPickerData } from '../data';

export default async function NewQuotationPage() {
  const t = await getTranslations('quotations');
  const tc = await getTranslations('common');
  const locale = await getLocale();
  const { customers, products, defaultCurrency, defaultTaxRate } = await loadPickerData();

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" render={<Link href="/quotations" />}>
        <ChevronLeft className="h-4 w-4" />
        {tc('back')}
      </Button>
      <h1 className="text-2xl font-semibold">{t('newQuotation')}</h1>
      <QuotationForm
        customers={customers}
        products={products}
        defaultTaxRate={defaultTaxRate}
        currency={defaultCurrency}
        locale={locale}
        action={createQuotation}
      />
    </div>
  );
}
