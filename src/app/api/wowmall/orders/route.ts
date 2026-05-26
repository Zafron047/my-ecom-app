import type { NextRequest } from 'next/server';
import {
  createWowMallOrder,
  listWowMallOrders,
  parseWowMallOrderListQuery,
  WowMallOrderValidationError,
  type WowMallOrderPayload,
} from '@/lib/wowmall-orders';
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
    const query = parseWowMallOrderListQuery(request.nextUrl.searchParams);
    return publicSuccess(request, await listWowMallOrders(query));
  } catch (error) {
    if (error instanceof WowMallOrderValidationError) {
      return publicError(request, error.code, error.message, 400);
    }

    console.error('Failed to load WoWMall orders.', error);
    return publicError(request, 'INTERNAL_ERROR', 'Failed to load WoWMall orders.', 500);
  }
}

export async function POST(request: NextRequest) {
  const accessError = requirePublicStorefrontAccess(request);
  if (accessError) return accessError;

  try {
    const payload = (await request.json()) as WowMallOrderPayload;
    const result = await createWowMallOrder(payload);
    return publicSuccess(request, result, { status: result.created ? 201 : 200 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return publicError(request, 'VALIDATION_ERROR', 'Request body must be valid JSON.', 400);
    }
    if (error instanceof WowMallOrderValidationError) {
      return publicError(request, error.code, error.message, 400);
    }

    console.error('Failed to create WoWMall order.', error);
    return publicError(request, 'INTERNAL_ERROR', 'Failed to create WoWMall order.', 500);
  }
}
