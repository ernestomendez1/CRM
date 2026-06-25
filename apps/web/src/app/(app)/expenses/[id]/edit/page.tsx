import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { requireBusiness } from '@/lib/auth/session';
import { createClient } from '@crm/db/server';
import type { Expense } from '@crm/contracts/expense';
import { ExpenseForm } from '../../expense-form';
import { updateExpense } from '../../actions';

export default async function EditExpensePage(props: PageProps<'/expenses/[id]/edit'>) {
  const { id } = await props.params;
  const ctx = await requireBusiness();
  const supabase = await createClient();
  const t = await getTranslations('expenses');
  const tc = await getTranslations('common');

  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('id', id)
    .eq('business_id', ctx.businessId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) notFound();
  const expense = data as unknown as Expense;

  const boundAction = updateExpense.bind(null, id);

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" render={<Link href={`/expenses/${id}`} />}>
        <ChevronLeft className="h-4 w-4" />
        {tc('back')}
      </Button>
      <h1 className="text-2xl font-semibold">{t('editExpense')}</h1>
      <ExpenseForm
        expense={expense}
        defaultCurrency={expense.currency}
        action={boundAction}
      />
    </div>
  );
}
