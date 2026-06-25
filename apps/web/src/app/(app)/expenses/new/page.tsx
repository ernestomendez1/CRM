import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { requireBusiness } from '@/lib/auth/session';
import { createClient } from '@crm/db/server';
import { ExpenseForm } from '../expense-form';
import { createExpense } from '../actions';

export default async function NewExpensePage() {
  const t = await getTranslations('expenses');
  const tc = await getTranslations('common');

  const ctx = await requireBusiness();
  const supabase = await createClient();
  const { data } = await supabase
    .from('businesses')
    .select('default_currency')
    .eq('id', ctx.businessId)
    .maybeSingle();
  const currency = (data as { default_currency: string } | null)?.default_currency ?? 'DOP';

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" render={<Link href="/expenses" />}>
        <ChevronLeft className="h-4 w-4" />
        {tc('back')}
      </Button>
      <h1 className="text-2xl font-semibold">{t('newExpense')}</h1>
      <ExpenseForm defaultCurrency={currency} action={createExpense} />
    </div>
  );
}
