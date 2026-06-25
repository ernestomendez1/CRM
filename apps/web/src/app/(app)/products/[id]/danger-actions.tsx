'use client';

import { useTransition } from 'react';
import { Trash2, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { deactivateProduct, reactivateProduct } from '../actions';

export function ProductDangerActions({
  id,
  isActive,
  isDeleted,
}: {
  id: string;
  isActive: boolean;
  isDeleted: boolean;
}) {
  const t = useTranslations('products');
  const [pending, startTransition] = useTransition();

  if (isDeleted || !isActive) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            try {
              await reactivateProduct(id);
              toast.success(t('delete.restoreSuccess'));
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Error');
            }
          })
        }
      >
        <RotateCcw className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(t('delete.confirm'))) return;
        startTransition(async () => {
          try {
            await deactivateProduct(id);
            toast.success(t('delete.success'));
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Error');
          }
        });
      }}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
