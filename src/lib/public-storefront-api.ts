import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { toVariantImageUrl } from '@/lib/image-variants';
import type {
  CategoryDTO,
  ProductDTO,
  ProductListQueryDTO,
  ProductVariantDTO,
  PublicStorefrontSort,
} from '@/lib/public-storefront-types';

export const PUBLIC_PRODUCT_DEFAULT_LIMIT = 24;
export const PUBLIC_PRODUCT_MAX_LIMIT = 50;

const validSorts = new Set<PublicStorefrontSort>([
  'newest',
  'oldest',
  'name_asc',
  'price_asc',
  'price_desc',
]);

export class PublicStorefrontValidationError extends Error {
  readonly code = 'VALIDATION_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'PublicStorefrontValidationError';
  }
}

function parsePositiveInteger(
  value: string | null,
  fallback: number,
  field: string,
) {
  if (!value) return fallback;
  if (!/^\d+$/.test(value)) {
    throw new PublicStorefrontValidationError(`${field} must be a positive integer.`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new PublicStorefrontValidationError(`${field} must be a positive integer.`);
  }

  return parsed;
}

function parseOptionalMoney(value: string | null, field: string) {
  if (!value) return undefined;
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new PublicStorefrontValidationError(`${field} must be a non-negative number.`);
  }

  return parsed;
}

function parseOptionalBoolean(value: string | null, field: string) {
  if (!value) return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;

  throw new PublicStorefrontValidationError(`${field} must be true or false.`);
}

function parseOptionalText(value: string | null, field: string, maxLength: number) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > maxLength) {
    throw new PublicStorefrontValidationError(
      `${field} must be ${maxLength} characters or fewer.`,
    );
  }

  return trimmed;
}

export function parseProductListQuery(searchParams: URLSearchParams): ProductListQueryDTO {
  const page = parsePositiveInteger(searchParams.get('page'), 1, 'page');
  const requestedLimit = parsePositiveInteger(
    searchParams.get('limit'),
    PUBLIC_PRODUCT_DEFAULT_LIMIT,
    'limit',
  );
  const limit = Math.min(requestedLimit, PUBLIC_PRODUCT_MAX_LIMIT);
  const sortParam = searchParams.get('sort')?.trim() || 'newest';

  if (!validSorts.has(sortParam as PublicStorefrontSort)) {
    throw new PublicStorefrontValidationError(
      `sort must be one of ${Array.from(validSorts).join(', ')}.`,
    );
  }

  const minPrice = parseOptionalMoney(searchParams.get('minPrice'), 'minPrice');
  const maxPrice = parseOptionalMoney(searchParams.get('maxPrice'), 'maxPrice');

  if (
    typeof minPrice === 'number' &&
    typeof maxPrice === 'number' &&
    minPrice > maxPrice
  ) {
    throw new PublicStorefrontValidationError(
      'minPrice must be less than or equal to maxPrice.',
    );
  }

  return {
    page,
    limit,
    category: parseOptionalText(searchParams.get('category'), 'category', 120),
    search: parseOptionalText(searchParams.get('search'), 'search', 100),
    sort: sortParam as PublicStorefrontSort,
    minPrice,
    maxPrice,
    inStock: parseOptionalBoolean(searchParams.get('inStock'), 'inStock'),
  };
}

const productSelect = {
  name: true,
  slug: true,
  price: true,
  salePrice: true,
  seoTitle: true,
  seoDescription: true,
  shortDescription: true,
  description: true,
  categories: {
    where: {
      category: {
        isActive: true,
      },
    },
    select: {
      category: {
        select: {
          name: true,
          slug: true,
          description: true,
          imagePath: true,
        },
      },
    },
  },
  images: {
    orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
    select: {
      storagePath: true,
      altText: true,
      isPrimary: true,
    },
  },
  variants: {
    where: {
      isActive: true,
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      sku: true,
      color: true,
      colorHex: true,
      size: true,
      price: true,
      compareAtPrice: true,
      stockQuantity: true,
      imagePath: true,
      inventoryBatches: {
        where: {
          remainingQuantity: { gt: 0 },
        },
        orderBy: [{ receivedAt: 'asc' }],
        select: {
          batchNumber: true,
          remainingQuantity: true,
          unitCost: true,
          receivedAt: true,
          status: true,
        },
      },
      variantImages: {
        orderBy: { sortOrder: 'asc' },
        select: {
          imagePath: true,
        },
      },
    },
  },
} satisfies Prisma.ProductSelect;

type PublicProductRow = Prisma.ProductGetPayload<{ select: typeof productSelect }>;

function toNumber(value: Prisma.Decimal | null | undefined) {
  return value?.toNumber();
}

function toSizedImage(
  imageUrl: string | null | undefined,
  size: 'thumb' | 'detail',
) {
  return imageUrl ? toVariantImageUrl(imageUrl, size) : undefined;
}

function toProductImages(
  product: PublicProductRow,
  size: 'thumb' | 'detail',
) {
  const productImages = product.images
    .map((image) => ({
      url: toSizedImage(image.storagePath, size) ?? '',
      altText: image.altText,
      isPrimary: image.isPrimary,
    }))
    .filter((image) => image.url);

  if (productImages.length > 0) return productImages;

  const fallbackVariantImage = product.variants.find((variant) => variant.imagePath)?.imagePath;
  const fallbackUrl = toSizedImage(fallbackVariantImage, size);

  return fallbackUrl
    ? [
        {
          url: fallbackUrl,
          altText: product.name,
          isPrimary: true,
        },
      ]
    : [];
}

function toCategoryDTO(
  category: PublicProductRow['categories'][number]['category'],
  includeDescription = true,
): CategoryDTO {
  return {
    name: category.name,
    slug: category.slug,
    ...(includeDescription && category.description
      ? { description: category.description }
      : {}),
    ...(category.imagePath ? { image: toVariantImageUrl(category.imagePath, 'thumb') } : {}),
  };
}

function getProductPricing(product: PublicProductRow) {
  const variantPrices = product.variants.map((variant) => variant.price.toNumber());
  const variantCompareAtPrices = product.variants
    .map((variant) => toNumber(variant.compareAtPrice))
    .filter((price): price is number => typeof price === 'number');

  if (variantPrices.length > 0) {
    const minPrice = Math.min(...variantPrices);
    const maxPrice = Math.max(...variantPrices);
    const minCompareAtPrice =
      variantCompareAtPrices.length > 0
        ? Math.min(...variantCompareAtPrices)
        : undefined;
    const maxCompareAtPrice =
      variantCompareAtPrices.length > 0
        ? Math.max(...variantCompareAtPrices)
        : undefined;

    return {
      minPrice,
      maxPrice,
      ...(typeof minCompareAtPrice === 'number' ? { minCompareAtPrice } : {}),
      ...(typeof maxCompareAtPrice === 'number' ? { maxCompareAtPrice } : {}),
      hasRange: minPrice !== maxPrice,
      hasDiscount: product.variants.some((variant) => {
        const compareAtPrice = toNumber(variant.compareAtPrice);
        return typeof compareAtPrice === 'number' && compareAtPrice > variant.price.toNumber();
      }),
    };
  }

  const basePrice = toNumber(product.price) ?? 0;
  const salePrice = toNumber(product.salePrice);
  const hasDiscount = typeof salePrice === 'number' && salePrice < basePrice;
  const finalPrice = hasDiscount ? salePrice : salePrice ?? basePrice;

  return {
    minPrice: finalPrice,
    maxPrice: finalPrice,
    ...(hasDiscount ? { minCompareAtPrice: basePrice, maxCompareAtPrice: basePrice } : {}),
    hasRange: false,
    hasDiscount,
  };
}

function toVariantDTO(
  variant: PublicProductRow['variants'][number],
  fallbackImages: ReturnType<typeof toProductImages>,
  includeInventoryBatches: boolean,
): ProductVariantDTO {
  const currentPrice = variant.price.toNumber();
  const compareAtPrice = toNumber(variant.compareAtPrice);
  const hasDiscount = typeof compareAtPrice === 'number' && compareAtPrice > currentPrice;
  const imageUrls = [
    ...new Set(
      [variant.imagePath, ...variant.variantImages.map((item) => item.imagePath)]
        .map((imagePath) => toSizedImage(imagePath, 'thumb'))
        .filter((imagePath): imagePath is string => Boolean(imagePath)),
    ),
  ];
  const images =
    imageUrls.length > 0
      ? imageUrls.map((url, index) => ({
          url,
          altText: [variant.color, variant.size].filter(Boolean).join(' ') || null,
          isPrimary: index === 0,
        }))
      : fallbackImages.slice(0, 1);

  return {
    id: variant.id,
    sku: variant.sku,
    ...(variant.color ? { color: variant.color } : {}),
    ...(variant.colorHex ? { colorHex: variant.colorHex } : {}),
    ...(variant.size ? { size: variant.size } : {}),
    price: currentPrice,
    ...(hasDiscount ? { compareAtPrice } : {}),
    quantity: variant.stockQuantity,
    images,
    ...(includeInventoryBatches
      ? {
          inventoryBatches: variant.inventoryBatches.map((batch) => ({
            batchNumber: batch.batchNumber,
            quantity: batch.remainingQuantity,
            unitCost: batch.unitCost.toNumber(),
            status: batch.status,
            receivedAt: batch.receivedAt.toISOString(),
          })),
        }
      : {}),
  };
}

function toProductDTO(
  product: PublicProductRow,
  options: { includeDetailFields: boolean },
): ProductDTO {
  const categories = product.categories.map((row) =>
    toCategoryDTO(row.category, options.includeDetailFields),
  );
  const pricing = getProductPricing(product);
  const quantity = product.variants.reduce(
    (total, variant) => total + variant.stockQuantity,
    0,
  );
  const images = toProductImages(
    product,
    options.includeDetailFields ? 'detail' : 'thumb',
  );
  const variantFallbackImages = toProductImages(product, 'thumb');

  return {
    title: product.name,
    slug: product.slug,
    ...(product.shortDescription ? { shortDescription: product.shortDescription } : {}),
    ...(options.includeDetailFields && product.description
      ? { description: product.description }
      : {}),
    pricing,
    quantity,
    categories,
    images,
    variants: product.variants.map((variant) =>
      toVariantDTO(variant, variantFallbackImages, options.includeDetailFields),
    ),
    ...(options.includeDetailFields && (product.seoTitle || product.seoDescription)
      ? {
          seo: {
            ...(product.seoTitle ? { title: product.seoTitle } : {}),
            ...(product.seoDescription ? { description: product.seoDescription } : {}),
          },
        }
      : {}),
  };
}

function buildProductWhere(query: ProductListQueryDTO): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [{ status: 'active' }];

  if (query.category) {
    and.push({
      categories: {
        some: {
          category: {
            isActive: true,
            slug: query.category,
          },
        },
      },
    });
  }

  if (query.search) {
    and.push({
      OR: [
        { name: { contains: query.search, mode: 'insensitive' } },
        { slug: { contains: query.search, mode: 'insensitive' } },
        { shortDescription: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ],
    });
  }

  if (typeof query.inStock === 'boolean') {
    and.push(
      query.inStock
        ? { variants: { some: { isActive: true, stockQuantity: { gt: 0 } } } }
        : { variants: { none: { isActive: true, stockQuantity: { gt: 0 } } } },
    );
  }

  if (typeof query.minPrice === 'number' || typeof query.maxPrice === 'number') {
    const priceRange = {
      ...(typeof query.minPrice === 'number' ? { gte: query.minPrice } : {}),
      ...(typeof query.maxPrice === 'number' ? { lte: query.maxPrice } : {}),
    };

    and.push({
      OR: [
        { price: priceRange },
        { salePrice: priceRange },
        { variants: { some: { isActive: true, price: priceRange } } },
      ],
    });
  }

  return { AND: and };
}

function productOrderBy(sort: PublicStorefrontSort): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case 'oldest':
      return [{ updatedAt: 'asc' }, { name: 'asc' }];
    case 'name_asc':
      return [{ name: 'asc' }];
    case 'price_asc':
      return [{ price: 'asc' }, { name: 'asc' }];
    case 'price_desc':
      return [{ price: 'desc' }, { name: 'asc' }];
    case 'newest':
    default:
      return [{ updatedAt: 'desc' }, { name: 'asc' }];
  }
}

export async function getPublicProducts(query: ProductListQueryDTO) {
  const where = buildProductWhere(query);
  const skip = (query.page - 1) * query.limit;
  const [products, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      orderBy: productOrderBy(query.sort),
      skip,
      take: query.limit,
      select: productSelect,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    products: products.map((product) =>
      toProductDTO(product, { includeDetailFields: false }),
    ),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function getPublicProductBySlug(slug: string) {
  const product = await prisma.product.findFirst({
    where: {
      slug,
      status: 'active',
    },
    select: productSelect,
  });

  return product ? toProductDTO(product, { includeDetailFields: true }) : null;
}

export async function getPublicCategories() {
  const categories = await prisma.category.findMany({
    where: {
      isActive: true,
      products: {
        some: {
          product: {
            status: 'active',
          },
        },
      },
    },
    orderBy: { name: 'asc' },
    select: {
      name: true,
      slug: true,
      description: true,
      imagePath: true,
      _count: {
        select: {
          products: {
            where: {
              product: {
                status: 'active',
              },
            },
          },
        },
      },
    },
  });

  return categories.map((category): CategoryDTO => ({
    name: category.name,
    slug: category.slug,
    ...(category.description ? { description: category.description } : {}),
    ...(category.imagePath ? { image: toVariantImageUrl(category.imagePath, 'thumb') } : {}),
    productCount: category._count.products,
  }));
}

export async function getPublicCategoryBySlug(slug: string) {
  const category = await prisma.category.findFirst({
    where: {
      slug,
      isActive: true,
      products: {
        some: {
          product: {
            status: 'active',
          },
        },
      },
    },
    select: {
      name: true,
      slug: true,
      description: true,
      imagePath: true,
      _count: {
        select: {
          products: {
            where: {
              product: {
                status: 'active',
              },
            },
          },
        },
      },
    },
  });

  if (!category) return null;

  return {
    name: category.name,
    slug: category.slug,
    ...(category.description ? { description: category.description } : {}),
    ...(category.imagePath ? { image: toVariantImageUrl(category.imagePath, 'thumb') } : {}),
    productCount: category._count.products,
  } satisfies CategoryDTO;
}
