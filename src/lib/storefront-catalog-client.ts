import type {
  StorefrontCatalogProduct,
  StorefrontHomepageSection,
} from '@/lib/storefront-types';

export type StorefrontCatalogClientPayload = {
  categories?: string[];
  categoryThumbnails?: Record<string, string>;
  homepageSections?: StorefrontHomepageSection[];
  products?: Array<
    StorefrontCatalogProduct & {
      variantCount?: number;
    }
  >;
};

let catalogPromise: Promise<StorefrontCatalogClientPayload> | null = null;

export function fetchStorefrontCatalogClient() {
  catalogPromise ??= fetch('/api/storefront/catalog').then(
    async (response) => {
      if (!response.ok) {
        catalogPromise = null;
        throw new Error(`Catalog request failed with HTTP ${response.status}`);
      }
      return (await response.json()) as StorefrontCatalogClientPayload;
    },
  );

  return catalogPromise;
}
