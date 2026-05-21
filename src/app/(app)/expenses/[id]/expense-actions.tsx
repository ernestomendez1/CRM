'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { deleteExpense, removeReceipt } from '../actions';

export function ExpenseActions({
  id,
  hasReceipt,
}: {
  id: string;
  hasReceipt: boolean;
}) {
  const t = useTranslations('expenses');
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onDelete() {
    if (!window.confirm(t('deleteConfirm'))) return;
    startTransition(async () => {
      try {
        await deleteExpense(id);
        toast.success(t('deleted'));
        router.push('/expenses');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error');
      }
    });
  }

  function onRemoveReceipt() {
    if (!window.confirm(t('removeReceiptConfirm'))) return;
    startTransition(async () => {
      try {
        await removeReceipt(id);
        toast.success(t('receiptRemoved'));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error');
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      {hasReceipt && (
        <Button size="sm" variant="outline" disabled={pending} onClick={onRemoveReceipt}>
          {t('removeReceipt')}
        </Button>
      )}
      <Button size="sm" variant="outline" disabled={pending} onClick={onDelete}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
