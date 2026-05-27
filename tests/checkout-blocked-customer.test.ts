import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../src/app/api/checkout/place-order/route';

const mocks = vi.hoisted(() => ({
  buildCheckoutPricing: vi.fn(),
  bundleOfferFindMany: vi.fn(),
  customerCreate: vi.fn(),
  customerFindFirst: vi.fn(),
  customerUpdate: vi.fn(),
  productFindMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('@/lib/checkout-pricing', () => ({
  buildCheckoutPricing: mocks.buildCheckoutPricing,
}));

vi.mock('@/lib/customer-auth', () => ({
  CUSTOMER_RECENT_ORDER_COOKIE: 'recent_order_token',
  createRecentOrderAccessToken: vi.fn(() => 'recent-token'),
}));

vi.mock('@/lib/inventory-allocation', () => ({
  allocateInventoryForOrderProduct: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: mocks.transaction,
    bundleOffer: {
      findMany: mocks.bundleOfferFindMany,
    },
    customer: {
      create: mocks.customerCreate,
      findFirst: mocks.customerFindFirst,
      update: mocks.customerUpdate,
    },
    product: {
      findMany: mocks.productFindMany,
    },
  },
}));

vi.mock('@/lib/supplier-fulfillment', () => ({
  BDBUY_SUPPLIER_KEY: 'bdbuy',
  sendBDBuyFulfillmentOrder: vi.fn(),
}));

function checkoutRequest() {
  return new Request('https://example.test/api/checkout/place-order', {
    body: JSON.stringify({
      customer: {
        customerMobile: '01712345678',
        firstName: 'Nina',
      },
      items: [{ detailId: 'product-1', quantity: 1, variantId: 'variant-1' }],
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
    }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
}

describe('checkout blocked customers', () => {
  beforeEach(() => {
    mocks.buildCheckoutPricing.mockReset();
    mocks.bundleOfferFindMany.mockReset();
    mocks.customerCreate.mockReset();
    mocks.customerFindFirst.mockReset();
    mocks.customerUpdate.mockReset();
    mocks.productFindMany.mockReset();
    mocks.transaction.mockReset();

    mocks.buildCheckoutPricing.mockReturnValue({
      deliveryCharge: 80,
      discountAmount: 0,
      lines: [],
      ok: true,
      subtotalBeforeDiscount: 1000,
      totalAmount: 1080,
    });
    mocks.bundleOfferFindMany.mockResolvedValue([]);
    mocks.productFindMany.mockResolvedValue([
      {
        id: 'product-1',
        variants: [{ id: 'variant-1' }],
      },
    ]);
  });

  it('rejects blocked customers before creating an order', async () => {
    mocks.customerFindFirst.mockResolvedValue({
      id: 'customer-1',
      isBlocked: true,
    });

    const response = await POST(checkoutRequest());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      code: 'CUSTOMER_BLOCKED',
      error: 'This customer account cannot place new orders.',
      redirectTo: '/unauthorized',
    });
    expect(mocks.customerCreate).not.toHaveBeenCalled();
    expect(mocks.customerUpdate).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
