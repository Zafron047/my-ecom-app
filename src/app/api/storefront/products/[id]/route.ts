import { NextResponse } from 'next/server';
import { PUBLIC_STOREFRONT_CACHE_HEADERS } from '@/lib/http-cache';
import { getStorefrontProductDetailById } from '@/lib/storefront-data';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const product = await getStorefrontProductDetailById(id);

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found.' },
        { status: 404, headers: PUBLIC_STOREFRONT_CACHE_HEADERS },
      );
    }

    return NextResponse.json(product, {
      headers: PUBLIC_STOREFRONT_CACHE_HEADERS,
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to load product details.' },
      { status: 500, headers: PUBLIC_STOREFRONT_CACHE_HEADERS },
    );
  }
}
