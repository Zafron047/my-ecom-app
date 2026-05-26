import type { NextRequest } from 'next/server';
import { getPublicCategoryBySlug } from '@/lib/public-storefront-api';
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
    const category = await getPublicCategoryBySlug(slug);

    if (!category) {
      return publicError(request, 'NOT_FOUND', 'Category not found.', 404);
    }

    return publicSuccess(request, { category });
  } catch (error) {
    console.error('Failed to load WoWMall category detail.', error);
    return publicError(
      request,
      'INTERNAL_ERROR',
      'Failed to load WoWMall category detail.',
      500,
    );
  }
}
