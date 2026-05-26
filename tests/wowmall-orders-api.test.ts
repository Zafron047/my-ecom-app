import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../src/app/api/wowmall/orders/route';

const mocks = vi.hoisted(() => ({
  allocateInventoryForOrderProduct: vi.fn(),
  customerCreate: vi.fn(),
  customerFindFirst: vi.fn(),
  orderCount: vi.fn(),
  orderCreate: vi.fn(),
  orderFindMany: vi.fn(),
  orderFindUnique: vi.fn(),
  productVariantFindMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('@/lib/inventory-allocation', () => ({
  allocateInventoryForOrderProduct: mocks.allocateInventoryForOrderProduct,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: mocks.transaction,
    customer: {
      create: mocks.customerCreate,
      findFirst: mocks.customerFindFirst,
    },
    order: {
      count: mocks.orderCount,
      findMany: mocks.orderFindMany,
      findUnique: mocks.orderFindUnique,
    },
    productVariant: {
      findMany: mocks.productVariantFindMany,
    },
  },
}));

function decimal(value: number) {
  return { toNumber: () => value };
}

function apiRequest(
  url: string,
  init: { method?: string; body?: BodyInit; headers?: Record<string, string> } = {},
) {
  return new NextRequest(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-WoWMall-Api-Key': 'wowmall-secret',
      ...(init.headers ?? {}),
    },
  });
}

function orderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    orderNumber: 'WM-1090',
    status: 'pending',
    paymentMethod: 'COD',
    firstName: 'Nina',
    lastName: null,
    email: null,
    phone: '01712345678',
    receiverPhone: '01712345678',
    division: 'Dhaka',
    district: 'Dhaka',
    thana: 'Mirpur',
    address: 'Mirpur 10',
    subtotalAmount: decimal(1000),
    discountAmount: decimal(0),
    deliveryCharge: decimal(80),
    totalAmount: decimal(1080),
    paidAmount: decimal(0),
    placedAt: new Date('2026-05-26T08:00:00.000Z'),
    createdAt: new Date('2026-05-26T08:00:00.000Z'),
    updatedAt: new Date('2026-05-26T08:00:00.000Z'),
    products: [
      {
        id: 'line-1',
        productId: 'product-1',
        variantId: 'variant-1',
        sku: 'SKU-1',
        productName: 'Shoe',
        variantLabel: 'Black / 42',
        quantity: 1,
        unitPrice: decimal(1000),
        discountAmount: decimal(0),
        lineTotal: decimal(1000),
      },
    ],
    ...overrides,
  };
}

describe('WoWMall orders API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WOWMALL_STOREFRONT_API_KEY = 'wowmall-secret';

    mocks.transaction.mockImplementation(async (input) => {
      if (Array.isArray(input)) return Promise.all(input);
      return input({
        order: {
          create: mocks.orderCreate,
        },
      });
    });
    mocks.customerFindFirst.mockResolvedValue({ id: 'customer-1' });
    mocks.orderFindUnique.mockResolvedValue(null);
    mocks.productVariantFindMany.mockResolvedValue([
      {
        id: 'variant-1',
        productId: 'product-1',
        sku: 'SKU-1',
        color: 'Black',
        size: '42',
        imagePath: 'shoe.webp',
        stockQuantity: 5,
        price: decimal(1000),
        product: {
          id: 'product-1',
          name: 'Shoe',
        },
      },
    ]);
    mocks.orderCreate.mockResolvedValue(orderRow());
    mocks.orderFindMany.mockResolvedValue([orderRow()]);
    mocks.orderCount.mockResolvedValue(1);
  });

  it('accepts a WoWMall POST order and stores it as WM-prefixed order', async () => {
    const response = await POST(
      apiRequest('https://bdbuyeasy.test/api/wowmall/orders', {
        method: 'POST',
        body: JSON.stringify({
          orderNumber: 1090,
          customer: {
            firstName: 'Nina',
            customerMobile: '+8801712345678',
          },
          shipping: {
            division: 'Dhaka',
            district: 'Dhaka',
            thana: 'Mirpur',
            address: 'Mirpur 10',
          },
          payment: {
            method: 'cod',
          },
          items: [
            {
              sku: 'SKU-1',
              quantity: 1,
              unitPrice: 1000,
            },
          ],
          totals: {
            shipping: 80,
            total: 1080,
          },
        }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.data.created).toBe(true);
    expect(payload.data.order).toMatchObject({
      orderNumber: 'WM-1090',
      reference: 'order/WM-1090',
    });
    expect(mocks.orderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderNumber: 'WM-1090',
          notes: 'WoWMall order/WM-1090',
        }),
      }),
    );
    expect(mocks.allocateInventoryForOrderProduct).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        variantId: 'variant-1',
        quantity: 1,
      }),
    );
  });

  it('returns an existing WM order instead of duplicating the same WoWMall order', async () => {
    mocks.orderFindUnique.mockResolvedValue(orderRow());

    const response = await POST(
      apiRequest('https://bdbuyeasy.test/api/wowmall/orders', {
        method: 'POST',
        body: JSON.stringify({
          orderNumber: 'WM-1090',
          customer: { firstName: 'Nina', customerMobile: '01712345678' },
          shipping: { district: 'Dhaka', thana: 'Mirpur', address: 'Mirpur 10' },
          items: [{ sku: 'SKU-1', quantity: 1 }],
        }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.created).toBe(false);
    expect(payload.data.order.reference).toBe('order/WM-1090');
    expect(mocks.orderCreate).not.toHaveBeenCalled();
  });

  it('lets WoWMall read only WM-prefixed orders by default', async () => {
    const response = await GET(
      apiRequest('https://bdbuyeasy.test/api/wowmall/orders?limit=100'),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.orders[0]).toMatchObject({
      orderNumber: 'WM-1090',
      reference: 'order/WM-1090',
    });
    expect(mocks.orderFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
        where: {
          orderNumber: { startsWith: 'WM-' },
        },
      }),
    );
  });

  it('requires the WoWMall API key', async () => {
    const response = await GET(new NextRequest('https://bdbuyeasy.test/api/wowmall/orders'));

    expect(response.status).toBe(401);
  });
});
