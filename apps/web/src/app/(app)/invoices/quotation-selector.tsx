'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatMoney } from '@crm/core/money';
import type { QuotationStatus } from '@crm/contracts/quotation';

const NONE_VALUE = '__none__';

export type QuotationOption = {
  id: string;
  quotation_number: string;
  status: QuotationStatus;
  total: number;
  currency: string;
  customer_name: string;
};

type Props = {
  quotations: QuotationOption[];
  selectedId?: string;
  locale: string;
};

export function QuotationSelector({ quotations, selectedId, locale }: Props) {
  const t = useTranslations('invoices');
  const tq = useTranslations('quotations.status');
  const router = useRouter();

  function handleChange(value: string | null) {
    if (!value || value === NONE_VALUE) {
      router.replace('/invoices/new');
    } else {
      router.replace(`/invoices/new?quotation_id=${value}`);
    }
  }

  return (
    <div className="rounded-md border bg-muted/30 p-4 space-y-2 max-w-4xl">
      <Label htmlFor="quotation_selector">{t('fromQuotation')}</Label>
      <p className="text-xs text-muted-foreground">{t('fromQuotationHelp')}</p>
      <Select
        value={selectedId ?? NONE_VALUE}
        onValueChange={handleChange}
        disabled={quotations.length === 0}
      >
        <SelectTrigger id="quotation_selector" className="w-full">
          <SelectValue
            placeholder={
              quotations.length === 0
                ? t('fromQuotationEmpty')
                : t('fromQuotationNone')
            }
          />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_VALUE}>{t('fromQuotationNone')}</SelectItem>
          {quotations.map((q) => (
            <SelectItem key={q.id} value={q.id}>
              {`#${q.quotation_number} — ${q.customer_name} — ${formatMoney(
                q.total,
                { currency: q.currency, locale },
              )} · ${tq(q.status)}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
