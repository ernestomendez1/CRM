'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { changeInvoiceStatus, deleteInvoice } from '../actions';
import type { InvoiceStatus } from '@crm/contracts/invoice';

export function InvoiceActions({
  id,
  status,
}: {
  id: string;
  status: InvoiceStatus;
}) {
  const t = useTranslations('invoices');
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function go(target: 'issued' | 'cancelled' | 'draft') {
    startTransition(async () => {
      try {
        await changeInvoiceStatus(id, target);
        toast.success(t(`status.${target}` as const));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error');
      }
    });
  }

  function onDelete() {
    if (!window.confirm(t('deleteConfirm'))) return;
    startTransition(async () => {
      try {
        await deleteInvoice(id);
        toast.success(t('deleted'));
        router.push('/invoices');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error');
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === 'draft' && (
        <>
          <Button
            size="sm"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(t('issueConfirm'))) return;
              go('issued');
            }}
          >
            {t('actions.issue')}
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={onDelete}>
            {t('deleteConfirm').replace(/\?$/, '')}
          </Button>
        </>
      )}
      {status === 'issued' || status === 'partially_paid' || status === 'overdue' ? (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => {
            if (!window.confirm(t('cancelConfirm'))) return;
            go('cancelled');
          }}
        >
          {t('actions.cancel')}
        </Button>
      ) : null}
      {status === 'cancelled' && (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => go('draft')}>
          {t('actions.backToDraft')}
        </Button>
      )}
    </div>
  );
}
