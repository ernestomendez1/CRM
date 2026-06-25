import Link from 'next/link';
import { Inbox, Building2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { getAdminStats } from '@/lib/api/admin';

function StatCard({
  icon: Icon,
  label,
  value,
  href,
  tone = 'default',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  href: string;
  tone?: 'default' | 'warning' | 'success';
}) {
  const toneClass =
    tone === 'warning'
      ? 'text-amber-600'
      : tone === 'success'
        ? 'text-emerald-600'
        : 'text-muted-foreground';
  return (
    <Card>
      <CardContent className="p-4">
        <Link href={href} className="block space-y-1">
          <div className={`flex items-center gap-2 text-xs ${toneClass}`}>
            <Icon className="h-3.5 w-3.5" />
            {label}
          </div>
          <div className="text-3xl font-semibold tabular-nums">{value}</div>
        </Link>
      </CardContent>
    </Card>
  );
}

export default async function AdminDashboardPage() {
  const res = await getAdminStats();
  if (!res.ok) throw new Error(res.error);
  const stats = res.data;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Admin</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Inbox}
          label="Leads pendientes"
          value={stats.leadsPending}
          href="/admin/leads?status=pending"
          tone={stats.leadsPending > 0 ? 'warning' : 'default'}
        />
        <StatCard
          icon={Building2}
          label="Trials activos"
          value={stats.businessesTrial}
          href="/admin/businesses?status=trial"
        />
        <StatCard
          icon={CheckCircle2}
          label="Suscripciones activas"
          value={stats.businessesActive}
          href="/admin/businesses?status=active"
          tone="success"
        />
        <StatCard
          icon={AlertTriangle}
          label="Past due"
          value={stats.businessesPastDue}
          href="/admin/businesses?status=past_due"
          tone={stats.businessesPastDue > 0 ? 'warning' : 'default'}
        />
      </div>
    </div>
  );
}
