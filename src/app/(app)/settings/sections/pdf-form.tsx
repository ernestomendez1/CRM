'use client';

import { useActionState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { updatePdfSettings, type SettingsResult } from '../actions';

export type PdfDefaults = {
  primary_color: string;
  footer_text?: string;
  show_logo: boolean;
};

export function PdfForm({ defaults }: { defaults: PdfDefaults }) {
  const t = useTranslations('settings.pdf.fields');
  const tn = useTranslations('settings');
  const tc = useTranslations('common');
  const [state, action, pending] = useActionState<SettingsResult | null, FormData>(
    updatePdfSettings,
    null,
  );

  useEffect(() => {
    if (state?.ok) toast.success(tn('saved'));
    else if (state && !state.ok && !state.fieldErrors) toast.error(state.error);
  }, [state, tn]);

  const err = (k: string) =>
    state && !state.ok && state.fieldErrors?.[k]?.[0] ? state.fieldErrors[k][0] : null;

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2 max-w-2xl">
      <div className="space-y-1.5">
        <Label htmlFor="primary_color">{t('primaryColor')}</Label>
        <Input
          id="primary_color"
          name="primary_color"
          type="color"
          defaultValue={defaults.primary_color}
          className="h-10 w-24 p-1"
        />
        {err('primary_color') && <p className="text-xs text-red-600">{err('primary_color')}</p>}
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="footer_text">{t('footerText')}</Label>
        <Textarea
          id="footer_text"
          name="footer_text"
          rows={2}
          defaultValue={defaults.footer_text ?? ''}
        />
      </div>
      <div className="flex items-center gap-2 sm:col-span-2">
        <Checkbox id="show_logo" name="show_logo" defaultChecked={defaults.show_logo} />
        <Label htmlFor="show_logo" className="cursor-pointer">
          {t('showLogo')}
        </Label>
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? '…' : tc('save')}
        </Button>
      </div>
    </form>
  );
}
