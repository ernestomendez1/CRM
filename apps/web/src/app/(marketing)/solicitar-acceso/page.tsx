import { RequestAccessForm } from './request-access-form';

export default function SolicitarAccesoPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <div className="space-y-2 mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">
          Solicitar acceso
        </h1>
        <p className="text-sm text-muted-foreground">
          Cuéntanos sobre tu negocio. Te respondemos en 24-48 horas con los
          próximos pasos.
        </p>
      </div>
      <RequestAccessForm />
    </div>
  );
}
