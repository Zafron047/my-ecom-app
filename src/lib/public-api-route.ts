import { NextResponse, type NextRequest } from 'next/server';
import { PRIVATE_NO_STORE_HEADERS } from '@/lib/http-cache';
import type { PublicApiError, PublicApiSuccess } from '@/lib/public-storefront-types';

const wowmallKeyHeader = 'x-wowmall-api-key';

export function getPublicStorefrontAccessModel() {
  return 'wowmall-api-key';
}

function allowedOrigins() {
  return new Set(
    (
      process.env.WOWMALL_ALLOWED_ORIGINS ||
      ''
    )
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

function isLocalhostOrigin(origin: string) {
  try {
    const parsed = new URL(origin);
    return ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
  } catch {
    return false;
  }
}

function isOriginAllowed(origin: string | null) {
  if (!origin) return false;
  if (allowedOrigins().has(origin)) return true;
  return process.env.NODE_ENV !== 'production' && isLocalhostOrigin(origin);
}

export function publicCorsHeaders(request: NextRequest | Request) {
  const headers = new Headers();
  const origin = request.headers.get('origin');

  if (isOriginAllowed(origin)) {
    headers.set('Access-Control-Allow-Origin', origin!);
    headers.set('Vary', 'Origin');
  }

  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, X-WoWMall-Api-Key',
  );
  headers.set('Access-Control-Max-Age', '86400');

  return headers;
}

function responseHeaders(request: NextRequest | Request) {
  const headers = publicCorsHeaders(request);

  for (const [key, value] of Object.entries(PRIVATE_NO_STORE_HEADERS)) {
    headers.set(key, value);
  }

  headers.set('X-WoWMall-Access', getPublicStorefrontAccessModel());

  return headers;
}

export function publicOptionsResponse(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: publicCorsHeaders(request),
  });
}

export function requirePublicStorefrontAccess(request: NextRequest) {
  const configuredKey = process.env.WOWMALL_STOREFRONT_API_KEY;
  if (!configuredKey) {
    return publicError(
      request,
      'CONFIGURATION_ERROR',
      'WoWMall storefront API key is not configured.',
      503,
    );
  }

  const providedKey = request.headers.get(wowmallKeyHeader);
  if (providedKey === configuredKey) return null;

  return publicError(
    request,
    'UNAUTHORIZED',
    'A valid WoWMall API key is required.',
    401,
  );
}

export function publicSuccess<T>(
  request: NextRequest | Request,
  data: T,
  init: { status?: number; cacheable?: boolean } = {},
) {
  return NextResponse.json(
    { success: true, data } satisfies PublicApiSuccess<T>,
    {
      status: init.status ?? 200,
      headers: responseHeaders(request),
    },
  );
}

export function publicError(
  request: NextRequest | Request,
  code: string,
  message: string,
  status: number,
) {
  return NextResponse.json(
    {
      success: false,
      error: { code, message },
    } satisfies PublicApiError,
    {
      status,
      headers: responseHeaders(request),
    },
  );
}
