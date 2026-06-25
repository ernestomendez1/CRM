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
import type { ProductActionResult } from './actions';
import type { Product } from '@crm/contracts/product';
import { productTypes } from '@crm/contracts/product';

type Props = {
  product?: Product;
  action: (
    prev: ProductActionResult | null,
    formData: FormData,
  ) => Promise<ProductActionResult>;
};

export function ProductForm({ product, action }: Props) {
  const t = useTranslations('products');
  const tc = useTranslations('common');
  const [state, formAction, pending] = useActionState<ProductActionResult | null, FormData>(
    action,
    null,
  );

  const err = (key: string) =>
    state && !state.ok && state.fieldErrors?.[key]?.[0] ? state.fieldErrors[key][0] : null;

  return (
    <form action={formAction} className="space-y-6 max-w-2xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="name">{t('fields.name')} *</Label>
          <Input
            id="name"
            name="name"
            required
            defaultValue={product?.name ?? ''}
            aria-invalid={!!err('name')}
          />
          {err('name') && <p className="text-xs text-red-600">{err('name')}</p>}
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="description">{t('fields.description')}</Label>
          <Textarea
            id="description"
            name="description"
            rows={3}
            defaultValue={product?.description ?? ''}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="type">{t('fields.type')}</Label>
          <Select name="type" defaultValue={product?.type ?? 'service'}>
            <SelectTrigger id="type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {productTypes.map((tt) => (
                <SelectItem key={tt} value={tt}>
                  {t(`types.${tt}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sku">{t('fields.sku')}</Label>
          <Input id="sku" name="sku" defaultValue={product?.sku ?? ''} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="unit_price">{t('fields.unitPrice')} *</Label>
          <Input
            id="unit_price"
            name="unit_price"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            required
            defaultValue={product?.unit_price ?? 0}
            aria-invalid={!!err('unit_price')}
          />
          {err('unit_price') && <p className="text-xs text-red-600">{err('unit_price')}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tax_rate_override">{t('fields.taxRateOverride')}</Label>
          <Input
            id="tax_rate_override"
            name="tax_rate_override"
            type="number"
            inputMode="decimal"
            step="0.0001"
            min="0"
            max="1"
            placeholder="e.g. 0.18"
            defaultValue={product?.tax_rate_override ?? ''}
          />
          <p className="text-xs text-muted-foreground">{t('fields.taxRateOverrideHelp')}</p>
        </div>

        <div className="flex items-center gap-2 sm:col-span-2">
          <Checkbox
            id="is_taxable"
            name="is_taxable"
            defaultChecked={product?.is_taxable ?? true}
          />
          <Label htmlFor="is_taxable" className="cursor-pointer">
            {t('fields.isTaxable')}
          </Label>
        </div>

        <div className="flex items-center gap-2 sm:col-span-2">
          <Checkbox
            id="is_active"
            name="is_active"
            defaultChecked={product?.is_active ?? true}
          />
          <Label htmlFor="is_active" className="cursor-pointer">
            {t('fields.isActive')}
          </Label>
        </div>
      </div>

      {state && !state.ok && !state.fieldErrors && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? '…' : tc('save')}
      </Button>
    </form>
  );
}
