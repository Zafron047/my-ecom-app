import type { NextRequest } from 'next/server';
import { getPublicCategories } from '@/lib/public-storefront-api';
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
    return publicSuccess(request, { categories: await getPublicCategories() });
  } catch (error) {
    console.error('Failed to load WoWMall categories.', error);
    return publicError(
      request,
      'INTERNAL_ERROR',
      'Failed to load WoWMall categories.',
      500,
    );
  }
}
