'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { employeesBands } from '@crm/contracts/lead';
import { submitLeadAction, type SubmitLeadResult } from './actions';

function Field({
  label,
  children,
  hint,
  error,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function RequestAccessForm() {
  const [state, action, pending] = useActionState<
    SubmitLeadResult | null,
    FormData
  >(submitLeadAction, null);

  const fieldErr = (key: string) =>
    state && !state.ok ? state.fieldErrors?.[key]?.[0] : undefined;

  return (
    <form action={action} className="space-y-5">
      <Field label="Nombre de tu empresa" error={fieldErr('business_name')}>
        <Input name="business_name" required maxLength={200} autoFocus />
      </Field>

      <Field label="Tu nombre" error={fieldErr('contact_name')}>
        <Input name="contact_name" required maxLength={200} />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Email" error={fieldErr('email')}>
          <Input name="email" type="email" required maxLength={200} />
        </Field>
        <Field label="Teléfono" hint="Opcional" error={fieldErr('phone')}>
          <Input name="phone" type="tel" maxLength={40} />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="RNC" hint="Opcional" error={fieldErr('rnc')}>
          <Input name="rnc" maxLength={40} />
        </Field>
        <Field label="Número de empleados" error={fieldErr('employees_band')}>
          <Select name="employees_band">
            <SelectTrigger>
              <SelectValue placeholder="Selecciona" />
            </SelectTrigger>
            <SelectContent>
              {employeesBands.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field
        label="¿Qué usas hoy para facturar?"
        hint="Opcional — ej. Excel, otro software, hago las facturas a mano"
        error={fieldErr('current_tool')}
      >
        <Input name="current_tool" maxLength={200} />
      </Field>

      <Field
        label="¿Por qué te interesa Cuadra?"
        hint="Opcional — cuéntanos qué buscas resolver"
        error={fieldErr('interest_note')}
      >
        <Textarea name="interest_note" rows={4} maxLength={2000} />
      </Field>

      {state && !state.ok && state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <div className="pt-2">
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? 'Enviando…' : 'Solicitar acceso'}
        </Button>
        <p className="text-xs text-muted-foreground mt-2">
          Al enviar este formulario aceptas que nos pongamos en contacto contigo
          para conversar sobre Cuadra.
        </p>
      </div>
    </form>
  );
}
