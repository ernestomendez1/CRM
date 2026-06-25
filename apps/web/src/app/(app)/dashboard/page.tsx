import Link from 'next/link';
import { Plus } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function DashboardPage() {
  const t = await getTranslations('dashboard');
  const tq = await getTranslations('quotations');

  const cards = [
    { key: 'monthlyIncome', value: '—' },
    { key: 'monthlyExpenses', value: '—' },
    { key: 'accountsReceivable', value: '—' },
    { key: 'netProfit', value: '—' },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('welcome')}</p>
        </div>
        <Button render={<Link href="/quotations/new" />}>
          <Plus className="h-4 w-4" />
          {tq('newQuotation')}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t(c.key)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
