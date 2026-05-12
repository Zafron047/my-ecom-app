import { NextResponse } from 'next/server';
import { getStorefrontCatalog } from '@/lib/storefront-data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CATALOG_CACHE_TTL_MS = 5 * 60_000;
type CatalogCacheEntry = {
  expiresAt: number;
  payload: Awaited<ReturnType<typeof getStorefrontCatalog>>;
};

const globalForCatalogCache = globalThis as unknown as {
  storefrontCatalogCache?: CatalogCacheEntry | null;
  storefrontCatalogPromise?: Promise<CatalogCacheEntry> | null;
};

function catalogHeaders(cacheState: 'HIT' | 'MISS') {
  return {
    'Cache-Control': 'private, max-age=300',
    'X-Catalog-Cache': cacheState,
  };
}

export async function GET() {
  try {
    const now = Date.now();
    const cached = globalForCatalogCache.storefrontCatalogCache;
    if (cached && cached.expiresAt > now) {
      return NextResponse.json(cached.payload, {
        headers: catalogHeaders('HIT'),
      });
    }

    globalForCatalogCache.storefrontCatalogPromise ??= getStorefrontCatalog().then(
      (catalog) => ({
        expiresAt: Date.now() + CATALOG_CACHE_TTL_MS,
        payload: catalog,
      }),
    );
    const nextCache = await globalForCatalogCache.storefrontCatalogPromise;
    globalForCatalogCache.storefrontCatalogCache = nextCache;
    globalForCatalogCache.storefrontCatalogPromise = null;

    return NextResponse.json(nextCache.payload, {
      headers: catalogHeaders('MISS'),
    });
  } catch {
    globalForCatalogCache.storefrontCatalogPromise = null;
    return NextResponse.json(
      { error: 'Failed to load storefront catalog.' },
      { status: 500 },
    );
  }
}
