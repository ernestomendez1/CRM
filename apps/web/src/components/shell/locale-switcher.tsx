'use client';

import { useLocale } from 'next-intl';
import { useTransition } from 'react';
import { Globe } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { setLocale } from '@/i18n/actions';
import { localeNames, locales, type Locale } from '@/i18n/config';

export function LocaleSwitcher() {
  const current = useLocale() as Locale;
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" disabled={pending} className="gap-2">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">{localeNames[current]}</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        {locales.map((l) => (
          <DropdownMenuItem
            key={l}
            onClick={() => startTransition(() => setLocale(l))}
            disabled={l === current}
          >
            {localeNames[l]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
