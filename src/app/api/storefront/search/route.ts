import { PUBLIC_STOREFRONT_CACHE_HEADERS } from '@/lib/http-cache';
import { getHeaderSearchProducts } from '@/lib/storefront-data';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    return NextResponse.json(
      { products: await getHeaderSearchProducts() },
      { headers: PUBLIC_STOREFRONT_CACHE_HEADERS },
    );
  } catch {
    return NextResponse.json(
      { error: 'Failed to load storefront search data.' },
      { status: 500, headers: PUBLIC_STOREFRONT_CACHE_HEADERS },
    );
  }
}
