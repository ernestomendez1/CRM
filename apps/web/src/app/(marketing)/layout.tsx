import Link from 'next/link';

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold">
            Cuadra
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link
              href="/login"
              className="rounded px-3 py-1.5 text-muted-foreground hover:text-foreground"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/solicitar-acceso"
              className="rounded bg-foreground px-3 py-1.5 text-background hover:bg-foreground/90"
            >
              Solicitar acceso
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t bg-muted/30">
        <div className="mx-auto max-w-5xl px-6 py-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Cuadra. Hecho en República Dominicana.
        </div>
      </footer>
    </div>
  );
}
