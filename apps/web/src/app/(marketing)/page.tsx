import Link from 'next/link';
import { ArrowRight, FileText, Receipt, Sparkles } from 'lucide-react';

const benefits = [
  {
    icon: FileText,
    title: 'Facturación y cotizaciones',
    description:
      'Emite facturas y cotizaciones en segundos. Convierte cotizaciones aceptadas a facturas con un clic.',
  },
  {
    icon: Receipt,
    title: 'Gastos con AI',
    description:
      'Toma una foto del recibo. El sistema extrae proveedor, monto, fecha y NCF automáticamente.',
  },
  {
    icon: Sparkles,
    title: 'Asistente conversacional',
    description:
      '"Crear cliente Juan Pérez con cédula X" — el asistente entiende lo que pides y lo prepara para tu revisión.',
  },
];

export default function LandingPage() {
  return (
    <div className="mx-auto max-w-5xl px-6">
      <section className="py-20 sm:py-28">
        <div className="space-y-6 max-w-3xl">
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
            La herramienta de facturación para PyMEs dominicanas
          </h1>
          <p className="text-lg text-muted-foreground">
            Cuadra reúne facturación, cotizaciones, cuentas por cobrar y control de gastos en una
            sola plataforma. Diseñada para el negocio dominicano: ITBIS, NCF, RNC, multimoneda.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href="/solicitar-acceso"
              className="inline-flex items-center gap-2 rounded bg-foreground px-5 py-2.5 text-background hover:bg-foreground/90"
            >
              Solicitar acceso
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="rounded border px-5 py-2.5 hover:bg-muted/50"
            >
              Ya tengo cuenta
            </Link>
          </div>
          <p className="text-xs text-muted-foreground pt-2">
            Aceptamos un número limitado de negocios cada trimestre. Te respondemos en 24-48 horas.
          </p>
        </div>
      </section>

      <section className="py-16 border-t">
        <div className="grid gap-8 sm:grid-cols-3">
          {benefits.map((b) => (
            <div key={b.title} className="space-y-2">
              <b.icon className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold">{b.title}</h3>
              <p className="text-sm text-muted-foreground">{b.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-16 border-t">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-semibold mb-3">¿Cómo funciona?</h2>
          <ol className="space-y-3 text-sm text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">1. Solicitas acceso.</span> Cuéntanos
              sobre tu negocio.
            </li>
            <li>
              <span className="font-medium text-foreground">2. Conversamos 30 minutos.</span> Te
              mostramos la plataforma y resolvemos dudas.
            </li>
            <li>
              <span className="font-medium text-foreground">3. Activamos tu trial.</span> 30 días
              con todas las funciones para que pruebes con tus datos reales.
            </li>
            <li>
              <span className="font-medium text-foreground">4. Si te queda bien</span>, contratas
              mensualmente sin amarres a largo plazo.
            </li>
          </ol>
          <div className="pt-6">
            <Link
              href="/solicitar-acceso"
              className="inline-flex items-center gap-2 rounded bg-foreground px-5 py-2.5 text-background hover:bg-foreground/90"
            >
              Solicitar acceso
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
