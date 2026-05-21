import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Pencil } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { requireBusiness } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import type { Customer } from '@/lib/validation/customer';
import type { Quotation, QuotationStatus } from '@/lib/validation/quotation';
import type { Invoice, InvoiceStatus } from '@/lib/validation/invoice';
import { formatMoney } from '@/lib/money/format';
import { CustomerDangerActions } from './danger-actions';

const quotationStatusVariant: Record<QuotationStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'secondary',
  sent: 'outline',
  accepted: 'default',
  rejected: 'destructive',
  expired: 'secondary',
};
const invoiceStatusVariant: Record<InvoiceStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'secondary',
  issued: 'outline',
  partially_paid: 'outline',
  paid: 'default',
  overdue: 'destructive',
  cancelled: 'secondary',
};

type Row = { label: string; value: string | null | undefined };
function InfoRow({ label, value }: Row) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="col-span-2 break-words">{value || '—'}</dd>
    </div>
  );
}

export default async function CustomerDetailPage(props: PageProps<'/customers/[id]'>) {
  const { id } = await props.params;
  const ctx = await requireBusiness();
  const supabase = await createClient();
  const t = await getTranslations('customers');
  const tq = await getTranslations('quotations');
  const ti = await getTranslations('invoices');
  const tp = await getTranslations('payments');
  const tc = await getTranslations('common');
  const locale = await getLocale();

  const [{ data, error }, { data: quotationsData }, { data: invoicesData }, { data: paymentsData }] =
    await Promise.all([
      supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .eq('business_id', ctx.businessId)
        .maybeSingle(),
      supabase
        .from('quotations')
        .select('id, quotation_number, issue_date, status, total, currency')
        .eq('business_id', ctx.businessId)
        .eq('customer_id', id)
        .is('deleted_at', null)
        .order('issue_date', { ascending: false }),
      supabase
        .from('invoices')
        .select('id, invoice_number, issue_date, due_date, status, total, balance_due, currency')
        .eq('business_id', ctx.businessId)
        .eq('customer_id', id)
        .is('deleted_at', null)
        .order('issue_date', { ascending: false }),
      supabase
        .from('payments')
        .select(
          'id, payment_date, amount, method, reference, invoices!inner(id, invoice_number, customer_id)',
        )
        .eq('business_id', ctx.businessId)
        .eq('invoices.customer_id', id)
        .is('deleted_at', null)
        .order('payment_date', { ascending: false }),
    ]);

  if (error) throw new Error(error.message);
  if (!data) notFound();
  const c = data as unknown as Customer;

  const quotations = (quotationsData ?? []) as unknown as (Pick<
    Quotation,
    'id' | 'quotation_number' | 'issue_date' | 'status' | 'total' | 'currency'
  >)[];
  const invoices = (invoicesData ?? []) as unknown as (Pick<
    Invoice,
    'id' | 'invoice_number' | 'issue_date' | 'due_date' | 'status' | 'total' | 'balance_due' | 'currency'
  >)[];
  const payments = (paymentsData ?? []) as unknown as {
    id: string;
    payment_date: string;
    amount: number;
    method: string;
    reference: string | null;
    invoices: { id: string; invoice_number: string } | null;
  }[];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" render={<Link href="/customers" />}>
            <ChevronLeft className="h-4 w-4" />
            {tc('back')}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" render={<Link href={`/customers/${id}/edit`} />}>
            <Pencil className="h-4 w-4" />
            {tc('edit')}
          </Button>
          <CustomerDangerActions id={id} isActive={c.is_active} isDeleted={!!c.deleted_at} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{c.name}</h1>
        <Badge variant={c.is_active && !c.deleted_at ? 'default' : 'secondary'}>
          {c.is_active && !c.deleted_at ? t('status.active') : t('status.inactive')}
        </Badge>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{t('tabs.overview')}</TabsTrigger>
          <TabsTrigger value="quotations">{t('tabs.quotations')}</TabsTrigger>
          <TabsTrigger value="invoices">{t('tabs.invoices')}</TabsTrigger>
          <TabsTrigger value="payments">{t('tabs.payments')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('tabs.overview')}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y">
                <InfoRow label={t('fields.companyName')} value={c.company_name} />
                <InfoRow
                  label={t('fields.taxIdType')}
                  value={c.tax_id_type ? t(`taxIdTypes.${c.tax_id_type}`) : null}
                />
                <InfoRow label={t('fields.taxId')} value={c.tax_id} />
                <InfoRow label={t('fields.email')} value={c.email} />
                <InfoRow label={t('fields.phone')} value={c.phone} />
                <InfoRow label={t('fields.address')} value={c.address} />
                <InfoRow label={t('fields.city')} value={c.city} />
                <InfoRow label={t('fields.country')} value={c.country} />
                <InfoRow label={t('fields.notes')} value={c.notes} />
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quotations" className="mt-4">
          {quotations.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                {tq('noQuotations')}
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tq('fields.quotationNumber')}</TableHead>
                    <TableHead>{tq('fields.issueDate')}</TableHead>
                    <TableHead className="text-right">{tq('lineItems.total')}</TableHead>
                    <TableHead className="text-right">{tq('fields.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotations.map((q) => (
                    <TableRow key={q.id}>
                      <TableCell className="font-medium">
                        <Link href={`/quotations/${q.id}`} className="hover:underline">
                          {q.quotation_number}
                        </Link>
                      </TableCell>
                      <TableCell>{q.issue_date}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(Number(q.total), { currency: q.currency, locale })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={quotationStatusVariant[q.status]}>
                          {tq(`status.${q.status}`)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
          {invoices.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                {ti('noInvoices')}
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{ti('fields.invoiceNumber')}</TableHead>
                    <TableHead>{ti('fields.issueDate')}</TableHead>
                    <TableHead>{ti('fields.dueDate')}</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">{ti('fields.balanceDue')}</TableHead>
                    <TableHead className="text-right">{ti('fields.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">
                        <Link href={`/invoices/${i.id}`} className="hover:underline">
                          {i.invoice_number}
                        </Link>
                      </TableCell>
                      <TableCell>{i.issue_date}</TableCell>
                      <TableCell>{i.due_date ?? '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(Number(i.total), { currency: i.currency, locale })}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(Number(i.balance_due), { currency: i.currency, locale })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={invoiceStatusVariant[i.status]}>
                          {ti(`status.${i.status}`)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          {payments.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                {tp('noPayments')}
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tp('fields.date')}</TableHead>
                    <TableHead>{ti('fields.invoiceNumber')}</TableHead>
                    <TableHead>{tp('fields.method')}</TableHead>
                    <TableHead>{tp('fields.reference')}</TableHead>
                    <TableHead className="text-right">{tp('fields.amount')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.payment_date}</TableCell>
                      <TableCell>
                        {p.invoices ? (
                          <Link
                            href={`/invoices/${p.invoices.id}`}
                            className="hover:underline"
                          >
                            {p.invoices.invoice_number}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>{tp(`methods.${p.method as 'cash' | 'transfer' | 'check' | 'card' | 'other'}`)}</TableCell>
                      <TableCell>{p.reference ?? '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(p.amount).toLocaleString(locale, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
