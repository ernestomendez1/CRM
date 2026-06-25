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
import { CustomerForm } from '@/app/(app)/customers/customer-form';
import { createCustomerInline } from '@/app/(app)/customers/actions';

export type CustomerOption = {
  id: string;
  name: string;
  company_name: string | null;
};

type Props = {
  customers: CustomerOption[];
  defaultValue?: string;
  name: string;
  id?: string;
  required?: boolean;
  onCreated?: (customer: CustomerOption) => void;
};

function labelOf(c: CustomerOption) {
  return c.company_name ? `${c.name} — ${c.company_name}` : c.name;
}

export function CustomerCombobox({
  customers,
  defaultValue,
  name,
  id,
  required,
  onCreated,
}: Props) {
  const t = useTranslations('quotations');
  const tc = useTranslations('common');
  const [selectedId, setSelectedId] = useState<string | undefined>(defaultValue);
  const [popupOpen, setPopupOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const selected = customers.find((c) => c.id === selectedId) ?? null;

  return (
    <>
      <Combobox
        items={customers}
        value={selected}
        onValueChange={(c: CustomerOption | null) => setSelectedId(c?.id ?? undefined)}
        itemToStringLabel={labelOf}
        itemToStringValue={(c: CustomerOption) => c.id}
        name={name}
        required={required}
        open={popupOpen}
        onOpenChange={setPopupOpen}
      >
        <div className="relative">
          <ComboboxInput
            id={id}
            placeholder={t('fields.customerSearchPlaceholder')}
            className="pr-9"
          />
          <ComboboxTrigger />
        </div>
        <ComboboxPortal>
          <ComboboxPositioner>
            <ComboboxPopup>
              <ComboboxList>
                {(item: CustomerOption) => (
                  <ComboboxItem key={item.id} value={item}>
                    {labelOf(item)}
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
                  {t('fields.createCustomer')}
                </button>
              </div>
            </ComboboxPopup>
          </ComboboxPositioner>
        </ComboboxPortal>
      </Combobox>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('fields.createCustomer')}</DialogTitle>
          </DialogHeader>
          <CustomerForm
            action={createCustomerInline}
            onSuccess={(state) => {
              onCreated?.(state.data);
              setSelectedId(state.data.id);
              setDialogOpen(false);
              toast.success(t('customerCreated'));
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
