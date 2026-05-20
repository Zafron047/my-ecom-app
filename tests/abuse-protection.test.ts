import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as signUpload } from '../src/app/api/admin/product-images/sign-upload/route';
import { POST as abandonedCheckout } from '../src/app/api/cart/abandoned-checkout/route';
import { POST as priceCart } from '../src/app/api/cart/price/route';
import { POST as placeOrder } from '../src/app/api/checkout/place-order/route';
import { GET as orderDetails } from '../src/app/api/orders/[orderNumber]/route';

const mocks = vi.hoisted(() => ({
  abandonedCheckoutUpsert: vi.fn(),
  allocateInventoryForOrderProduct: vi.fn(),
  buildCheckoutPricing: vi.fn(),
  bundleOfferFindMany: vi.fn(),
  checkDistributedRateLimit: vi.fn(),
  customerCreate: vi.fn(),
  customerFindFirst: vi.fn(),
  customerFindUnique: vi.fn(),
  customerSessionFromToken: vi.fn(),
  customerUpdate: vi.fn(),
  getAdminSession: vi.fn(),
  getCartPricingLookup: vi.fn(),
  getCookie: vi.fn(),
  getCustomerSession: vi.fn(),
  orderFindFirst: vi.fn(),
  productFindMany: vi.fn(),
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
  getDeliveryDivisionForDistrict: vi.fn(async () => 'Dhaka'),
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
      findUnique: mocks.customerFindUnique,
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

vi.mock('@/lib/rate-limit', async () => {
  const actual = await vi.importActual<typeof import('../src/lib/rate-limit')>(
    '../src/lib/rate-limit',
  );
  return {
    ...actual,
    checkDistributedRateLimit: mocks.checkDistributedRateLimit,
    getClientIp: vi.fn(() => '203.0.113.10'),
  };
});

vi.mock('@/lib/storefront-data', () => ({
  getCartPricingLookup: mocks.getCartPricingLookup,
}));

const PRIVATE_NO_STORE = 'private, no-store, max-age=0, must-revalidate';

function jsonRequest(url: string, body: unknown) {
  return new Request(url, {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
}

function rateLimited() {
  return {
    allowed: false,
    remaining: 0,
    resetAt: Date.now() + 60_000,
  };
}

function allowed() {
  return {
    allowed: true,
    remaining: 99,
    resetAt: Date.now() + 60_000,
  };
}

function expectRateLimitResponse(response: Response, limit: string) {
  expect(response.status).toBe(429);
  expect(response.headers.get('Cache-Control')).toBe(PRIVATE_NO_STORE);
  expect(response.headers.get('Retry-After')).toMatch(/^\d+$/);
  expect(response.headers.get('X-RateLimit-Limit')).toBe(limit);
  expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
  expect(response.headers.get('X-RateLimit-Reset')).toMatch(/^\d+$/);
}

function checkoutPayload() {
  return {
    customer: {
      customerMobile: '01712345678',
      firstName: 'Nina',
    },
    items: [
      {
        detailId: 'product-1',
        id: 'line-1',
        name: 'Shoe',
        quantity: 1,
        variantId: 'variant-1',
      },
    ],
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

describe('abuse protection rate limits', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.checkDistributedRateLimit.mockResolvedValue(allowed());
    mocks.abandonedCheckoutUpsert.mockResolvedValue({});
    mocks.bundleOfferFindMany.mockResolvedValue([]);
    mocks.customerCreate.mockResolvedValue({ id: 'customer-1', isBlocked: false });
    mocks.customerFindFirst.mockResolvedValue(null);
    mocks.customerFindUnique.mockResolvedValue(null);
    mocks.customerSessionFromToken.mockResolvedValue(null);
    mocks.getAdminSession.mockResolvedValue({
      email: 'admin@example.test',
      id: 'admin-1',
      name: 'Admin',
      role: 'admin',
    });
    mocks.getCookie.mockReturnValue(undefined);
    mocks.getCustomerSession.mockResolvedValue(null);
    mocks.getCartPricingLookup.mockResolvedValue([
      [
        {
          id: 'variant-1',
          price: { toNumber: () => 1000 },
          product: { bundleOffers: [] },
          productId: 'product-1',
        },
      ],
      [],
    ]);
    mocks.productFindMany.mockResolvedValue([
      {
        bundleOffers: [],
        id: 'product-1',
        name: 'Shoe',
        variants: [
          {
            id: 'variant-1',
            price: { toNumber: () => 1000 },
            stockQuantity: 10,
          },
        ],
      },
    ]);
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
            products: [{ id: 'order-line-1', quantity: 1, variantId: 'variant-1' }],
          }),
        },
      }),
    );
    mocks.verifyRecentOrderAccessToken.mockReturnValue(null);
  });

  it('returns 429 with rate-limit headers for repeated checkout submissions', async () => {
    mocks.checkDistributedRateLimit.mockResolvedValueOnce(rateLimited());

    const response = await placeOrder(
      jsonRequest('https://example.test/api/checkout/place-order', checkoutPayload()),
    );

    expectRateLimitResponse(response, '8');
  });

  it('returns 429 with rate-limit headers for repeated cart pricing requests', async () => {
    mocks.checkDistributedRateLimit.mockResolvedValueOnce(rateLimited());

    const response = await priceCart(
      jsonRequest('https://example.test/api/cart/price', {
        items: [{ detailId: 'product-1', id: 'line-1', quantity: 1, variantId: 'variant-1' }],
      }),
    );

    expectRateLimitResponse(response, '120');
  });

  it('returns 429 with rate-limit headers for repeated abandoned checkout syncs', async () => {
    mocks.checkDistributedRateLimit.mockResolvedValueOnce(rateLimited());

    const response = await abandonedCheckout(
      jsonRequest('https://example.test/api/cart/abandoned-checkout', {
        items: [],
        sessionId: 'cart-session-1',
      }),
    );

    expectRateLimitResponse(response, '60');
  });

  it('returns 429 with rate-limit headers for repeated order lookups', async () => {
    mocks.checkDistributedRateLimit.mockResolvedValueOnce(rateLimited());

    const response = await orderDetails(new Request('https://example.test/api/orders/ORD-1001'), {
      params: Promise.resolve({ orderNumber: 'ORD-1001' }),
    });

    expectRateLimitResponse(response, '30');
  });

  it('returns 429 with rate-limit headers for repeated admin image sign-upload requests', async () => {
    mocks.checkDistributedRateLimit.mockResolvedValueOnce(rateLimited());

    const response = await signUpload(
      jsonRequest('https://example.test/api/admin/product-images/sign-upload', {
        contentType: 'image/jpeg',
        extension: '.jpg',
        size: 1024,
      }),
    );

    expectRateLimitResponse(response, '40');
  });

  it('allows normal single-user checkout and cart pricing when under the limit', async () => {
    const cartResponse = await priceCart(
      jsonRequest('https://example.test/api/cart/price', {
        items: [{ detailId: 'product-1', id: 'line-1', quantity: 1, variantId: 'variant-1' }],
      }),
    );
    expect(cartResponse.status).toBe(200);
    expect(cartResponse.headers.get('Cache-Control')).toBe(PRIVATE_NO_STORE);

    const checkoutResponse = await placeOrder(
      jsonRequest('https://example.test/api/checkout/place-order', checkoutPayload()),
    );
    expect(checkoutResponse.status).toBe(200);
    expect(checkoutResponse.headers.get('Cache-Control')).toBe(PRIVATE_NO_STORE);
  });
});
