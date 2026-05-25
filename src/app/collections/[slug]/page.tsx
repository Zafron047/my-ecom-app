import ProductCollectionView from '@/components/ProductCollectionView';
import { slugifyCategory } from '@/lib/category-slug';
import { getStorefrontCatalog } from '@/lib/storefront-data';
import type { StorefrontCatalogProduct } from '@/lib/storefront-types';
import { notFound } from 'next/navigation';

export const revalidate = 300;

const collectionConfig = {
  'super-sale': {
    title: 'Super Sale',
    description: 'Featured deals for everyday use.',
    filter: (product: StorefrontCatalogProduct) => product.superSale,
  },
} as const;

export async function generateStaticParams() {
  const catalog = await getStorefrontCatalog();
  const categorySlugs = catalog.categories
    .filter((category) => category !== 'All')
    .map((category) => slugifyCategory(category))
    .filter(Boolean);

  return [
    ...Object.keys(collectionConfig),
    ...categorySlugs,
  ].map((slug) => ({ slug }));
}

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
    return (
      <ProductCollectionView
        title={categoryName}
        description="Selected essentials for everyday use."
        products={catalog.products}
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
