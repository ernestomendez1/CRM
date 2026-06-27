import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { getLeadAdmin } from '@/lib/api/leads';
import { type LeadStatus } from '@crm/contracts/lead';
import { LeadStatusForm } from './lead-status-form';

const STATUS_LABEL: Record<LeadStatus, string> = {
  pending: 'Pendiente',
  qualifying: 'Calificando',
  approved: 'Aprobado',
  declined: 'Rechazado',
  converted: 'Convertido',
  spam: 'Spam',
};

function Field({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm">{value && value.trim() ? value : '—'}</div>
    </div>
  );
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const res = await getLeadAdmin(id);
  if (!res.ok) throw new Error(res.error);
  const lead = res.data;

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center gap-2">
        <Link
          href="/admin/leads"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Leads
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{lead.businessName}</h1>
          <p className="text-sm text-muted-foreground">
            Recibido{' '}
            {format(new Date(lead.createdAt), "d 'de' MMMM yyyy 'a las' HH:mm", {
              locale: es,
            })}
          </p>
        </div>
        <Badge>{STATUS_LABEL[lead.status]}</Badge>
      </div>

      <Card>
        <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Contacto" value={lead.contactName} />
          <Field label="Email" value={lead.email} />
          <Field label="Teléfono" value={lead.phone} />
          <Field label="RNC" value={lead.rnc} />
          <Field label="Empleados" value={lead.employeesBand} />
          <Field label="Herramienta actual" value={lead.currentTool} />
          <div className="sm:col-span-2">
            <Field label="¿Por qué le interesa?" value={lead.interestNote} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Metadata
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <Field
              label="Turnstile"
              value={lead.turnstileOk ? 'OK' : 'Sin verificar'}
            />
            <Field label="IP" value={lead.sourceIp} />
            <div className="sm:col-span-2">
              <Field label="User agent" value={lead.userAgent} />
            </div>
            {lead.reviewedAt && (
              <Field
                label="Revisado"
                value={format(
                  new Date(lead.reviewedAt),
                  "d MMM yyyy 'a las' HH:mm",
                  { locale: es },
                )}
              />
            )}
            {lead.reviewNotes && (
              <div className="sm:col-span-2">
                <Field label="Notas internas" value={lead.reviewNotes} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {lead.status !== 'converted' && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <div>
              <h2 className="font-semibold">Triaje</h2>
              <p className="text-sm text-muted-foreground">
                Marca el siguiente estado. La aprobación final (creación del
                trial) se hará desde una acción dedicada.
              </p>
            </div>
            <LeadStatusForm
              leadId={lead.id}
              currentStatus={lead.status}
              currentNotes={lead.reviewNotes}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
