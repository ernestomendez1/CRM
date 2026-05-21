import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireBusiness } from '@/lib/auth/session';
import { SidebarNav } from '@/components/shell/sidebar-nav';
import { LocaleSwitcher } from '@/components/shell/locale-switcher';
import { UserMenu } from '@/components/shell/user-menu';
import { MobileNav } from '@/components/shell/mobile-nav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireBusiness();
  const t = await getTranslations('common');

  return (
    <div className="flex min-h-screen w-full">
      <aside className="hidden md:flex md:w-64 md:flex-col border-r bg-card">
        <div className="px-4 py-4 border-b">
          <Link href="/dashboard" className="font-semibold text-lg">
            {t('appName')}
          </Link>
        </div>
        <SidebarNav />
      </aside>

      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex items-center justify-between border-b px-4 py-3 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <MobileNav />
            <Link href="/dashboard" className="md:hidden font-semibold">
              {t('appName')}
            </Link>
          </div>
          <div className="flex items-center gap-1">
            <LocaleSwitcher />
            <UserMenu email={ctx.email} />
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
