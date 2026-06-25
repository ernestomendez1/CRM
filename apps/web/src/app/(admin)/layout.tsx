import Link from 'next/link';
import { ChevronLeft, LayoutDashboard, Inbox, Building2 } from 'lucide-react';
import { requireStaff } from '@/lib/auth/session';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await requireStaff();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-muted/30">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="font-semibold text-sm">
              CRM · Admin
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link
                href="/admin"
                className="flex items-center gap-1.5 rounded px-3 py-1.5 hover:bg-muted"
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
              <Link
                href="/admin/leads"
                className="flex items-center gap-1.5 rounded px-3 py-1.5 hover:bg-muted"
              >
                <Inbox className="h-4 w-4" />
                Leads
              </Link>
              <Link
                href="/admin/businesses"
                className="flex items-center gap-1.5 rounded px-3 py-1.5 hover:bg-muted"
              >
                <Building2 className="h-4 w-4" />
                Businesses
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">{staff.email}</span>
            <Link
              href="/dashboard"
              className="flex items-center gap-1 rounded px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Volver al app
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-6">{children}</main>
    </div>
  );
}
