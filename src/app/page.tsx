import HomePageClient from '@/components/HomePageClient';
import { getStorefrontCatalog } from '@/lib/storefront-data';
import { connection } from 'next/server';

export const revalidate = 300;

export default async function Home() {
  await connection();
  const catalog = await getStorefrontCatalog();

  return (
    <HomePageClient
      catalogProducts={catalog.products}
      catalogCategories={catalog.categories}
      heroSlides={catalog.heroSlides}
      homepageSections={catalog.homepageSections}
      categoryThumbnails={catalog.categoryThumbnails}
    />
  );
}
