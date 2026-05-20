import ProductDetailClient from '@/components/ProductDetailClient';
import {
  getCatalogCards,
  getProductDetail,
} from '@/lib/storefront-data';
import { notFound } from 'next/navigation';

export const revalidate = 300;

export default async function ProductDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProductDetail(id);

  if (!product) {
    notFound();
  }

  const relatedProducts = (await getCatalogCards())
    .filter((catalogProduct) => catalogProduct.id !== product.id)
    .slice(0, 4);

  return (
    <ProductDetailClient
      product={product}
      relatedProducts={relatedProducts}
    />
  );
}
