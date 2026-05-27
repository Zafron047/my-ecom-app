import ProductsPageClient from '@/components/ProductsPageClient';
import { getStorefrontCatalog } from '@/lib/storefront-data';

export const revalidate = 300;
export const dynamic = 'force-dynamic';

export default async function Products() {
  const catalog = await getStorefrontCatalog();

  return (
    <ProductsPageClient
      products={catalog.products}
      categories={catalog.categories}
    />
  );
}
