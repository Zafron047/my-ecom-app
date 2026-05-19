import { prisma } from '@/lib/prisma';
import { toVariantImageUrl, type ImageVariantSize } from '@/lib/image-variants';
import type {
  StorefrontCatalogProduct,
  StorefrontHomepageSection,
  StorefrontProductDetail,
} from '@/lib/storefront-types';

type ProductWithRelations = Awaited<ReturnType<typeof getStorefrontProducts>>[number];

async function getStorefrontProducts() {
  return prisma.product.findMany({
    where: {
      status: 'active',
    },
    include: {
      categories: {
        include: {
          category: {
            select: {
              name: true,
            },
          },
        },
        take: 1,
      },
      images: {
        orderBy: [
          {
            isPrimary: 'desc',
          },
          {
            sortOrder: 'asc',
          },
        ],
      },
      specifications: {
        orderBy: {
          sortOrder: 'asc',
        },
        take: 8,
      },
      variants: {
        where: {
          isActive: true,
        },
        orderBy: {
          sortOrder: 'asc',
        },
        include: {
          variantImages: {
            orderBy: {
              sortOrder: 'asc',
            },
          },
          globalBundleOfferLinks: {
            include: {
              bundleOffer: {
                include: {
                  variants: {
                    select: {
                      variantId: true,
                    },
                  },
                },
              },
            },
            where: {
              bundleOffer: {
                isActive: true,
                OR: [
                  { startsAt: null },
                  { startsAt: { lte: new Date() } },
                ],
                AND: [
                  {
                    OR: [
                      { endsAt: null },
                      { endsAt: { gte: new Date() } },
                    ],
                  },
                ],
              },
            },
          },
        },
      },
      tags: {
        include: {
          tag: {
            select: {
              name: true,
              slug: true,
            },
          },
        },
      },
      bundleOffers: {
        where: {
          isActive: true,
        },
        orderBy: {
          sortOrder: 'asc',
        },
        include: {
          variants: {
            select: {
              variantId: true,
            },
          },
        },
      },
    },
    orderBy: {
      updatedAt: 'desc',
    },
    take: 200,
  });
}

function getCategoryName(product: ProductWithRelations) {
  return product.categories[0]?.category.name ?? 'Uncategorized';
}

function getPrimaryImage(product: ProductWithRelations) {
  const imageFromGallery = product.images[0]?.storagePath;
  if (imageFromGallery) return imageFromGallery;

  const imageFromVariant = product.variants.find((variant) => variant.imagePath)?.imagePath;
  return imageFromVariant ?? '';
}

function toSizedImage(imageUrl: string, size: ImageVariantSize) {
  return imageUrl ? toVariantImageUrl(imageUrl, size) : '';
}

function toSizedImages(imageUrls: string[], size: ImageVariantSize) {
  return [
    ...new Set(
      imageUrls
        .filter((imageUrl) => Boolean(imageUrl && imageUrl.trim()))
        .map((imageUrl) => toSizedImage(imageUrl, size)),
    ),
  ];
}

function getPricing(product: ProductWithRelations) {
  if (product.variants.length === 0) {
    return {
      price: 0,
      salePrice: undefined as number | undefined,
    };
  }

  const priceNumbers = product.variants.map((variant) => variant.price.toNumber());
  const currentPrice = Math.min(...priceNumbers);

  const saleCandidates = product.variants
    .filter(
      (variant) =>
        variant.compareAtPrice &&
        variant.compareAtPrice.toNumber() > variant.price.toNumber(),
    )
    .map((variant) => ({
      original: variant.compareAtPrice!.toNumber(),
      sale: variant.price.toNumber(),
    }));

  if (saleCandidates.length > 0) {
    const bestSale = saleCandidates.sort((a, b) => a.sale - b.sale)[0];
    return {
      price: bestSale.original,
      salePrice: bestSale.sale,
    };
  }

  return {
    price: currentPrice,
    salePrice: undefined as number | undefined,
  };
}

function toVariantRows(product: ProductWithRelations, imageSize: ImageVariantSize) {
  const primaryImage = getPrimaryImage(product);

  return product.variants.map((variant) => {
    const basePrice = variant.price.toNumber();
    const compareAt = variant.compareAtPrice?.toNumber();
    const hasVariantSale = typeof compareAt === 'number' && compareAt > basePrice;
    const variantImageList =
      variant.variantImages.length > 0
        ? variant.variantImages.map((item) => item.imagePath)
        : variant.imagePath
          ? [variant.imagePath]
          : [];
    const sizedVariantImages = toSizedImages(variantImageList, imageSize);

    return {
      id: variant.id,
      color: variant.color?.trim() || '',
      ...(variant.colorHex?.trim() ? { colorHex: variant.colorHex.trim() } : {}),
      size: variant.size?.trim() || '',
      price: hasVariantSale ? compareAt : basePrice,
      ...(hasVariantSale ? { salePrice: basePrice } : {}),
      image: toSizedImage(variant.imagePath || primaryImage, imageSize),
      ...(sizedVariantImages.length > 0 ? { images: sizedVariantImages } : {}),
    };
  });
}

function toBundleOffers(product: ProductWithRelations, imageSize: ImageVariantSize) {
  const globalBundleOffers = [
    ...new Map(
      product.variants
        .flatMap((variant) =>
          variant.globalBundleOfferLinks.map((link) => link.bundleOffer),
        )
        .map((offer) => [offer.id, offer] as const),
    ).values(),
  ];

  return product.bundleOffers.map((offer) => ({
    id: offer.id,
    title: offer.title?.trim() || 'Bundle Offer',
    image: toSizedImage(offer.imagePath || '', imageSize),
    minTotalQty: offer.minTotalQty,
    discountPercent: offer.discountPercent.toNumber(),
    variantIds: offer.variants.map((item) => item.variantId),
    isActive: offer.isActive,
  })).concat(
    globalBundleOffers.map((offer) => ({
      id: offer.id,
      title: offer.title.trim() || 'Bundle Offer',
      image: toSizedImage(offer.imagePath || '', imageSize),
      minTotalQty: offer.minTotalQty,
      discountPercent: offer.discountPercent.toNumber(),
      variantIds: offer.variants.map((item) => item.variantId),
      isActive: offer.isActive,
    })),
  );
}

function toCatalogProduct(product: ProductWithRelations): StorefrontCatalogProduct {
  const { price, salePrice } = getPricing(product);
  const hasSale = typeof salePrice === 'number' && salePrice < price;
  const galleryImages = product.images.map((image) => image.storagePath);
  const primaryImage = getPrimaryImage(product);
  const images = toSizedImages([...galleryImages, primaryImage], 'thumb');

  return {
    id: product.id,
    name: product.name,
    createdAt: product.createdAt.toISOString(),
    price,
    ...(hasSale ? { salePrice } : {}),
    image: toSizedImage(primaryImage, 'thumb'),
    images: images.length > 0 ? images : [toSizedImage(primaryImage, 'thumb')],
    category: getCategoryName(product),
    tags: product.tags.flatMap((row) => [row.tag.slug, row.tag.name]),
    hasActiveBundleOffer: product.hasActiveBundleOffer,
    ...(product.bundleMinTotalQty
      ? { bundleMinTotalQty: product.bundleMinTotalQty }
      : {}),
    ...(product.bundleDiscountPercent
      ? { bundleDiscountPercent: product.bundleDiscountPercent.toNumber() }
      : {}),
    ...(product.bundleDisplayText ? { bundleDisplayText: product.bundleDisplayText } : {}),
    ...(hasSale ? { badge: 'Sale', superSale: true } : {}),
    variants: toVariantRows(product, 'thumb'),
    bundleOffers: toBundleOffers(product, 'thumb'),
  };
}

export async function getStorefrontCatalog() {
  const products = await getStorefrontProducts();
  const catalogProducts = products.map(toCatalogProduct);
  const homepageSectionDelegate = (prisma as { homepageSection?: unknown })
    .homepageSection as
    | {
        findMany: (args: unknown) => Promise<
          {
            id: string;
            title: string;
            eyebrow: string | null;
            variant: 'default' | 'sale';
            layout: 'grid' | 'carousel';
            sourceType: 'latest' | 'super_sale' | 'category' | 'tag';
            sourceValue: string | null;
            products: { productId: string }[];
            productLimit: number;
            displayOrder: number;
            ctaLabel: string | null;
            ctaHref: string | null;
          }[]
        >;
      }
    | undefined;
  const homepageSections = homepageSectionDelegate
    ? await homepageSectionDelegate.findMany({
        orderBy: [
          {
            displayOrder: 'asc',
          },
          {
            createdAt: 'asc',
          },
        ],
        where: {
          isActive: true,
        },
        include: {
          products: {
            orderBy: {
              assignedAt: 'asc',
            },
            select: {
              productId: true,
            },
          },
        },
      })
    : [];
  const activeCategories = await prisma.category.findMany({
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
    orderBy: {
      name: 'asc',
    },
    select: {
      name: true,
      imagePath: true,
    },
  });

  return {
    products: catalogProducts,
    homepageSections:
      homepageSections.length > 0
        ? homepageSections.map(
            (section): StorefrontHomepageSection => ({
              id: section.id,
              title: section.title,
              ...(section.eyebrow ? { eyebrow: section.eyebrow } : {}),
              variant: section.variant,
              layout: section.layout,
              sourceType: section.sourceType,
              ...(section.sourceValue ? { sourceValue: section.sourceValue } : {}),
              productIds: section.products.map((row) => row.productId),
              productLimit: section.productLimit,
              displayOrder: section.displayOrder,
              ...(section.ctaLabel ? { ctaLabel: section.ctaLabel } : {}),
              ...(section.ctaHref ? { ctaHref: section.ctaHref } : {}),
            }),
          )
        : [
            {
              id: 'default-featured',
              title: 'Featured Products',
              eyebrow: 'Fresh Picks',
              variant: 'default',
              layout: 'grid',
              sourceType: 'latest',
              productLimit: 6,
              displayOrder: 1,
            },
            {
              id: 'default-super-sale',
              title: 'Super Sale',
              eyebrow: 'Limited-Time Offers',
              variant: 'sale',
              layout: 'grid',
              sourceType: 'super_sale',
              productLimit: 5,
              displayOrder: 2,
              ctaLabel: 'Shop all deals',
              ctaHref: '/collections/super-sale',
            },
          ],
    categories: ['All', ...activeCategories.map((category) => category.name)],
    categoryThumbnails: Object.fromEntries(
      activeCategories.map((category) => [
        category.name,
        toSizedImage(category.imagePath || '', 'thumb'),
      ]),
    ),
  };
}

export async function getStorefrontProductDetailById(productId: string) {
  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      status: 'active',
    },
    include: {
      categories: {
        include: {
          category: {
            select: {
              name: true,
            },
          },
        },
        take: 1,
      },
      images: {
        orderBy: [
          {
            isPrimary: 'desc',
          },
          {
            sortOrder: 'asc',
          },
        ],
      },
      specifications: {
        orderBy: {
          sortOrder: 'asc',
        },
        take: 10,
      },
      variants: {
        where: {
          isActive: true,
        },
        orderBy: {
          sortOrder: 'asc',
        },
        include: {
          variantImages: {
            orderBy: {
              sortOrder: 'asc',
            },
          },
          globalBundleOfferLinks: {
            include: {
              bundleOffer: {
                include: {
                  variants: {
                    select: {
                      variantId: true,
                    },
                  },
                },
              },
            },
            where: {
              bundleOffer: {
                isActive: true,
                OR: [
                  { startsAt: null },
                  { startsAt: { lte: new Date() } },
                ],
                AND: [
                  {
                    OR: [
                      { endsAt: null },
                      { endsAt: { gte: new Date() } },
                    ],
                  },
                ],
              },
            },
          },
        },
      },
      tags: {
        include: {
          tag: {
            select: {
              name: true,
              slug: true,
            },
          },
        },
      },
      bundleOffers: {
        where: {
          isActive: true,
        },
        orderBy: {
          sortOrder: 'asc',
        },
        include: {
          variants: {
            select: {
              variantId: true,
            },
          },
        },
      },
    },
  });

  if (!product) return null;

  const catalogBase = toCatalogProduct(product);
  const galleryImages = product.images.map((image) => image.storagePath);
  const fallbackImages = product.variants
    .map((variant) => variant.imagePath)
    .filter((imagePath): imagePath is string => Boolean(imagePath));
  const images = toSizedImages([...galleryImages, ...fallbackImages, getPrimaryImage(product)], 'detail').filter(
    Boolean,
  );

  const stock = product.variants.reduce(
    (total, variant) => total + variant.stockQuantity,
    0,
  );
  const description =
    product.description ||
    product.shortDescription ||
    'Discover this trending product from our current catalog.';
  const benefits = description
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-*\u2022]\s+/, ''))
    .filter(Boolean)
    .slice(0, 6);

  const specs = product.specifications.map((specification) => ({
    name: specification.name,
    value: specification.value,
  }));
  const bundleOffers = toBundleOffers(product, 'thumb');

  return {
    ...catalogBase,
    imageVersion: product.updatedAt.getTime(),
    image: toSizedImage(getPrimaryImage(product), 'detail'),
    images,
    category: getCategoryName(product),
    description,
    benefits:
      benefits.length > 0
        ? benefits
        : [
            'Trending product curated from our active catalog',
            'Quality-focused and value-friendly pricing',
            'Suitable for regular daily use',
          ],
    specs:
      specs.length > 0
        ? specs
        : [
            { name: 'Category', value: getCategoryName(product) },
            { name: 'Availability', value: stock > 0 ? 'In Stock' : 'Out of Stock' },
          ],
    bundleOffers,
    variants: toVariantRows(product, 'detail'),
    inStock: stock > 0,
    rating: 4.5,
    reviews: 124,
  } satisfies StorefrontProductDetail;
}
