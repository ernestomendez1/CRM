import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
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
import { requireBusiness } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

const PAGE_SIZE = 25;

type Customer = {
  id: string;
  name: string;
  company_name: string | null;
  tax_id: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
};

export default async function CustomersPage(props: PageProps<'/customers'>) {
  const searchParams = await props.searchParams;
  const q = typeof searchParams.q === 'string' ? searchParams.q : '';
  const page = Math.max(1, Number(searchParams.page) || 1);
  const showInactive = searchParams.inactive === '1';

  const ctx = await requireBusiness();
  const supabase = await createClient();
  const t = await getTranslations('customers');
  const tc = await getTranslations('common');

  let query = supabase
    .from('customers')
    .select('id, name, company_name, tax_id, email, phone, is_active', { count: 'exact' })
    .eq('business_id', ctx.businessId)
    .is('deleted_at', null)
    .order('name', { ascending: true })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (!showInactive) {
    query = query.eq('is_active', true);
  }
  if (q.trim()) {
    const term = `%${q.trim()}%`;
    query = query.or(`name.ilike.${term},company_name.ilike.${term},tax_id.ilike.${term}`);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const customers = (data ?? []) as Customer[];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <Button render={<Link href="/customers/new" />}>
          <Plus className="h-4 w-4" />
          {t('newCustomer')}
        </Button>
      </div>

      <form className="flex flex-wrap items-center gap-2">
        <Input
          name="q"
          defaultValue={q}
          placeholder={t('searchPlaceholder')}
          className="max-w-md"
        />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" name="inactive" value="1" defaultChecked={showInactive} />
          {t('showInactive')}
        </label>
        <Button type="submit" variant="outline" size="sm">
          {tc('search')}
        </Button>
      </form>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('fields.name')}</TableHead>
              <TableHead>{t('fields.companyName')}</TableHead>
              <TableHead>{t('fields.taxId')}</TableHead>
              <TableHead>{t('fields.email')}</TableHead>
              <TableHead>{t('fields.phone')}</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                  {t('noCustomers')}
                </TableCell>
              </TableRow>
            ) : (
              customers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <Link href={`/customers/${c.id}`} className="hover:underline">
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell>{c.company_name ?? '—'}</TableCell>
                  <TableCell>{c.tax_id ?? '—'}</TableCell>
                  <TableCell>{c.email ?? '—'}</TableCell>
                  <TableCell>{c.phone ?? '—'}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={c.is_active ? 'default' : 'secondary'}>
                      {c.is_active ? t('status.active') : t('status.inactive')}
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
  if (typeof sp.q === 'string' && sp.q) params.set('q', sp.q);
  if (sp.inactive === '1') params.set('inactive', '1');
  params.set('page', String(page));
  return `/customers?${params.toString()}`;
}
