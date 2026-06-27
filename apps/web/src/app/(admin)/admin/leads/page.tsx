import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Inbox } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { listLeadsAdmin } from '@/lib/api/leads';
import { leadStatuses, type LeadStatus } from '@crm/contracts/lead';

const STATUS_LABEL: Record<LeadStatus, string> = {
  pending: 'Pendiente',
  qualifying: 'Calificando',
  approved: 'Aprobado',
  declined: 'Rechazado',
  converted: 'Convertido',
  spam: 'Spam',
};

const STATUS_TONE: Record<LeadStatus, string> = {
  pending: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100',
  qualifying: 'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100',
  approved: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100',
  declined: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  converted: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100',
  spam: 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100',
};

type SearchParams = Promise<{
  status?: string;
  q?: string;
  page?: string;
}>;

function parseStatus(raw: string | undefined): LeadStatus | undefined {
  return raw && (leadStatuses as readonly string[]).includes(raw)
    ? (raw as LeadStatus)
    : undefined;
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const status = parseStatus(params.status);
  const q = params.q?.trim() || undefined;
  const page = Math.max(1, Number(params.page ?? '1'));
  const size = 25;

  const res = await listLeadsAdmin({ status, q, page, size });
  if (!res.ok) throw new Error(res.error);
  const { rows, count } = res.data;
  const totalPages = Math.max(1, Math.ceil(count / size));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Leads</h1>
        <div className="text-sm text-muted-foreground">{count} total</div>
      </div>

      <form className="flex flex-wrap items-center gap-2">
        <Input
          name="q"
          defaultValue={q ?? ''}
          placeholder="Buscar por empresa, contacto, email, RNC"
          className="max-w-md"
        />
        <select
          name="status"
          defaultValue={status ?? ''}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">Todos los estados</option>
          {leadStatuses.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary" size="sm">
          Filtrar
        </Button>
      </form>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <Inbox className="mx-auto mb-3 h-8 w-8 opacity-50" />
          <p>No hay leads con estos filtros.</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>RNC</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Recibido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className="cursor-pointer">
                  <TableCell className="font-medium">
                    <Link
                      href={`/admin/leads/${r.id}`}
                      className="hover:underline"
                    >
                      {r.business_name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div>{r.contact_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.email}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.rnc ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_TONE[r.status]}>
                      {STATUS_LABEL[r.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(r.created_at), "d MMM yyyy 'a las' HH:mm", {
                      locale: es,
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Pager
            page={page}
            totalPages={totalPages}
            base={{ status: params.status, q: params.q }}
          />
        </div>
      )}
    </div>
  );
}

function Pager({
  page,
  totalPages,
  base,
}: {
  page: number;
  totalPages: number;
  base: { status?: string; q?: string };
}) {
  const link = (p: number) => {
    const sp = new URLSearchParams();
    if (base.status) sp.set('status', base.status);
    if (base.q) sp.set('q', base.q);
    if (p > 1) sp.set('page', String(p));
    const qs = sp.toString();
    return qs ? `/admin/leads?${qs}` : '/admin/leads';
  };
  const linkClass =
    'inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted/50';
  const disabledClass = 'pointer-events-none opacity-50';
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">
        Página {page} de {totalPages}
      </span>
      <Link
        href={link(Math.max(1, page - 1))}
        className={`${linkClass} ${page <= 1 ? disabledClass : ''}`}
        aria-disabled={page <= 1}
      >
        Anterior
      </Link>
      <Link
        href={link(Math.min(totalPages, page + 1))}
        className={`${linkClass} ${page >= totalPages ? disabledClass : ''}`}
        aria-disabled={page >= totalPages}
      >
        Siguiente
      </Link>
    </div>
  );
}
