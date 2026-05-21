import ProductsPageClient from '@/components/ProductsPageClient';
import { getStorefrontCatalog } from '@/lib/storefront-data';
import { connection } from 'next/server';

export const revalidate = 300;

export default async function Products() {
  await connection();
  const catalog = await getStorefrontCatalog();

  return (
    <ProductsPageClient
      products={catalog.products}
      categories={catalog.categories}
    />
  );
}
