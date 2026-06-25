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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { requireBusiness } from '@/lib/auth/session';
import { createClient } from '@crm/db/server';
import { formatMoney } from '@/lib/money/format';

const PAGE_SIZE = 25;

type Row = {
  id: string;
  vendor_name: string;
  vendor_tax_id: string | null;
  expense_date: string;
  category: string | null;
  total: number;
  currency: string;
  has_fiscal_receipt: boolean;
  fiscal_receipt_number: string | null;
};

export default async function ExpensesPage(props: PageProps<'/expenses'>) {
  const searchParams = await props.searchParams;
  const q = typeof searchParams.q === 'string' ? searchParams.q : '';
  const from = typeof searchParams.from === 'string' ? searchParams.from : '';
  const to = typeof searchParams.to === 'string' ? searchParams.to : '';
  const fiscal = typeof searchParams.fiscal === 'string' ? searchParams.fiscal : '';
  const page = Math.max(1, Number(searchParams.page) || 1);

  const ctx = await requireBusiness();
  const supabase = await createClient();
  const t = await getTranslations('expenses');
  const tc = await getTranslations('common');
  const locale = await getLocale();

  let query = supabase
    .from('expenses')
    .select(
      'id, vendor_name, vendor_tax_id, expense_date, category, total, currency, has_fiscal_receipt, fiscal_receipt_number',
      { count: 'exact' },
    )
    .eq('business_id', ctx.businessId)
    .is('deleted_at', null)
    .order('expense_date', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (q.trim()) {
    const term = `%${q.trim()}%`;
    query = query.or(`vendor_name.ilike.${term},fiscal_receipt_number.ilike.${term}`);
  }
  if (from) query = query.gte('expense_date', from);
  if (to) query = query.lte('expense_date', to);
  if (fiscal === 'yes') query = query.eq('has_fiscal_receipt', true);
  if (fiscal === 'no') query = query.eq('has_fiscal_receipt', false);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Row[];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <Button render={<Link href="/expenses/new" />}>
          <Plus className="h-4 w-4" />
          {t('newExpense')}
        </Button>
      </div>

      <form className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor="q" className="sr-only">
            {tc('search')}
          </Label>
          <Input
            id="q"
            name="q"
            defaultValue={q}
            placeholder={t('searchPlaceholder')}
            className="w-72"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="from" className="text-xs text-muted-foreground">
            {t('from')}
          </Label>
          <Input id="from" name="from" type="date" defaultValue={from} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="to" className="text-xs text-muted-foreground">
            {t('to')}
          </Label>
          <Input id="to" name="to" type="date" defaultValue={to} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="fiscal" className="text-xs text-muted-foreground">
            {t('filterFiscal')}
          </Label>
          <Select name="fiscal" defaultValue={fiscal}>
            <SelectTrigger id="fiscal" className="w-44">
              <SelectValue placeholder={t('anyFiscal')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">{t('anyFiscal')}</SelectItem>
              <SelectItem value="yes">{t('withFiscal')}</SelectItem>
              <SelectItem value="no">{t('withoutFiscal')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" variant="outline" size="sm">
          {tc('search')}
        </Button>
      </form>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('fields.expenseDate')}</TableHead>
              <TableHead>{t('fields.vendorName')}</TableHead>
              <TableHead>{t('fields.category')}</TableHead>
              <TableHead>{t('fields.fiscalReceiptNumber')}</TableHead>
              <TableHead className="text-right">{t('fields.total')}</TableHead>
              <TableHead className="text-right">{t('fields.hasFiscalReceipt')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                  {t('noExpenses')}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{e.expense_date}</TableCell>
                  <TableCell className="font-medium">
                    <Link href={`/expenses/${e.id}`} className="hover:underline">
                      {e.vendor_name}
                    </Link>
                    {e.vendor_tax_id && (
                      <span className="block text-xs text-muted-foreground">
                        {e.vendor_tax_id}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{e.category ?? '—'}</TableCell>
                  <TableCell>{e.fiscal_receipt_number ?? '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(Number(e.total), { currency: e.currency, locale })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={e.has_fiscal_receipt ? 'default' : 'secondary'}>
                      {e.has_fiscal_receipt ? tc('yes') : tc('no')}
                    </Badge>
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
  for (const key of ['q', 'from', 'to', 'fiscal']) {
    const v = sp[key];
    if (typeof v === 'string' && v) params.set(key, v);
  }
  params.set('page', String(page));
  return `/expenses?${params.toString()}`;
}
