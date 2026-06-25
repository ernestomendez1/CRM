'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxList,
  ComboboxItem,
  ComboboxPopup,
  ComboboxPortal,
  ComboboxPositioner,
  ComboboxTrigger,
} from '@/components/ui/combobox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ProductForm } from '@/app/(app)/products/product-form';
import { createProductInline } from '@/app/(app)/products/actions';

export type ProductOption = {
  id: string;
  name: string;
  unit_price: number;
  is_taxable: boolean;
  tax_rate_override: number | null;
};

type Props = {
  products: ProductOption[];
  value: string | undefined;
  onChange: (productId: string) => void;
  onCreated?: (product: ProductOption) => void;
};

export function ProductCombobox({ products, value, onChange, onCreated }: Props) {
  const t = useTranslations('quotations.lineItems');
  const tc = useTranslations('common');
  const [popupOpen, setPopupOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const selected = products.find((p) => p.id === value) ?? null;

  return (
    <>
      <Combobox
        items={products}
        value={selected}
        onValueChange={(p: ProductOption | null) => {
          if (p) onChange(p.id);
        }}
        itemToStringLabel={(p: ProductOption) => p.name}
        itemToStringValue={(p: ProductOption) => p.id}
        open={popupOpen}
        onOpenChange={setPopupOpen}
      >
        <div className="relative">
          <ComboboxInput
            placeholder={t('productSearchPlaceholder')}
            className="pr-9"
          />
          <ComboboxTrigger />
        </div>
        <ComboboxPortal>
          <ComboboxPositioner>
            <ComboboxPopup>
              <ComboboxList>
                {(item: ProductOption) => (
                  <ComboboxItem key={item.id} value={item}>
                    {item.name}
                  </ComboboxItem>
                )}
              </ComboboxList>
              <ComboboxEmpty>{tc('noResults')}</ComboboxEmpty>
              <div className="border-t p-1">
                <button
                  type="button"
                  onClick={() => {
                    setPopupOpen(false);
                    setDialogOpen(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm font-medium text-primary hover:bg-accent"
                >
                  <Plus className="h-4 w-4" />
                  {t('createProduct')}
                </button>
              </div>
            </ComboboxPopup>
          </ComboboxPositioner>
        </ComboboxPortal>
      </Combobox>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('createProduct')}</DialogTitle>
          </DialogHeader>
          <ProductForm
            action={createProductInline}
            onSuccess={(state) => {
              onCreated?.(state.data);
              onChange(state.data.id);
              setDialogOpen(false);
              toast.success(t('productCreated'));
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
