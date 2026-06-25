import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { requireBusiness } from '@/lib/auth/session';
import { getProduct } from '@/lib/api/products';
import { ProductForm } from '../../product-form';
import { updateProduct } from '../../actions';

export default async function EditProductPage(props: PageProps<'/products/[id]/edit'>) {
  const { id } = await props.params;
  await requireBusiness();
  const t = await getTranslations('products');
  const tc = await getTranslations('common');

  const res = await getProduct(id);
  if (!res.ok) {
    if (res.error.includes('not found')) notFound();
    throw new Error(res.error);
  }
  const product = res.data;
  if (product.deleted_at) notFound();

  const boundAction = updateProduct.bind(null, id);

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" render={<Link href={`/products/${id}`} />}>
        <ChevronLeft className="h-4 w-4" />
        {tc('back')}
      </Button>
      <h1 className="text-2xl font-semibold">{t('editProduct')}</h1>
      <ProductForm product={product} action={boundAction} />
    </div>
  );
}
