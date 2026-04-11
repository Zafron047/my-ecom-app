import ProductCollectionView from '@/components/ProductCollectionView';
import { catalogCategories, catalogProducts } from '@/data/products';
import { notFound } from 'next/navigation';

const collectionConfig = {
  'super-sale': {
    title: 'Super Sale',
    description: 'Browse our best markdowns and limited-time deal picks.',
    filter: (product: (typeof catalogProducts)[number]) => product.superSale,
  },
} as const;

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const collection = collectionConfig[slug as keyof typeof collectionConfig];

  if (!collection) {
    notFound();
  }

  return (
    <ProductCollectionView
      title={collection.title}
      description={collection.description}
      products={catalogProducts.filter(collection.filter)}
      categories={catalogCategories}
    />
  );
}
