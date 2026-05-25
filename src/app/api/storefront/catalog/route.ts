import { NextResponse } from 'next/server';
import {
  PRIVATE_NO_STORE_HEADERS,
  PUBLIC_STOREFRONT_CACHE_HEADERS,
} from '@/lib/http-cache';
import { getStorefrontCatalog } from '@/lib/storefront-data';

const shouldBypassCatalogCache =
  process.env.NEXT_DISABLE_STOREFRONT_CACHE === 'true';

function catalogHeaders() {
  return {
    ...(shouldBypassCatalogCache
      ? PRIVATE_NO_STORE_HEADERS
      : PUBLIC_STOREFRONT_CACHE_HEADERS),
    'X-Catalog-Cache': shouldBypassCatalogCache ? 'BYPASS' : 'NEXT',
  };
}

export async function GET() {
  try {
    return NextResponse.json(await getStorefrontCatalog(), {
      headers: catalogHeaders(),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Failed to load storefront catalog.' },
      { status: 500, headers: PUBLIC_STOREFRONT_CACHE_HEADERS },
    );
  }
}
