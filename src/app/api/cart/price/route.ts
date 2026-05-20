import { computeCartPricing } from '@/lib/cart-bundle-pricing';
import { PRIVATE_NO_STORE_HEADERS } from '@/lib/http-cache';
import {
  checkDistributedRateLimit,
  getClientIp,
  rateLimitHeaders,
} from '@/lib/rate-limit';
import { getCartPricingLookup } from '@/lib/storefront-data';

type CartPricePayload = {
  items: Array<{
    id: string;
    detailId?: string;
    variantId?: string;
    quantity: number;
  }>;
};

type CartPriceResponse = {
  linePricingById: Record<
    string,
    {
      lineSubtotal: number;
      lineDiscount: number;
      lineTotal: number;
      bundleTitle?: string;
      bundleMinTotalQty?: number;
      bundleDiscountPercent?: number;
    }
  >;
  subtotalBeforeDiscount: number;
  discountTotal: number;
  subtotal: number;
};

type CartPriceLine = CartPriceResponse['linePricingById'][string];

const EMPTY_CART_PRICING: CartPriceResponse = {
  linePricingById: {},
  subtotalBeforeDiscount: 0,
  discountTotal: 0,
  subtotal: 0,
};

const CART_PRICE_CACHE_TTL_MS = 30_000;
const CART_PRICE_RATE_LIMIT = {
  limit: 120,
  windowMs: 60_000,
};

type CartPriceCacheEntry = {
  expiresAt: number;
  payload: Omit<CartPriceResponse, 'linePricingById'>;
  lines: Array<{
    signature: string;
    pricing: CartPriceLine;
  }>;
};

const globalForCartPrice = globalThis as unknown as {
  cartPriceCache?: Map<string, CartPriceCacheEntry>;
};

function toMoney(value: number) {
  return Number(value.toFixed(2));
}

function getCartPriceCache() {
  globalForCartPrice.cartPriceCache ??= new Map();
  return globalForCartPrice.cartPriceCache;
}

function getCartPriceCacheHeaders(state: 'HIT' | 'MISS' | 'BYPASS') {
  return {
    ...PRIVATE_NO_STORE_HEADERS,
    'X-Cart-Price-Cache': state,
  };
}

function getCartPriceCacheKey(items: CartPricePayload['items']) {
  return JSON.stringify(
    items
      .map((item) => ({
        productId: typeof item.detailId === 'string' && item.detailId.trim()
          ? item.detailId.trim()
          : typeof item.id === 'string'
            ? item.id.trim()
            : '',
        variantId: typeof item.variantId === 'string' ? item.variantId.trim() : '',
        quantity: Math.max(1, Math.floor(item.quantity || 1)),
      }))
      .sort((a, b) => {
        const first = `${a.productId}:${a.variantId}:${a.quantity}`;
        const second = `${b.productId}:${b.variantId}:${b.quantity}`;
        return first.localeCompare(second);
      }),
  );
}

function getCartPriceLineSignature(item: CartPricePayload['items'][number]) {
  const productId = typeof item.detailId === 'string' && item.detailId.trim()
    ? item.detailId.trim()
    : typeof item.id === 'string'
      ? item.id.trim()
      : '';
  const variantId = typeof item.variantId === 'string' ? item.variantId.trim() : '';
  const quantity = Math.max(1, Math.floor(item.quantity || 1));
  return `${productId}:${variantId}:${quantity}`;
}

function responseFromCacheEntry(
  entry: CartPriceCacheEntry,
  items: CartPricePayload['items'],
): CartPriceResponse {
  const linesBySignature = new Map<string, CartPriceLine[]>();
  for (const line of entry.lines) {
    linesBySignature.set(line.signature, [
      ...(linesBySignature.get(line.signature) ?? []),
      line.pricing,
    ]);
  }

  const linePricingById: CartPriceResponse['linePricingById'] = {};
  for (const item of items) {
    const signature = getCartPriceLineSignature(item);
    const matchingLines = linesBySignature.get(signature);
    const pricing = matchingLines?.shift();
    if (!pricing) continue;
    linePricingById[item.id] = pricing;
  }

  return {
    linePricingById,
    ...entry.payload,
  };
}

export async function POST(request: Request) {
  try {
    const rateLimit = await checkDistributedRateLimit({
      key: `cart:price:${getClientIp(request)}`,
      ...CART_PRICE_RATE_LIMIT,
    });
    if (!rateLimit.allowed) {
      return Response.json(
        { error: 'Too many cart pricing requests. Please wait a moment and retry.' },
        {
          status: 429,
          headers: {
            ...getCartPriceCacheHeaders('BYPASS'),
            ...rateLimitHeaders(rateLimit, CART_PRICE_RATE_LIMIT.limit),
          },
        },
      );
    }

    const requestText = await request.text();
    const payload = requestText
      ? (JSON.parse(requestText) as CartPricePayload)
      : ({ items: [] } satisfies CartPricePayload);
    if (!Array.isArray(payload?.items) || payload.items.length === 0) {
      return Response.json(EMPTY_CART_PRICING, {
        status: 200,
        headers: getCartPriceCacheHeaders('BYPASS'),
      });
    }

    const seenLineIds = new Set<string>();
    for (const item of payload.items) {
      const lineId = typeof item?.id === 'string' ? item.id.trim() : '';
      if (!lineId) {
        return Response.json(
          { error: 'Invalid cart line id.' },
          { status: 400, headers: getCartPriceCacheHeaders('BYPASS') },
        );
      }
      if (seenLineIds.has(lineId)) {
        return Response.json(
          { error: `Duplicate cart line id detected: ${lineId}` },
          { status: 400, headers: getCartPriceCacheHeaders('BYPASS') },
        );
      }
      seenLineIds.add(lineId);
    }

    const cacheKey = getCartPriceCacheKey(payload.items);
    const cache = getCartPriceCache();
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return Response.json(responseFromCacheEntry(cached, payload.items), {
        status: 200,
        headers: getCartPriceCacheHeaders('HIT'),
      });
    }
    if (cached) {
      cache.delete(cacheKey);
    }

    const productIds = [
      ...new Set(payload.items.map((item) => item.detailId ?? item.id).filter(Boolean)),
    ];
    const selectedVariantIds = [
      ...new Set(
        payload.items
          .map((item) => item.variantId)
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    const [variants, globalBundleOffers] = await getCartPricingLookup(
      productIds,
      selectedVariantIds,
    );

    const variantById = new Map(variants.map((variant) => [variant.id, variant]));
    const variantsByProductId = new Map<string, typeof variants>();
    const offersByProductId = new Map<
      string,
      Array<{
        id: string;
        title: string;
        minTotalQty: number;
        discountPercent: number;
        variantIds: string[];
        isActive: boolean;
      }>
    >();

    for (const variant of variants) {
      variantsByProductId.set(variant.productId, [
        ...(variantsByProductId.get(variant.productId) ?? []),
        variant,
      ]);
      if (!offersByProductId.has(variant.productId)) {
        offersByProductId.set(
          variant.productId,
          variant.product.bundleOffers.map((offer) => ({
            id: offer.id,
            title: offer.title?.trim() || 'Bundle Offer',
            minTotalQty: offer.minTotalQty,
            discountPercent: offer.discountPercent.toNumber(),
            variantIds: offer.variants.map((item) => item.variantId),
            isActive: offer.isActive,
          })),
        );
      }
    }

    const pricingLines: Array<{
      id: string;
      productId: string;
      variantId?: string;
      quantity: number;
      unitPrice: number;
    }> = [];

    for (const item of payload.items) {
      const productId = item.detailId ?? item.id;
      const variant =
        (item.variantId ? variantById.get(item.variantId) : undefined) ??
        (variantsByProductId.get(productId)?.length === 1
          ? variantsByProductId.get(productId)?.[0]
          : undefined);
      if (!variant) continue;

      pricingLines.push({
        id: item.id,
        productId,
        variantId: variant.id,
        quantity: Math.max(1, Math.floor(item.quantity || 1)),
        unitPrice: toMoney(variant.price.toNumber()),
      });
    }

    if (pricingLines.length !== payload.items.length) {
      return Response.json(
        {
          error:
            'One or more cart items are no longer active or in stock. Please remove unavailable items and add them again.',
        },
        {
          status: 409,
          headers: getCartPriceCacheHeaders('BYPASS'),
        },
      );
    }

    const pricing = computeCartPricing(
      pricingLines,
      (productId) => offersByProductId.get(productId) ?? [],
      globalBundleOffers.map((offer) => ({
        id: offer.id,
        title: offer.title?.trim() || 'Bundle Offer',
        minTotalQty: offer.minTotalQty,
        discountPercent: offer.discountPercent.toNumber(),
        variantIds: offer.variants.map((item) => item.variantId),
        isActive: offer.isActive,
      })),
    );

    const normalizedLinePricingById = Object.fromEntries(
      Object.entries(pricing.linePricingById).map(([lineId, line]) => [
        lineId,
        {
          ...line,
          lineSubtotal: toMoney(line.lineSubtotal),
          lineDiscount: toMoney(line.lineDiscount),
          lineTotal: toMoney(line.lineTotal),
        },
      ]),
    );

    const responsePayload: CartPriceResponse = {
      linePricingById: normalizedLinePricingById,
      subtotalBeforeDiscount: toMoney(pricing.subtotalBeforeDiscount),
      discountTotal: toMoney(pricing.discountTotal),
      subtotal: toMoney(pricing.subtotal),
    };
    cache.set(cacheKey, {
      expiresAt: Date.now() + CART_PRICE_CACHE_TTL_MS,
      payload: {
        subtotalBeforeDiscount: responsePayload.subtotalBeforeDiscount,
        discountTotal: responsePayload.discountTotal,
        subtotal: responsePayload.subtotal,
      },
      lines: payload.items
        .map((item) => {
          const pricing = responsePayload.linePricingById[item.id];
          if (!pricing) return null;
          return {
            signature: getCartPriceLineSignature(item),
            pricing,
          };
        })
        .filter((line): line is { signature: string; pricing: CartPriceLine } =>
          Boolean(line),
        ),
    });

    return Response.json(responsePayload, {
      headers: getCartPriceCacheHeaders('MISS'),
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json(EMPTY_CART_PRICING, {
        status: 200,
        headers: getCartPriceCacheHeaders('BYPASS'),
      });
    }
    console.error(error);
    return Response.json(
      { error: 'Failed to price cart.' },
      { status: 500, headers: getCartPriceCacheHeaders('BYPASS') },
    );
  }
}
