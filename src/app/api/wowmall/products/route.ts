import type { NextRequest } from 'next/server';
import {
  getPublicProducts,
  parseProductListQuery,
  PublicStorefrontValidationError,
} from '@/lib/public-storefront-api';
import {
  publicError,
  publicOptionsResponse,
  publicSuccess,
  requirePublicStorefrontAccess,
} from '@/lib/public-api-route';

export async function OPTIONS(request: NextRequest) {
  return publicOptionsResponse(request);
}

export async function GET(request: NextRequest) {
  const accessError = requirePublicStorefrontAccess(request);
  if (accessError) return accessError;

  try {
    const query = parseProductListQuery(request.nextUrl.searchParams);
    return publicSuccess(request, await getPublicProducts(query));
  } catch (error) {
    if (error instanceof PublicStorefrontValidationError) {
      return publicError(request, error.code, error.message, 400);
    }

    console.error('Failed to load WoWMall products.', error);
    return publicError(request, 'INTERNAL_ERROR', 'Failed to load WoWMall products.', 500);
  }
}
