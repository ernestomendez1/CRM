'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CustomerActionResult } from './actions';
import type { Customer } from '@crm/contracts/customer';
import { taxIdTypes } from '@crm/contracts/customer';

type Props = {
  customer?: Customer;
  action: (
    prev: CustomerActionResult | null,
    formData: FormData,
  ) => Promise<CustomerActionResult>;
};

export function CustomerForm({ customer, action }: Props) {
  const t = useTranslations('customers');
  const tc = useTranslations('common');
  const [state, formAction, pending] = useActionState<CustomerActionResult | null, FormData>(
    action,
    null,
  );

  const err = (key: string) =>
    state && !state.ok && state.fieldErrors?.[key]?.[0]
      ? state.fieldErrors[key][0]
      : null;

  return (
    <form action={formAction} className="space-y-6 max-w-2xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="name">{t('fields.name')} *</Label>
          <Input
            id="name"
            name="name"
            required
            defaultValue={customer?.name ?? ''}
            aria-invalid={!!err('name')}
          />
          {err('name') && <p className="text-xs text-red-600">{err('name')}</p>}
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="company_name">{t('fields.companyName')}</Label>
          <Input
            id="company_name"
            name="company_name"
            defaultValue={customer?.company_name ?? ''}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tax_id_type">{t('fields.taxIdType')}</Label>
          <Select name="tax_id_type" defaultValue={customer?.tax_id_type ?? undefined}>
            <SelectTrigger id="tax_id_type" className="w-full">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {taxIdTypes.map((tt) => (
                <SelectItem key={tt} value={tt}>
                  {t(`taxIdTypes.${tt}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tax_id">{t('fields.taxId')}</Label>
          <Input id="tax_id" name="tax_id" defaultValue={customer?.tax_id ?? ''} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">{t('fields.email')}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={customer?.email ?? ''}
            aria-invalid={!!err('email')}
          />
          {err('email') && <p className="text-xs text-red-600">{err('email')}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone">{t('fields.phone')}</Label>
          <Input id="phone" name="phone" defaultValue={customer?.phone ?? ''} />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="address">{t('fields.address')}</Label>
          <Input id="address" name="address" defaultValue={customer?.address ?? ''} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="city">{t('fields.city')}</Label>
          <Input id="city" name="city" defaultValue={customer?.city ?? ''} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="country">{t('fields.country')}</Label>
          <Input
            id="country"
            name="country"
            defaultValue={customer?.country ?? 'DO'}
            maxLength={2}
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="notes">{t('fields.notes')}</Label>
          <Textarea id="notes" name="notes" rows={3} defaultValue={customer?.notes ?? ''} />
        </div>

        <div className="flex items-center gap-2 sm:col-span-2">
          <Checkbox
            id="is_active"
            name="is_active"
            defaultChecked={customer?.is_active ?? true}
          />
          <Label htmlFor="is_active" className="cursor-pointer">
            {t('fields.isActive')}
          </Label>
        </div>
      </div>

      {state && !state.ok && !state.fieldErrors && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? '…' : tc('save')}
        </Button>
      </div>
    </form>
  );
}
