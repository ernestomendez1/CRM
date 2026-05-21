'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  LayoutDashboard,
  Users,
  Package,
  FileText,
  ReceiptText,
  Wallet,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  { href: '/dashboard', key: 'dashboard', icon: LayoutDashboard },
  { href: '/customers', key: 'customers', icon: Users },
  { href: '/products', key: 'products', icon: Package },
  { href: '/quotations', key: 'quotations', icon: FileText },
  { href: '/invoices', key: 'invoices', icon: ReceiptText },
  { href: '/expenses', key: 'expenses', icon: Wallet },
  { href: '/settings', key: 'settings', icon: Settings },
] as const;

export function SidebarNav() {
  const pathname = usePathname();
  const t = useTranslations('nav');

  return (
    <nav className="flex flex-col gap-1 p-2">
      {items.map(({ href, key, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{t(key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
