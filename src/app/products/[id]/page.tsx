import ProductDetailClient from '@/components/ProductDetailClient';
import {
  getCatalogCards,
  getProductDetail,
} from '@/lib/storefront-data';
import { notFound } from 'next/navigation';

export const revalidate = 300;
export const dynamic = 'force-dynamic';

export async function generateStaticParams() {
  const products = await getCatalogCards();

  return products.map((product) => ({
    id: product.id,
  }));
}

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
