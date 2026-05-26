import type { NextRequest } from 'next/server';
import { getPublicProductBySlug } from '@/lib/public-storefront-api';
import {
  publicError,
  publicOptionsResponse,
  publicSuccess,
  requirePublicStorefrontAccess,
} from '@/lib/public-api-route';

export async function OPTIONS(request: NextRequest) {
  return publicOptionsResponse(request);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const accessError = requirePublicStorefrontAccess(request);
  if (accessError) return accessError;

  try {
    const { slug } = await params;
    const product = await getPublicProductBySlug(slug);

    if (!product) {
      return publicError(request, 'NOT_FOUND', 'Product not found.', 404);
    }

    return publicSuccess(request, { product });
  } catch (error) {
    console.error('Failed to load WoWMall product detail.', error);
    return publicError(
      request,
      'INTERNAL_ERROR',
      'Failed to load WoWMall product detail.',
      500,
    );
  }
}
