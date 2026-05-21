import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { CustomerForm } from '../customer-form';
import { createCustomer } from '../actions';

export default async function NewCustomerPage() {
  const t = await getTranslations('customers');
  const tc = await getTranslations('common');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" render={<Link href="/customers" />}>
          <ChevronLeft className="h-4 w-4" />
          {tc('back')}
        </Button>
      </div>
      <h1 className="text-2xl font-semibold">{t('newCustomer')}</h1>
      <CustomerForm action={createCustomer} />
    </div>
  );
}
