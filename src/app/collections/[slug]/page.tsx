import ProductCollectionView from '@/components/ProductCollectionView';
import { slugifyCategory } from '@/lib/category-slug';
import { getStorefrontCatalog } from '@/lib/storefront-data';
import type { StorefrontCatalogProduct } from '@/lib/storefront-types';
import { notFound } from 'next/navigation';

const collectionConfig = {
  'super-sale': {
    title: 'Super Sale',
    description: 'Browse our best markdowns and limited-time deal picks.',
    filter: (product: StorefrontCatalogProduct) => product.superSale,
  },
} as const;

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const collection = collectionConfig[slug as keyof typeof collectionConfig];
  const catalog = await getStorefrontCatalog();

  const categoryName = catalog.categories.find(
    (category) => category !== 'All' && slugifyCategory(category) === slug,
  );

  if (!collection && !categoryName) {
    notFound();
  }

  if (categoryName) {
    const products = catalog.products.filter(
      (product) => product.category === categoryName,
    );

    return (
      <ProductCollectionView
        title={categoryName}
        description={`Browse products from ${categoryName}.`}
        products={products}
        categories={catalog.categories}
        initialCategory={categoryName}
      />
    );
  }

  if (!collection) {
    notFound();
  }

  return (
    <ProductCollectionView
      title={collection.title}
      description={collection.description}
      products={catalog.products.filter(collection.filter)}
      categories={catalog.categories}
    />
  );
}
