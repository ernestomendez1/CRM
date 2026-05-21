'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { removeLogo, uploadLogo } from '../actions';

export function LogoUploader({ logoUrl }: { logoUrl: string | null }) {
  const t = useTranslations('settings.profile');
  const tn = useTranslations('settings');
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      const res = await uploadLogo(fd);
      if (res.ok) {
        toast.success(tn('logoUploaded'));
        form.reset();
      } else {
        toast.error(res.error);
      }
    });
  }

  function onRemove() {
    startTransition(async () => {
      const res = await removeLogo();
      if (res.ok) toast.success(tn('logoRemoved'));
      else toast.error(res.error);
    });
  }

  return (
    <div className="flex flex-wrap items-start gap-4">
      <div className="flex h-24 w-40 items-center justify-center rounded-md border bg-muted/30 overflow-hidden">
        {logoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>

      <form onSubmit={onSubmit} className="space-y-2">
        <input
          type="file"
          name="logo"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="text-sm"
          required
        />
        <p className="text-xs text-muted-foreground">{t('logoHint')}</p>
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            <Upload className="h-4 w-4" />
            {t('logoUpload')}
          </Button>
          {logoUrl && (
            <Button type="button" size="sm" variant="outline" disabled={pending} onClick={onRemove}>
              <Trash2 className="h-4 w-4" />
              {t('logoRemove')}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
