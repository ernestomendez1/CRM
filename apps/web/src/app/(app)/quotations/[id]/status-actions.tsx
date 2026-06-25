'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { changeQuotationStatus, convertQuotationToInvoice } from '../actions';
import type { QuotationStatus } from '@crm/contracts/quotation';

export function StatusActions({
  id,
  status,
}: {
  id: string;
  status: QuotationStatus;
}) {
  const t = useTranslations('quotations');
  const [pending, startTransition] = useTransition();

  function go(target: QuotationStatus) {
    startTransition(async () => {
      try {
        await changeQuotationStatus(id, target);
        toast.success(t(`status.${target}`));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error');
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === 'draft' && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => go('sent')}>
          {t('actions.markSent')}
        </Button>
      )}
      {(status === 'sent' || status === 'draft') && (
        <Button size="sm" disabled={pending} onClick={() => go('accepted')}>
          {t('actions.markAccepted')}
        </Button>
      )}
      {(status === 'sent' || status === 'draft') && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => go('rejected')}>
          {t('actions.markRejected')}
        </Button>
      )}
      {status === 'sent' && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => go('expired')}>
          {t('actions.markExpired')}
        </Button>
      )}
      {status !== 'draft' && status !== 'accepted' && (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => go('draft')}>
          {t('actions.backToDraft')}
        </Button>
      )}

      {status === 'accepted' && (
        <Button
          size="sm"
          disabled={pending}
          onClick={() => {
            if (!window.confirm(t('convertConfirm'))) return;
            startTransition(async () => {
              try {
                await convertQuotationToInvoice(id);
                toast.success(t('convertSuccess'));
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Error');
              }
            });
          }}
        >
          {t('convertToInvoice')}
        </Button>
      )}
    </div>
  );
}
