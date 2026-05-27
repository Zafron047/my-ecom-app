import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as placeOrder } from '../src/app/api/checkout/place-order/route';
import { GET as orderDetails } from '../src/app/api/orders/[orderNumber]/route';
import { businessData } from '../src/lib/business-data';

const mocks = vi.hoisted(() => ({
  customerCreate: vi.fn(),
  customerFindFirst: vi.fn(),
  customerFindUnique: vi.fn(),
  customerUpdate: vi.fn(),
  getBDBuyPartnerOrder: vi.fn(),
  getBDBuyProductDetails: vi.fn(),
  getAdminSession: vi.fn(),
  getCookie: vi.fn(),
  getCustomerSession: vi.fn(),
  orderCreate: vi.fn(),
  orderEventCreate: vi.fn(),
  orderFindFirst: vi.fn(),
  rateLimit: vi.fn(),
  sendBDBuyFulfillmentOrder: vi.fn(),
  supplierFulfillmentCreate: vi.fn(),
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

vi.mock('@/lib/bdbuy-partner-api', () => ({
  BDBUY_SUPPLIER_PRODUCT_ID_PREFIX: 'bdbuy:',
  getBDBuyPartnerOrder: mocks.getBDBuyPartnerOrder,
  getBDBuyProductDetails: mocks.getBDBuyProductDetails,
  isBDBuyPartnerModeEnabled: () =>
    Boolean(process.env.BDBUY_PARTNER_API_URL && process.env.BDBUY_PARTNER_API_KEY),
}));

vi.mock('@/lib/customer-auth', () => ({
  CUSTOMER_RECENT_ORDER_COOKIE: 'recent_order_token',
  createRecentOrderAccessToken: vi.fn(() => 'recent-token'),
  verifyRecentOrderAccessToken: mocks.verifyRecentOrderAccessToken,
}));

vi.mock('@/lib/customer-session', () => ({
  getCustomerSession: mocks.getCustomerSession,
  getCustomerSessionFromToken: vi.fn(async () => null),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn((callback) =>
      callback({
        order: {
          create: mocks.orderCreate,
        },
        supplierFulfillmentOrder: {
          create: mocks.supplierFulfillmentCreate,
        },
      }),
    ),
    customer: {
      create: mocks.customerCreate,
      findFirst: mocks.customerFindFirst,
      findUnique: mocks.customerFindUnique,
      update: mocks.customerUpdate,
    },
    order: {
      findFirst: mocks.orderFindFirst,
    },
    orderEvent: {
      create: mocks.orderEventCreate,
    },
  },
}));

vi.mock('@/lib/rate-limit', () => ({
  checkDistributedRateLimit: mocks.rateLimit,
  getClientIp: vi.fn(() => '127.0.0.1'),
  rateLimitHeaders: vi.fn(() => ({ 'X-RateLimit-Limit': '100' })),
}));

vi.mock('@/lib/supplier-fulfillment', () => ({
  BDBUY_SUPPLIER_KEY: 'bdbuy',
  sendBDBuyFulfillmentOrder: mocks.sendBDBuyFulfillmentOrder,
}));

function request(body: unknown) {
  return new Request('https://wowmall.test/api/checkout/place-order', {
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
      lastName: 'Rahman',
    },
    items: [
      {
        detailId: 'bdbuy:kitchen-tool',
        id: 'line-1',
        name: 'Kitchen Tool',
        quantity: 2,
        variantId: 'variant-1',
      },
    ],
    payment: { method: 'cod' },
    shipping: {
      address: 'Mirpur 10',
      district: 'Dhaka',
      division: 'Dhaka',
      thana: 'Mirpur',
    },
    totals: {
      shipping: 80,
      subtotal: 1980,
      total: 2060,
    },
  };
}

describe('WoWMall partner mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BDBUY_PARTNER_API_URL = 'https://supplier.test';
    process.env.BDBUY_PARTNER_API_KEY = 'supplier-secret';
    mocks.rateLimit.mockResolvedValue({ allowed: true, remaining: 99, resetAt: Date.now() });
    mocks.getAdminSession.mockResolvedValue(null);
    mocks.getCustomerSession.mockResolvedValue(null);
    mocks.getCookie.mockReturnValue(undefined);
    mocks.verifyRecentOrderAccessToken.mockReturnValue(null);
    mocks.customerCreate.mockResolvedValue({ id: 'customer-1' });
    mocks.customerFindFirst.mockResolvedValue(null);
    mocks.customerFindUnique.mockResolvedValue(null);
    mocks.customerUpdate.mockResolvedValue({});
    mocks.orderCreate.mockResolvedValue({
      id: 'order-1',
      orderNumber: 'ORD-LOCAL-1001',
    });
    mocks.orderEventCreate.mockResolvedValue({});
    mocks.orderFindFirst.mockResolvedValue(null);
    mocks.supplierFulfillmentCreate.mockResolvedValue({ id: 'fulfillment-1' });
    mocks.sendBDBuyFulfillmentOrder.mockResolvedValue({
      ok: true,
      supplierOrderNumber: 'WM-1001',
    });
    mocks.getBDBuyProductDetails.mockResolvedValue([
      {
        id: 'bdbuy:kitchen-tool',
        name: 'Kitchen Tool',
        variants: [
          {
            id: 'variant-1',
            color: 'Red',
            price: 990,
            size: 'Standard',
            stockQuantity: 5,
          },
        ],
      },
    ]);
  });

  it('uses WoWMall public business identity', () => {
    expect(businessData).toMatchObject({
      logo: '/Wow-Logo-Final.jpg',
      logoAlt: 'WoWMall logo',
      name: 'WoWMall',
      websiteUrl: 'https://wowmall.xyz',
    });
  });

  it('creates a local order and sends a BDBuy supplier fulfillment order', async () => {
    const response = await placeOrder(request(checkoutPayload()));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.orderId).toBe('ORD-LOCAL-1001');
    expect(payload.fulfillmentStatus).toBe('sent');
    expect(mocks.orderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerId: 'customer-1',
          notes: 'BDBuy supplier fulfillment order.',
          subtotalAmount: 1980,
          totalAmount: 2060,
        }),
      }),
    );
    expect(mocks.supplierFulfillmentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          localOrderNumber: 'ORD-LOCAL-1001',
          orderId: 'order-1',
          requestPayload: expect.objectContaining({
            customer: expect.objectContaining({ firstName: 'Nina' }),
            items: [
              expect.objectContaining({
                quantity: 2,
                unitPrice: 990,
                variantId: 'variant-1',
              }),
            ],
            orderNumber: expect.stringMatching(/^WM-\d{10}-\d{4}$/),
            totals: expect.objectContaining({
              shipping: 80,
              subtotal: 1980,
              total: 2060,
            }),
          }),
        }),
      }),
    );
    expect(mocks.sendBDBuyFulfillmentOrder).toHaveBeenCalledWith('fulfillment-1');
  });

  it('reads partner order details for recent WM orders', async () => {
    mocks.getCookie.mockReturnValue({ value: 'recent-token' });
    mocks.verifyRecentOrderAccessToken.mockReturnValue('WM-1001');
    mocks.getBDBuyPartnerOrder.mockResolvedValue({
      createdAt: '2026-05-27T10:00:00.000Z',
      customer: {
        firstName: 'Nina',
        phone: '01712345678',
      },
      items: [
        {
          id: 'line-1',
          productId: 'product-1',
          productName: 'Kitchen Tool',
          quantity: 2,
          sku: 'SKU-1',
          unitPrice: 990,
          variantId: 'variant-1',
          variantLabel: 'Red / Standard',
        },
      ],
      orderNumber: 'WM-1001',
      paymentMethod: 'COD',
      shipping: {
        address: 'Mirpur 10',
        district: 'Dhaka',
        division: 'Dhaka',
        thana: 'Mirpur',
      },
      totals: {
        shipping: 80,
        subtotal: 1980,
        total: 2060,
      },
    });

    const response = await orderDetails(new Request('https://wowmall.test/api/orders/WM-1001'), {
      params: Promise.resolve({ orderNumber: 'WM-1001' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      id: 'WM-1001',
      customer: {
        firstName: 'Nina',
        customerMobile: '01712345678',
      },
      totals: {
        shipping: 80,
        total: 2060,
      },
    });
  });
});
