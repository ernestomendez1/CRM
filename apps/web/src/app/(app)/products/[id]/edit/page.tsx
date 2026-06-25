import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { requireBusiness } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import type { Product } from '@/lib/validation/product';
import { ProductForm } from '../../product-form';
import { updateProduct } from '../../actions';

export default async function EditProductPage(props: PageProps<'/products/[id]/edit'>) {
  const { id } = await props.params;
  const ctx = await requireBusiness();
  const supabase = await createClient();
  const t = await getTranslations('products');
  const tc = await getTranslations('common');

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .eq('business_id', ctx.businessId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) notFound();
  const product = data as unknown as Product;

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
