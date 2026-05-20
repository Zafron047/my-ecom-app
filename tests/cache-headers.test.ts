import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as abandonedCheckout } from '../src/app/api/cart/abandoned-checkout/route';
import { POST as priceCart } from '../src/app/api/cart/price/route';
import { POST as placeOrder } from '../src/app/api/checkout/place-order/route';
import { GET as deliveryLocations } from '../src/app/api/delivery-locations/route';
import { GET as orderDetails } from '../src/app/api/orders/[orderNumber]/route';
import { GET as storefrontCatalog } from '../src/app/api/storefront/catalog/route';
import { GET as storefrontProduct } from '../src/app/api/storefront/products/[id]/route';
import { GET as storefrontSearch } from '../src/app/api/storefront/search/route';

const mocks = vi.hoisted(() => ({
  abandonedCheckoutUpsert: vi.fn(),
  allocateInventoryForOrderProduct: vi.fn(),
  buildCheckoutPricing: vi.fn(),
  bundleOfferFindMany: vi.fn(),
  customerCreate: vi.fn(),
  customerFindFirst: vi.fn(),
  customerSessionFromToken: vi.fn(),
  customerUpdate: vi.fn(),
  deliveryAreas: vi.fn(),
  deliveryDistricts: vi.fn(),
  deliveryDivision: vi.fn(),
  deliveryDivisions: vi.fn(),
  getAdminSession: vi.fn(),
  getCartPricingLookup: vi.fn(),
  getCookie: vi.fn(),
  getCustomerSession: vi.fn(),
  getStorefrontCatalog: vi.fn(),
  getStorefrontProductDetailById: vi.fn(),
  getHeaderSearchProducts: vi.fn(),
  orderFindFirst: vi.fn(),
  productFindMany: vi.fn(),
  rateLimit: vi.fn(),
  transaction: vi.fn(),
  verifyRecentOrderAccessToken: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: mocks.getCookie,
  })),
}));

vi.mock('@/lib/admin-session', () => ({
  getAdminSession: mocks.getAdminSession,
}));

vi.mock('@/lib/cart-bundle-pricing', async () => {
  const actual = await vi.importActual<typeof import('../src/lib/cart-bundle-pricing')>(
    '../src/lib/cart-bundle-pricing',
  );
  return actual;
});

vi.mock('@/lib/checkout-pricing', () => ({
  buildCheckoutPricing: mocks.buildCheckoutPricing,
}));

vi.mock('@/lib/customer-auth', () => ({
  CUSTOMER_RECENT_ORDER_COOKIE: 'recent_order_token',
  createRecentOrderAccessToken: vi.fn(() => 'recent-token'),
  verifyRecentOrderAccessToken: mocks.verifyRecentOrderAccessToken,
}));

vi.mock('@/lib/customer-session', () => ({
  getCustomerSession: mocks.getCustomerSession,
  getCustomerSessionFromToken: mocks.customerSessionFromToken,
}));

vi.mock('@/lib/delivery-locations', () => ({
  getDeliveryAreas: mocks.deliveryAreas,
  getDeliveryDistricts: mocks.deliveryDistricts,
  getDeliveryDivisionForDistrict: mocks.deliveryDivision,
  getDeliveryDivisions: mocks.deliveryDivisions,
}));

vi.mock('@/lib/inventory-allocation', () => ({
  allocateInventoryForOrderProduct: mocks.allocateInventoryForOrderProduct,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: mocks.transaction,
    abandonedCheckout: {
      upsert: mocks.abandonedCheckoutUpsert,
      updateMany: vi.fn(),
    },
    bundleOffer: {
      findMany: mocks.bundleOfferFindMany,
    },
    customer: {
      create: mocks.customerCreate,
      findFirst: mocks.customerFindFirst,
      findUnique: vi.fn(),
      update: mocks.customerUpdate,
    },
    order: {
      findFirst: mocks.orderFindFirst,
    },
    product: {
      findMany: mocks.productFindMany,
    },
  },
}));

vi.mock('@/lib/rate-limit', () => ({
  checkDistributedRateLimit: mocks.rateLimit,
  getClientIp: vi.fn(() => '127.0.0.1'),
  rateLimitHeaders: vi.fn(() => ({ 'X-RateLimit-Limit': '100' })),
}));

vi.mock('@/lib/storefront-data', () => ({
  getCartPricingLookup: mocks.getCartPricingLookup,
  getHeaderSearchProducts: mocks.getHeaderSearchProducts,
  getStorefrontCatalog: mocks.getStorefrontCatalog,
  getStorefrontProductDetailById: mocks.getStorefrontProductDetailById,
}));

const PUBLIC_CACHE = 'public, s-maxage=300, stale-while-revalidate=86400';
const PRIVATE_NO_STORE = 'private, no-store, max-age=0, must-revalidate';

function jsonRequest(url: string, body: unknown) {
  return new Request(url, {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
}

function checkoutPayload() {
  return {
    customer: {
      customerMobile: '01712345678',
      firstName: 'Nina',
    },
    items: [{ detailId: 'product-1', id: 'line-1', quantity: 1, variantId: 'variant-1' }],
    payment: { method: 'cod' },
    shipping: {
      address: 'Mirpur',
      district: 'Dhaka',
      division: 'Dhaka',
      thana: 'Mirpur',
    },
    totals: {
      shipping: 80,
      subtotal: 1000,
      total: 1080,
    },
  };
}

function getRouteFiles(root: string): string[] {
  return readdirSync(root).flatMap((entry) => {
    const fullPath = path.join(root, entry);
    if (statSync(fullPath).isDirectory()) return getRouteFiles(fullPath);
    return entry === 'route.ts' ? [fullPath] : [];
  });
}

describe('API cache headers', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.rateLimit.mockResolvedValue({ allowed: true, remaining: 99, resetAt: Date.now() });
    mocks.getStorefrontCatalog.mockResolvedValue({ categories: [], products: [] });
    mocks.getStorefrontProductDetailById.mockResolvedValue({ id: 'product-1', name: 'Shoe' });
    mocks.getHeaderSearchProducts.mockResolvedValue([]);
    mocks.deliveryDivisions.mockResolvedValue(['Dhaka']);
    mocks.abandonedCheckoutUpsert.mockResolvedValue({});
    mocks.getAdminSession.mockResolvedValue(null);
    mocks.getCustomerSession.mockResolvedValue(null);
    mocks.customerSessionFromToken.mockResolvedValue(null);
    mocks.getCookie.mockReturnValue(undefined);
    mocks.verifyRecentOrderAccessToken.mockReturnValue(null);
  });

  it('returns public CDN headers from storefront and delivery GET APIs', async () => {
    const responses = [
      await storefrontCatalog(),
      await storefrontProduct(new Request('https://example.test/api/storefront/products/product-1'), {
        params: Promise.resolve({ id: 'product-1' }),
      }),
      await storefrontSearch(),
      await deliveryLocations(
        new Request('https://example.test/api/delivery-locations?type=divisions'),
      ),
    ];

    for (const response of responses) {
      expect(response.headers.get('Cache-Control')).toBe(PUBLIC_CACHE);
    }
  });

  it('returns private no-store from cart pricing responses', async () => {
    const emptyCart = await priceCart(
      jsonRequest('https://example.test/api/cart/price', { items: [] }),
    );
    expect(emptyCart.headers.get('Cache-Control')).toBe(PRIVATE_NO_STORE);

    const invalidCart = await priceCart(
      jsonRequest('https://example.test/api/cart/price', {
        items: [{ id: '', quantity: 1 }],
      }),
    );
    expect(invalidCart.status).toBe(400);
    expect(invalidCart.headers.get('Cache-Control')).toBe(PRIVATE_NO_STORE);
  });

  it('returns private no-store from checkout validation errors and success', async () => {
    const invalid = await placeOrder(
      jsonRequest('https://example.test/api/checkout/place-order', {
        ...checkoutPayload(),
        customer: { customerMobile: '01712345678', firstName: '' },
      }),
    );
    expect(invalid.status).toBe(400);
    expect(invalid.headers.get('Cache-Control')).toBe(PRIVATE_NO_STORE);

    mocks.productFindMany.mockResolvedValue([
      {
        bundleOffers: [],
        id: 'product-1',
        name: 'Shoe',
        variants: [{ id: 'variant-1', price: { toNumber: () => 1000 }, stockQuantity: 10 }],
      },
    ]);
    mocks.bundleOfferFindMany.mockResolvedValue([]);
    mocks.customerFindFirst.mockResolvedValue(null);
    mocks.customerCreate.mockResolvedValue({ id: 'customer-1', isBlocked: false });
    mocks.buildCheckoutPricing.mockReturnValue({
      deliveryCharge: 80,
      discountAmount: 0,
      lines: [
        {
          bundleRule: null,
          bundleTitle: null,
          discountAmount: 0,
          imagePath: null,
          lineTotal: 1000,
          productId: 'product-1',
          productName: 'Shoe',
          quantity: 1,
          sku: 'SKU-1',
          unitPrice: 1000,
          variantId: 'variant-1',
          variantLabel: 'Standard',
        },
      ],
      ok: true,
      subtotalBeforeDiscount: 1000,
      totalAmount: 1080,
    });
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        order: {
          create: vi.fn().mockResolvedValue({
            id: 'order-1',
            orderNumber: 'ORD-1001',
            products: [{ id: 'line-1', quantity: 1, variantId: 'variant-1' }],
          }),
        },
      }),
    );

    const success = await placeOrder(
      jsonRequest('https://example.test/api/checkout/place-order', checkoutPayload()),
    );
    expect(success.status).toBe(200);
    expect(success.headers.get('Cache-Control')).toBe(PRIVATE_NO_STORE);
  });

  it('returns private no-store from abandoned checkout and order detail APIs', async () => {
    const abandoned = await abandonedCheckout(
      jsonRequest('https://example.test/api/cart/abandoned-checkout', {
        items: [],
        sessionId: 'cart-session-1',
      }),
    );
    expect(abandoned.headers.get('Cache-Control')).toBe(PRIVATE_NO_STORE);

    const order = await orderDetails(new Request('https://example.test/api/orders/ORD-1001'), {
      params: Promise.resolve({ orderNumber: 'ORD-1001' }),
    });
    expect(order.status).toBe(401);
    expect(order.headers.get('Cache-Control')).toBe(PRIVATE_NO_STORE);
  });

  it('does not use public cache headers in admin, customer account, or session APIs', () => {
    const apiRoot = path.resolve(process.cwd(), 'src/app/api');
    const sensitiveRouteFiles = getRouteFiles(apiRoot).filter((filePath) =>
      /[\\/]api[\\/](admin|account|auth|customers|login|logout|register|password-reset)[\\/]/.test(
        filePath,
      ),
    );

    expect(sensitiveRouteFiles.length).toBeGreaterThan(0);
    for (const filePath of sensitiveRouteFiles) {
      const source = readFileSync(filePath, 'utf8');
      expect(source, filePath).not.toContain('PUBLIC_STOREFRONT_CACHE_HEADERS');
      expect(source, filePath).not.toContain(PUBLIC_CACHE);
    }
  });
});
