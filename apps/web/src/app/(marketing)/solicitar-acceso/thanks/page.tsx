import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';

export default function ThanksPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-20 text-center">
      <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        Recibimos tu solicitud
      </h1>
      <p className="mt-2 text-muted-foreground">
        Te respondemos por email en las próximas 24-48 horas con los próximos
        pasos.
      </p>
      <div className="mt-6">
        <Link
          href="/"
          className="inline-flex rounded border px-4 py-2 text-sm hover:bg-muted/50"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
