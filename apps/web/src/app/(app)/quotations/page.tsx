import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { requireBusiness } from '@/lib/auth/session';
import { listQuotations } from '@/lib/api/quotations';
import { formatMoney } from '@crm/core/money';
import { quotationStatuses, type QuotationStatus } from '@crm/contracts/quotation';

const PAGE_SIZE = 25;

const statusVariant: Record<QuotationStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'secondary',
  sent: 'outline',
  accepted: 'default',
  rejected: 'destructive',
  expired: 'secondary',
};

export default async function QuotationsPage(props: PageProps<'/quotations'>) {
  const searchParams = await props.searchParams;
  const q = typeof searchParams.q === 'string' ? searchParams.q : '';
  const statusFilter =
    typeof searchParams.status === 'string' &&
    (quotationStatuses as readonly string[]).includes(searchParams.status)
      ? (searchParams.status as QuotationStatus)
      : null;
  const page = Math.max(1, Number(searchParams.page) || 1);

  await requireBusiness();
  const t = await getTranslations('quotations');
  const tc = await getTranslations('common');
  const locale = await getLocale();

  const res = await listQuotations({
    q,
    status: statusFilter ?? undefined,
    page,
    size: PAGE_SIZE,
  });
  if (!res.ok) throw new Error(res.error);
  const { rows, count } = res.data;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <Button render={<Link href="/quotations/new" />}>
          <Plus className="h-4 w-4" />
          {t('newQuotation')}
        </Button>
      </div>

      <form className="flex flex-wrap items-center gap-2">
        <Input
          name="q"
          defaultValue={q}
          placeholder={t('searchPlaceholder')}
          className="max-w-md"
        />
        <Select name="status" defaultValue={statusFilter ?? ''}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder={t('allStatuses')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t('allStatuses')}</SelectItem>
            {quotationStatuses.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`status.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" variant="outline" size="sm">
          {tc('search')}
        </Button>
      </form>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('fields.quotationNumber')}</TableHead>
              <TableHead>{t('fields.customer')}</TableHead>
              <TableHead>{t('fields.issueDate')}</TableHead>
              <TableHead>{t('fields.expiryDate')}</TableHead>
              <TableHead className="text-right">{t('lineItems.total')}</TableHead>
              <TableHead className="text-right">{t('fields.status')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                  {t('noQuotations')}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    <Link href={`/quotations/${r.id}`} className="hover:underline">
                      {r.quotation_number}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {r.customer?.company_name || r.customer?.name || '—'}
                  </TableCell>
                  <TableCell>{r.issue_date}</TableCell>
                  <TableCell>{r.expiry_date ?? '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(Number(r.total), { currency: r.currency, locale })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={statusVariant[r.status]}>{t(`status.${r.status}`)}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {page} of {totalPages} · {count} total
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Button variant="outline" size="sm" render={<Link href={pageHref(searchParams, page - 1)} />}>
                ‹
              </Button>
            )}
            {page < totalPages && (
              <Button variant="outline" size="sm" render={<Link href={pageHref(searchParams, page + 1)} />}>
                ›
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function pageHref(sp: Record<string, string | string[] | undefined>, page: number) {
  const params = new URLSearchParams();
  if (typeof sp.q === 'string' && sp.q) params.set('q', sp.q);
  if (typeof sp.status === 'string' && sp.status) params.set('status', sp.status);
  params.set('page', String(page));
  return `/quotations?${params.toString()}`;
}
