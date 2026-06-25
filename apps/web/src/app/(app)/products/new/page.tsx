import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { ProductForm } from '../product-form';
import { createProduct, suggestProductSku } from '../actions';

export default async function NewProductPage() {
  const t = await getTranslations('products');
  const tc = await getTranslations('common');
  const suggestedSku = await suggestProductSku();

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" render={<Link href="/products" />}>
        <ChevronLeft className="h-4 w-4" />
        {tc('back')}
      </Button>
      <h1 className="text-2xl font-semibold">{t('newProduct')}</h1>
      <ProductForm action={createProduct} defaultSku={suggestedSku ?? undefined} />
    </div>
  );
}
