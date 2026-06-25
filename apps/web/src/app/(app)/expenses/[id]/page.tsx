import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, ExternalLink, Pencil } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireBusiness } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatMoney } from '@/lib/money/format';
import type { Expense } from '@/lib/validation/expense';
import { ExpenseActions } from './expense-actions';
import { getReceiptSignedUrl } from '../actions';

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="col-span-2 break-words">{value || '—'}</dd>
    </div>
  );
}

export default async function ExpenseDetailPage(props: PageProps<'/expenses/[id]'>) {
  const { id } = await props.params;
  const ctx = await requireBusiness();
  const supabase = await createClient();
  const t = await getTranslations('expenses');
  const tc = await getTranslations('common');
  const locale = await getLocale();

  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('id', id)
    .eq('business_id', ctx.businessId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) notFound();
  const e = data as unknown as Expense;

  const receiptUrl = e.receipt_file_url ? await getReceiptSignedUrl(e.receipt_file_url) : null;
  const isPdfReceipt = !!e.receipt_file_url && e.receipt_file_url.toLowerCase().endsWith('.pdf');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" render={<Link href="/expenses" />}>
          <ChevronLeft className="h-4 w-4" />
          {tc('back')}
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" render={<Link href={`/expenses/${id}/edit`} />}>
            <Pencil className="h-4 w-4" />
            {tc('edit')}
          </Button>
          <ExpenseActions id={e.id} hasReceipt={!!e.receipt_file_url} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{e.vendor_name}</h1>
        <Badge variant={e.has_fiscal_receipt ? 'default' : 'secondary'}>
          {e.has_fiscal_receipt ? t('withFiscal') : t('withoutFiscal')}
        </Badge>
        <span className="text-lg font-semibold tabular-nums text-muted-foreground">
          {formatMoney(Number(e.total), { currency: e.currency, locale })}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y">
              <InfoRow label={t('fields.expenseDate')} value={e.expense_date} />
              <InfoRow label={t('fields.vendorTaxId')} value={e.vendor_tax_id} />
              <InfoRow label={t('fields.category')} value={e.category} />
              <InfoRow label={t('fields.description')} value={e.description} />
              <InfoRow
                label={t('fields.subtotal')}
                value={formatMoney(Number(e.subtotal), { currency: e.currency, locale })}
              />
              <InfoRow
                label={t('fields.taxAmount')}
                value={formatMoney(Number(e.tax_amount), { currency: e.currency, locale })}
              />
              <InfoRow
                label={t('fields.total')}
                value={formatMoney(Number(e.total), { currency: e.currency, locale })}
              />
              <InfoRow
                label={t('fields.fiscalReceiptNumber')}
                value={e.fiscal_receipt_number}
              />
              <InfoRow
                label={t('fields.paymentMethod')}
                value={e.payment_method ? t(`paymentMethods.${e.payment_method}`) : null}
              />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t('fields.receipt')}</CardTitle>
              {receiptUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  render={<a href={receiptUrl} target="_blank" rel="noopener" />}
                >
                  <ExternalLink className="h-4 w-4" />
                  {t('viewReceipt')}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!receiptUrl ? (
              <p className="text-sm text-muted-foreground">No receipt attached.</p>
            ) : isPdfReceipt ? (
              <iframe
                src={receiptUrl}
                title="Receipt"
                className="h-[480px] w-full rounded border"
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={receiptUrl}
                alt="Receipt"
                className="max-h-[480px] w-full rounded border object-contain"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
