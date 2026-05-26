import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as listProducts } from '../src/app/api/wowmall/products/route';
import { GET as productDetail } from '../src/app/api/wowmall/products/[slug]/route';

const mocks = vi.hoisted(() => ({
  count: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: mocks.transaction,
    product: {
      count: mocks.count,
      findFirst: mocks.findFirst,
      findMany: mocks.findMany,
    },
    category: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

function decimal(value: number) {
  return { toNumber: () => value };
}

function activeProduct(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Kitchen Tool',
    slug: 'kitchen-tool',
    price: decimal(1200),
    salePrice: decimal(990),
    seoTitle: 'Kitchen Tool',
    seoDescription: 'Useful kitchen tool',
    shortDescription: 'Short public copy',
    description: 'Long public copy',
    categories: [
      {
        category: {
          name: 'Home & Kitchen',
          slug: 'home-kitchen',
          description: 'Kitchen category',
          imagePath: 'https://cdn.example.com/category.jpg',
        },
      },
    ],
    images: [
      {
        storagePath: 'https://cdn.example.com/product/original/main.jpg',
        altText: 'Kitchen Tool',
        isPrimary: true,
      },
    ],
    variants: [
      {
        id: 'variant-1',
        sku: 'KITCHEN-TOOL-RED',
        color: 'Red',
        colorHex: '#ff0000',
        size: null,
        price: decimal(990),
        compareAtPrice: decimal(1200),
        stockQuantity: 4,
        imagePath: 'https://cdn.example.com/product/original/red.jpg',
        inventoryBatches: [
          {
            batchNumber: 'BATCH-001',
            remainingQuantity: 3,
            unitCost: decimal(430),
            receivedAt: new Date('2026-05-01T10:00:00.000Z'),
            status: 'available',
          },
        ],
        variantImages: [{ imagePath: 'https://cdn.example.com/product/original/red-2.jpg' }],
        costPrice: decimal(400),
        reorderLevel: 10,
      },
    ],
    supplierName: 'Private Supplier',
    ...overrides,
  };
}

describe('public storefront API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WOWMALL_STOREFRONT_API_KEY = 'wowmall-secret';
    delete process.env.WOWMALL_ALLOWED_ORIGINS;
    mocks.transaction.mockImplementation((queries) => Promise.all(queries));
    mocks.findMany.mockResolvedValue([activeProduct()]);
    mocks.count.mockResolvedValue(1);
    mocks.findFirst.mockResolvedValue(activeProduct());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('validates product list query params and returns the stable error shape', async () => {
    const response = await listProducts(
      new NextRequest('https://bdbuyeasy.test/api/wowmall/products?limit=500&page=nope', {
        headers: { 'X-WoWMall-Api-Key': 'wowmall-secret' },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'page must be a positive integer.',
      },
    });
  });

  it('caps pagination limits and only fetches active products', async () => {
    const response = await listProducts(
      new NextRequest('https://bdbuyeasy.test/api/wowmall/products?limit=500', {
        headers: { 'X-WoWMall-Api-Key': 'wowmall-secret' },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.pagination.limit).toBe(50);
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
        where: expect.objectContaining({
          AND: expect.arrayContaining([{ status: 'active' }]),
        }),
      }),
    );
  });

  it('returns WoWMall product DTOs with exact variant quantity and batch cost but no unrelated admin fields', async () => {
    const response = await productDetail(
      new NextRequest('https://bdbuyeasy.test/api/wowmall/products/kitchen-tool', {
        headers: { 'X-WoWMall-Api-Key': 'wowmall-secret' },
      }),
      { params: Promise.resolve({ slug: 'kitchen-tool' }) },
    );
    const payload = await response.json();
    const productJson = JSON.stringify(payload.data.product);

    expect(response.status).toBe(200);
    expect(payload.data.product).toMatchObject({
      title: 'Kitchen Tool',
      slug: 'kitchen-tool',
      pricing: {
        minPrice: 990,
        maxPrice: 990,
        minCompareAtPrice: 1200,
        maxCompareAtPrice: 1200,
        hasRange: false,
        hasDiscount: true,
      },
      quantity: 4,
    });
    expect(payload.data.product.variants[0]).toMatchObject({
      price: 990,
      compareAtPrice: 1200,
      quantity: 4,
      images: [
        {
          url: 'https://cdn.example.com/product/thumb/red.webp',
          altText: 'Red',
          isPrimary: true,
        },
        {
          url: 'https://cdn.example.com/product/thumb/red-2.webp',
          altText: 'Red',
          isPrimary: false,
        },
      ],
      inventoryBatches: [
        {
          batchNumber: 'BATCH-001',
          quantity: 3,
          unitCost: 430,
          status: 'available',
          receivedAt: '2026-05-01T10:00:00.000Z',
        },
      ],
    });
    expect(productJson).not.toContain('reorderLevel');
    expect(productJson).not.toContain('supplierName');
    expect(productJson).not.toContain('costPrice');
    expect(payload.data.product).not.toHaveProperty('category');
    expect(productJson).not.toContain('retailPrice');
    expect(productJson).not.toContain('salePrice');
    expect(productJson).not.toContain('stockStatus');
    expect(productJson).not.toContain('inStock');
    expect(productJson).not.toContain('createdAt');
    expect(productJson).not.toContain('updatedAt');
    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          slug: 'kitchen-tool',
          status: 'active',
        },
      }),
    );
  });

  it('requires X-WoWMall-Api-Key', async () => {
    const unauthorized = await listProducts(
      new NextRequest('https://bdbuyeasy.test/api/wowmall/products'),
    );
    expect(unauthorized.status).toBe(401);

    const authorized = await listProducts(
      new NextRequest('https://bdbuyeasy.test/api/wowmall/products', {
        headers: { 'X-WoWMall-Api-Key': 'wowmall-secret' },
      }),
    );
    expect(authorized.status).toBe(200);
  });

  it('keeps product list payload light and omits batch costs', async () => {
    const response = await listProducts(
      new NextRequest('https://bdbuyeasy.test/api/wowmall/products', {
        headers: { 'X-WoWMall-Api-Key': 'wowmall-secret' },
      }),
    );
    const payload = await response.json();
    const product = payload.data.products[0];
    const productJson = JSON.stringify(product);

    expect(response.status).toBe(200);
    expect(product).toMatchObject({
      images: [
        {
          url: 'https://cdn.example.com/product/thumb/main.webp',
          altText: 'Kitchen Tool',
          isPrimary: true,
        },
      ],
      pricing: {
        minPrice: 990,
        maxPrice: 990,
        minCompareAtPrice: 1200,
        maxCompareAtPrice: 1200,
        hasRange: false,
        hasDiscount: true,
      },
      quantity: 4,
    });
    expect(product.variants[0]).toMatchObject({
      price: 990,
      compareAtPrice: 1200,
      quantity: 4,
      images: [
        {
          url: 'https://cdn.example.com/product/thumb/red.webp',
          altText: 'Red',
          isPrimary: true,
        },
        {
          url: 'https://cdn.example.com/product/thumb/red-2.webp',
          altText: 'Red',
          isPrimary: false,
        },
      ],
    });
    expect(productJson).not.toContain('inventoryBatches');
    expect(productJson).not.toContain('unitCost');
    expect(product).not.toHaveProperty('category');
    expect(product.categories[0]).not.toHaveProperty('description');
    expect(productJson).not.toContain('seo');
  });

  it('fails closed when the WoWMall API key is not configured', async () => {
    delete process.env.WOWMALL_STOREFRONT_API_KEY;

    const response = await listProducts(
      new NextRequest('https://bdbuyeasy.test/api/wowmall/products', {
        headers: { 'X-WoWMall-Api-Key': 'wowmall-secret' },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.error.code).toBe('CONFIGURATION_ERROR');
  });

  it('allows configured CORS origins without opening production to every origin', async () => {
    vi.stubEnv('WOWMALL_ALLOWED_ORIGINS', 'https://wowmall.xyz');

    const allowed = await listProducts(
      new NextRequest('https://bdbuyeasy.test/api/wowmall/products', {
        headers: {
          origin: 'https://wowmall.xyz',
          'X-WoWMall-Api-Key': 'wowmall-secret',
        },
      }),
    );
    const denied = await listProducts(
      new NextRequest('https://bdbuyeasy.test/api/wowmall/products', {
        headers: {
          origin: 'https://unknown-store.test',
          'X-WoWMall-Api-Key': 'wowmall-secret',
        },
      }),
    );

    expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://wowmall.xyz',
    );
    expect(denied.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});
