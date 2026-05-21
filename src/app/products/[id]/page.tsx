import ProductDetailClient from '@/components/ProductDetailClient';
import {
  getCatalogCards,
  getProductDetail,
} from '@/lib/storefront-data';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';

export const revalidate = 300;

export default async function ProductDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  const product = await getProductDetail(id);

  if (!product) {
    notFound();
  }

  const seenRelatedProductIds = new Set<string>();
  const relatedProducts = (await getCatalogCards())
    .filter((catalogProduct) => {
      if (catalogProduct.id === product.id || seenRelatedProductIds.has(catalogProduct.id)) {
        return false;
      }
      seenRelatedProductIds.add(catalogProduct.id);
      return true;
    })
    .slice(0, 4);

  return (
    <ProductDetailClient
      product={product}
      relatedProducts={relatedProducts}
    />
  );
}
