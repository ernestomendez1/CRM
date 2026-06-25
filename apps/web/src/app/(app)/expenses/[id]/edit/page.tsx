import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { requireBusiness } from '@/lib/auth/session';
import { getExpense } from '@/lib/api/expenses';
import { ExpenseForm } from '../../expense-form';
import { updateExpense } from '../../actions';

export default async function EditExpensePage(props: PageProps<'/expenses/[id]/edit'>) {
  const { id } = await props.params;
  await requireBusiness();
  const t = await getTranslations('expenses');
  const tc = await getTranslations('common');

  const res = await getExpense(id);
  if (!res.ok) {
    if (res.error.includes('not found')) notFound();
    throw new Error(res.error);
  }
  const expense = res.data;
  if (expense.deleted_at) notFound();

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
