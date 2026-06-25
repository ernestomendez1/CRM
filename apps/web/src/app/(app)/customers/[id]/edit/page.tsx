import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { requireBusiness } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import type { Customer } from '@/lib/validation/customer';
import { CustomerForm } from '../../customer-form';
import { updateCustomer } from '../../actions';

export default async function EditCustomerPage(props: PageProps<'/customers/[id]/edit'>) {
  const { id } = await props.params;
  const ctx = await requireBusiness();
  const supabase = await createClient();
  const t = await getTranslations('customers');
  const tc = await getTranslations('common');

  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .eq('business_id', ctx.businessId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) notFound();
  const customer = data as unknown as Customer;

  const boundAction = updateCustomer.bind(null, id);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" render={<Link href={`/customers/${id}`} />}>
          <ChevronLeft className="h-4 w-4" />
          {tc('back')}
        </Button>
      </div>
      <h1 className="text-2xl font-semibold">{t('editCustomer')}</h1>
      <CustomerForm customer={customer} action={boundAction} />
    </div>
  );
}
