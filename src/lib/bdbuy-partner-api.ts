import type { StorefrontCatalogProduct, StorefrontProductDetail } from '@/lib/storefront-types';
import type { ProductDTO, PublicApiResponse } from '@/lib/public-storefront-types';

const DEFAULT_PAGE_LIMIT = 50;

export type PartnerOrderPayload = {
  orderNumber: string;
  placedAt?: string;
  customer: {
    firstName: string;
    lastName?: string;
    email?: string;
    customerMobile: string;
    receiverMobile?: string;
  };
  shipping: {
    division?: string;
    district: string;
    thana: string;
    address: string;
  };
  payment?: {
    method?: string;
    paidAmount?: number;
  };
  items: Array<{
    variantId?: string;
    name?: string;
    variantLabel?: string;
    quantity: number;
    unitPrice?: number;
    lineTotal?: number;
    discountAmount?: number;
  }>;
  totals?: {
    subtotal?: number;
    shipping?: number;
    total?: number;
    discount?: number;
  };
  notes?: string;
};

export type PartnerOrder = {
  id: string;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  customer: {
    firstName: string;
    lastName?: string;
    email?: string;
    phone: string;
    receiverPhone?: string;
  };
  shipping: {
    division: string;
    district: string;
    thana: string;
    address: string;
  };
  items: Array<{
    id: string;
    productId: string;
    variantId: string;
    sku: string;
    productName: string;
    variantLabel?: string;
    quantity: number;
    unitPrice: number;
    discountAmount: number;
    lineTotal: number;
  }>;
  totals: {
    subtotal: number;
    discount: number;
    shipping: number;
    total: number;
    paid: number;
  };
  placedAt: string;
  createdAt: string;
};

export const BDBUY_SUPPLIER_PRODUCT_ID_PREFIX = 'bdbuy:';

export function isBDBuyPartnerModeEnabled() {
  return Boolean(process.env.BDBUY_PARTNER_API_URL && process.env.BDBUY_PARTNER_API_KEY);
}

function partnerApiUrl(path: string, searchParams?: URLSearchParams) {
  const baseUrl = process.env.BDBUY_PARTNER_API_URL?.replace(/\/$/, '');
  if (!baseUrl) {
    throw new Error('BDBUY_PARTNER_API_URL is not configured.');
  }

  const url = new URL(`${baseUrl}${path}`);
  if (searchParams) {
    searchParams.forEach((value, key) => url.searchParams.set(key, value));
  }
  return url;
}

async function partnerFetch<T>(
  path: string,
  init: RequestInit = {},
  searchParams?: URLSearchParams,
) {
  const apiKey = process.env.BDBUY_PARTNER_API_KEY;
  if (!apiKey) {
    throw new Error('BDBUY_PARTNER_API_KEY is not configured.');
  }

  const response = await fetch(partnerApiUrl(path, searchParams), {
    ...init,
    headers: {
      Accept: 'application/json',
      'X-WoWMall-Api-Key': apiKey,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  });
  const payload = (await response.json()) as PublicApiResponse<T>;

  if (!response.ok || !payload.success) {
    const message = payload.success
      ? `BDBuy partner request failed with HTTP ${response.status}.`
      : payload.error.message;
    throw new Error(message);
  }

  return payload.data;
}

function firstCategory(product: ProductDTO) {
  return product.categories[0]?.name ?? 'Uncategorized';
}

function primaryImage(product: ProductDTO) {
  return product.images.find((image) => image.isPrimary)?.url ?? product.images[0]?.url ?? '';
}

function variantLabel(color?: string, size?: string) {
  return [color?.trim(), size?.trim()].filter(Boolean).join(' / ');
}

function toCatalogProduct(product: ProductDTO): StorefrontCatalogProduct {
  const hasDiscount = product.pricing.hasDiscount && product.pricing.minCompareAtPrice;
  const image = primaryImage(product);

  return {
    id: `${BDBUY_SUPPLIER_PRODUCT_ID_PREFIX}${product.slug}`,
    name: product.title,
    createdAt: new Date().toISOString(),
    price: hasDiscount ? product.pricing.minCompareAtPrice! : product.pricing.minPrice,
    ...(hasDiscount ? { salePrice: product.pricing.minPrice } : {}),
    image,
    images: product.images.map((item) => item.url).filter(Boolean),
    category: firstCategory(product),
    tags: product.categories.flatMap((category) => [category.slug, category.name]),
    ...(product.quantity <= 0 ? { badge: 'Sold Out' } : hasDiscount ? { badge: 'Sale', superSale: true } : {}),
    variants: product.variants.map((variant) => {
      const variantImage = variant.images[0]?.url ?? image;
      const variantHasDiscount = typeof variant.compareAtPrice === 'number' && variant.compareAtPrice > variant.price;
      return {
        id: variant.id,
        color: variant.color ?? '',
        ...(variant.colorHex ? { colorHex: variant.colorHex } : {}),
        size: variant.size ?? '',
        price: variantHasDiscount ? variant.compareAtPrice! : variant.price,
        ...(variantHasDiscount ? { salePrice: variant.price } : {}),
        stockQuantity: variant.quantity,
        image: variantImage,
        images: variant.images.map((item) => item.url).filter(Boolean),
      };
    }),
    bundleOffers: [],
  };
}

export async function getBDBuyCatalogCards() {
  const allProducts: StorefrontCatalogProduct[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(DEFAULT_PAGE_LIMIT),
      inStock: 'true',
    });
    const data = await partnerFetch<{
      products: ProductDTO[];
      pagination: { totalPages: number };
    }>('/api/wowmall/products', {}, params);

    allProducts.push(...data.products.map(toCatalogProduct));
    totalPages = Math.max(1, data.pagination.totalPages);
    page += 1;
  } while (page <= totalPages);

  return allProducts;
}

export async function getBDBuyProductDetail(slug: string): Promise<StorefrontProductDetail | null> {
  const normalizedSlug = slug.startsWith(BDBUY_SUPPLIER_PRODUCT_ID_PREFIX)
    ? slug.slice(BDBUY_SUPPLIER_PRODUCT_ID_PREFIX.length)
    : slug;

  try {
    const { product } = await partnerFetch<{ product: ProductDTO }>(
      `/api/wowmall/products/${encodeURIComponent(normalizedSlug)}`,
    );
    const catalogProduct = toCatalogProduct(product);
    const description = product.description ?? product.shortDescription ?? '';

    return {
      ...catalogProduct,
      imageVersion: Date.now(),
      image: primaryImage(product),
      images: product.images.map((item) => item.url).filter(Boolean),
      description,
      benefits: description
        .split(/\r?\n/)
        .map((line) => line.trim().replace(/^[-*]\s+/, ''))
        .filter(Boolean)
        .slice(0, 6),
      specs: [
        { name: 'Category', value: firstCategory(product) },
        { name: 'Availability', value: product.quantity > 0 ? 'In Stock' : 'Out of Stock' },
      ],
      inStock: product.quantity > 0,
      bundleOffers: [],
    };
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('not found')) {
      return null;
    }
    throw error;
  }
}

export async function getBDBuyProductDetails(slugs: string[]) {
  const uniqueSlugs = [...new Set(slugs.map((slug) => slug.trim()).filter(Boolean))];
  const products = await Promise.all(uniqueSlugs.map((slug) => getBDBuyProductDetail(slug)));

  return products.filter((product): product is StorefrontProductDetail => Boolean(product));
}

export async function createBDBuyPartnerOrder(payload: PartnerOrderPayload) {
  return partnerFetch<{ created: boolean; order: PartnerOrder }>(
    '/api/wowmall/orders',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export async function getBDBuyPartnerOrder(orderNumber: string) {
  const params = new URLSearchParams({ orderNumber, limit: '1' });
  const data = await partnerFetch<{ orders: PartnerOrder[] }>(
    '/api/wowmall/orders',
    {},
    params,
  );
  return data.orders[0] ?? null;
}
