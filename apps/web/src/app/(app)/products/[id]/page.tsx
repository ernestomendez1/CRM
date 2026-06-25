import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Pencil } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireBusiness } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import type { Product } from '@crm/contracts/product';
import { formatMoney, formatPercent } from '@/lib/money/format';
import { ProductDangerActions } from './danger-actions';

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="col-span-2 break-words">{value || '—'}</dd>
    </div>
  );
}

export default async function ProductDetailPage(props: PageProps<'/products/[id]'>) {
  const { id } = await props.params;
  const ctx = await requireBusiness();
  const supabase = await createClient();
  const t = await getTranslations('products');
  const tc = await getTranslations('common');
  const locale = await getLocale();

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .eq('business_id', ctx.businessId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) notFound();
  const p = data as unknown as Product;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" render={<Link href="/products" />}>
          <ChevronLeft className="h-4 w-4" />
          {tc('back')}
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" render={<Link href={`/products/${id}/edit`} />}>
            <Pencil className="h-4 w-4" />
            {tc('edit')}
          </Button>
          <ProductDangerActions id={id} isActive={p.is_active} isDeleted={!!p.deleted_at} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{p.name}</h1>
        <Badge variant="outline">{t(`types.${p.type}`)}</Badge>
        <Badge variant={p.is_active && !p.deleted_at ? 'default' : 'secondary'}>
          {p.is_active && !p.deleted_at ? t('status.active') : t('status.inactive')}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="divide-y">
            <InfoRow label={t('fields.sku')} value={p.sku} />
            <InfoRow label={t('fields.description')} value={p.description} />
            <InfoRow
              label={t('fields.unitPrice')}
              value={formatMoney(Number(p.unit_price), { locale })}
            />
            <InfoRow label={t('fields.isTaxable')} value={p.is_taxable ? tc('yes') : tc('no')} />
            <InfoRow
              label={t('fields.taxRateOverride')}
              value={p.tax_rate_override != null ? formatPercent(Number(p.tax_rate_override), locale) : null}
            />
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
