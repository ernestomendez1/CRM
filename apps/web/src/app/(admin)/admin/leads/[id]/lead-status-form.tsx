'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { LeadStatus } from '@crm/contracts/lead';
import { updateLeadStatusAction, type UpdateLeadResult } from './actions';

const TRIAGE_OPTIONS: { value: 'qualifying' | 'declined' | 'spam' | 'pending'; label: string; tone: string }[] = [
  { value: 'qualifying', label: 'Marcar calificando', tone: 'bg-blue-600 hover:bg-blue-700 text-white' },
  { value: 'declined', label: 'Rechazar', tone: 'bg-zinc-600 hover:bg-zinc-700 text-white' },
  { value: 'spam', label: 'Marcar spam', tone: 'bg-red-600 hover:bg-red-700 text-white' },
  { value: 'pending', label: 'Volver a pendiente', tone: 'border bg-transparent' },
];

export function LeadStatusForm({
  leadId,
  currentStatus,
  currentNotes,
}: {
  leadId: string;
  currentStatus: LeadStatus;
  currentNotes: string | null;
}) {
  const [state, action, pending] = useActionState<
    UpdateLeadResult | null,
    FormData
  >(updateLeadStatusAction, null);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="lead_id" value={leadId} />
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notas internas (opcional)</Label>
        <Textarea
          id="notes"
          name="notes"
          defaultValue={currentNotes ?? ''}
          rows={3}
          maxLength={2000}
          placeholder="Contexto del triaje, próximos pasos, dudas…"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {TRIAGE_OPTIONS.filter((o) => o.value !== currentStatus).map((o) => (
          <Button
            key={o.value}
            type="submit"
            name="status"
            value={o.value}
            disabled={pending}
            className={o.tone}
          >
            {o.label}
          </Button>
        ))}
      </div>

      {state && !state.ok && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      {state?.ok && (
        <p className="text-sm text-emerald-600">Estado actualizado.</p>
      )}
    </form>
  );
}
