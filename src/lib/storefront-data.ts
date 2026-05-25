import { prisma } from '@/lib/prisma';
import { toVariantImageUrl, type ImageVariantSize } from '@/lib/image-variants';
import { unstable_cache } from 'next/cache';
import type {
  StorefrontBusinessProfile,
  StorefrontCatalogProduct,
  StorefrontHeroSlide,
  StorefrontHomepageSection,
  StorefrontProductDetail,
} from '@/lib/storefront-types';

export const STOREFRONT_REVALIDATE_SECONDS = 300;
const shouldBypassStorefrontCache =
  process.env.NEXT_DISABLE_STOREFRONT_CACHE === 'true';

type CatalogCardProduct = Awaited<ReturnType<typeof loadCatalogCardProducts>>[number];
type ProductDetailProduct = NonNullable<Awaited<ReturnType<typeof loadProductDetail>>>;
type StorefrontProductRow = CatalogCardProduct | ProductDetailProduct;
type AsyncStorefrontLoader<Args extends unknown[], Result> = (
  ...args: Args
) => Promise<Result>;

function cacheStorefrontLoader<Args extends unknown[], Result>(
  loader: AsyncStorefrontLoader<Args, Result>,
  keyParts: string[],
  options: NonNullable<Parameters<typeof unstable_cache>[2]>,
) {
  if (shouldBypassStorefrontCache) {
    return loader;
  }

  return unstable_cache(loader, keyParts, options) as AsyncStorefrontLoader<
    Args,
    Result
  >;
}

const defaultBusinessProfile: StorefrontBusinessProfile = {
  businessName: 'BDBuyEasy',
  tagline: 'EASY DEALS, EVERYDAY',
  logoAlt: 'BDBuyEasy logo',
  logoUrl: '/business-logo.png',
  metaDescription:
    'Shop home tools, kitchen finds, decor, and useful gadgets for easier everyday living.',
  metaTitle: 'BDBuyEasy - Practical Home & Kitchen Finds',
  websiteUrl: 'https://bdbuyeasy.com.bd',
};

export const defaultHeroSlides: StorefrontHeroSlide[] = [
  {
    id: 'default-trending-gadgets',
    imageUrl:
      'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1920&h=1080&fit=crop',
    title: 'Trending Gadgets & Daily Finds',
    subtitle: 'Useful home tools, kitchen finds, decor, and practical gadgets',
    ctaLabel: 'Shop Now',
    ctaHref: '/products',
    secondaryLabel: 'Explore More',
    secondaryHref: '#featured',
  },
  {
    id: 'default-home-upgrades',
    imageUrl:
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=1920&h=1080&fit=crop',
    title: 'Smart Home Upgrades',
    subtitle: 'Smart little upgrades that make your space more useful and fun',
    ctaLabel: 'Explore Home',
    ctaHref: '/products',
    secondaryLabel: 'Explore More',
    secondaryHref: '#featured',
  },
  {
    id: 'default-accessories',
    imageUrl:
      'https://images.unsplash.com/photo-1511556820780-d912e42b4980?w=1920&h=1080&fit=crop',
    title: 'Useful Finds For Every Room',
    subtitle:
      'Home tools, kitchen helpers, decor, and everyday gadgets worth keeping close',
    ctaLabel: 'Browse Bestsellers',
    ctaHref: '/products',
    secondaryLabel: 'Explore More',
    secondaryHref: '#featured',
  },
  {
    id: 'default-category-picks',
    imageUrl:
      'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1920&h=1080&fit=crop',
    title: 'Organized Picks For Daily Needs',
    subtitle:
      'Browse practical household finds across kitchen, cleaning, decor, and gadgets',
    ctaLabel: 'View Collection',
    ctaHref: '/products',
    secondaryLabel: 'Explore More',
    secondaryHref: '#featured',
  },
];

async function loadCatalogCardProducts() {
  return prisma.product.findMany({
    where: {
      status: 'active',
    },
    select: {
      id: true,
      name: true,
      price: true,
      salePrice: true,
      createdAt: true,
      hasActiveBundleOffer: true,
      bundleMinTotalQty: true,
      bundleDiscountPercent: true,
      bundleDisplayText: true,
      categories: {
        select: {
          category: {
            select: {
              name: true,
            },
          },
        },
        take: 1,
      },
      images: {
        select: {
          storagePath: true,
          isPrimary: true,
          sortOrder: true,
        },
        orderBy: {
          sortOrder: 'asc',
        },
      },
      variants: {
        where: {
          isActive: true,
        },
        orderBy: {
          sortOrder: 'asc',
        },
        select: {
          id: true,
          color: true,
          colorHex: true,
          size: true,
          price: true,
          compareAtPrice: true,
          stockQuantity: true,
          imagePath: true,
          variantImages: {
            select: {
              imagePath: true,
            },
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
        select: {
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
        select: {
          id: true,
          title: true,
          imagePath: true,
          minTotalQty: true,
          discountPercent: true,
          isActive: true,
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

function getCategoryName(product: StorefrontProductRow) {
  return product.categories[0]?.category.name ?? 'Uncategorized';
}

function getPrimaryImage(product: StorefrontProductRow) {
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

function getPricing(product: StorefrontProductRow) {
  if (product.variants.length === 0) {
    const productPrice = product.price?.toNumber() ?? 0;
    const productSalePrice = product.salePrice?.toNumber();
    return {
      price: productSalePrice && productSalePrice < productPrice
        ? productPrice
        : productSalePrice ?? productPrice,
      salePrice:
        productSalePrice && productSalePrice < productPrice
          ? productSalePrice
          : undefined,
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

function toVariantRows(product: StorefrontProductRow, imageSize: ImageVariantSize) {
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
      stockQuantity: variant.stockQuantity,
      image: toSizedImage(variant.imagePath || primaryImage, imageSize),
      ...(sizedVariantImages.length > 0 ? { images: sizedVariantImages } : {}),
    };
  });
}

function toBundleOffers(product: StorefrontProductRow, imageSize: ImageVariantSize) {
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

function toCatalogProduct(product: StorefrontProductRow): StorefrontCatalogProduct {
  const { price, salePrice } = getPricing(product);
  const hasSale = typeof salePrice === 'number' && salePrice < price;
  const isSoldOut =
    product.variants.length === 0 ||
    product.variants.every((variant) => variant.stockQuantity <= 0);
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
    ...(isSoldOut
      ? { badge: 'Sold Out' }
      : hasSale
        ? { badge: 'Sale', superSale: true }
        : {}),
    variants: toVariantRows(product, 'thumb'),
    bundleOffers: toBundleOffers(product, 'thumb'),
  };
}

export const getCatalogCards = cacheStorefrontLoader(
  async () => {
    const products = await loadCatalogCardProducts();
    return products.map(toCatalogProduct);
  },
  ['storefront-catalog-cards'],
  {
    revalidate: STOREFRONT_REVALIDATE_SECONDS,
    tags: ['storefront-catalog'],
  },
);

export const getHeaderSearchProducts = cacheStorefrontLoader(
  async () => {
    const products = await prisma.product.findMany({
      where: {
        status: 'active',
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 200,
      select: {
        id: true,
        name: true,
        images: {
          select: {
            storagePath: true,
            isPrimary: true,
            sortOrder: true,
          },
          orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
          take: 1,
        },
        variants: {
          where: {
            isActive: true,
          },
          select: {
            id: true,
            imagePath: true,
          },
        },
      },
    });

    return products.map((product) => ({
      id: product.id,
      name: product.name,
      image: toSizedImage(
        product.images[0]?.storagePath ||
          product.variants.find((variant) => variant.imagePath)?.imagePath ||
          '',
        'thumb',
      ),
      variantCount: product.variants.length,
    }));
  },
  ['storefront-header-search-products'],
  {
    revalidate: STOREFRONT_REVALIDATE_SECONDS,
    tags: ['storefront-catalog'],
  },
);

export const getHomepageSections = cacheStorefrontLoader(
  async () => {
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

    return homepageSections.length > 0
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
      : ([
          {
            id: 'default-featured',
            title: 'Featured Products',
            eyebrow: 'Useful Finds',
            variant: 'default',
            layout: 'carousel',
            sourceType: 'latest',
            productLimit: 6,
            displayOrder: 1,
          },
          {
            id: 'default-super-sale',
            title: "Today's Deals",
            eyebrow: 'Limited-Time Offers',
            variant: 'sale',
            layout: 'carousel',
            sourceType: 'super_sale',
            productLimit: 5,
            displayOrder: 2,
            ctaLabel: 'Shop all deals',
            ctaHref: '/collections/super-sale',
          },
        ] satisfies StorefrontHomepageSection[]);
  },
  ['storefront-homepage-sections'],
  {
    revalidate: STOREFRONT_REVALIDATE_SECONDS,
    tags: ['storefront-homepage-sections'],
  },
);

export const getHeroSlides = cacheStorefrontLoader(
  async () => {
    const heroSlideDelegate = (prisma as { heroSlide?: unknown }).heroSlide as
      | {
          findMany: (args: unknown) => Promise<
            {
              id: string;
              title: string;
              subtitle: string | null;
              imageUrl: string;
              ctaLabel: string | null;
              ctaHref: string | null;
              secondaryLabel: string | null;
              secondaryHref: string | null;
            }[]
          >;
        }
      | undefined;

    if (!heroSlideDelegate) return defaultHeroSlides;

    const slides = await heroSlideDelegate.findMany({
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      where: { isActive: true },
    });

    return slides.length > 0
      ? slides.map(
          (slide): StorefrontHeroSlide => ({
            id: slide.id,
            title: slide.title,
            ...(slide.subtitle ? { subtitle: slide.subtitle } : {}),
            imageUrl: slide.imageUrl,
            ...(slide.ctaLabel ? { ctaLabel: slide.ctaLabel } : {}),
            ...(slide.ctaHref ? { ctaHref: slide.ctaHref } : {}),
            ...(slide.secondaryLabel ? { secondaryLabel: slide.secondaryLabel } : {}),
            ...(slide.secondaryHref ? { secondaryHref: slide.secondaryHref } : {}),
          }),
        )
      : defaultHeroSlides;
  },
  ['storefront-hero-slides'],
  {
    revalidate: STOREFRONT_REVALIDATE_SECONDS,
    tags: ['storefront-hero-slides'],
  },
);

export const getBusinessProfile = cacheStorefrontLoader(
  async () => {
    const rows = await prisma.$queryRaw<
      {
        businessName: string;
        tagline: string | null;
        logoUrl: string | null;
        logoAlt: string | null;
        bannerUrl: string | null;
        bannerAlt: string | null;
        phone: string | null;
        email: string | null;
        address: string | null;
        facebookUrl: string | null;
        instagramUrl: string | null;
        websiteUrl: string | null;
        returnRefundPolicy: string | null;
        metaTitle: string | null;
        metaDescription: string | null;
        metaKeywords: string | null;
        ogImageUrl: string | null;
      }[]
    >`
      SELECT
        "businessName",
        "tagline",
        "logoUrl",
        "logoAlt",
        "bannerUrl",
        "bannerAlt",
        "phone",
        "email",
        "address",
        "facebookUrl",
        "instagramUrl",
        "websiteUrl",
        "returnRefundPolicy",
        "metaTitle",
        "metaDescription",
        "metaKeywords",
        "ogImageUrl"
      FROM "BusinessProfile"
      ORDER BY "updatedAt" DESC
      LIMIT 1
    `.catch(() => []);
    const profile = rows[0];

    if (!profile) return defaultBusinessProfile;

    return {
      businessName: profile.businessName || defaultBusinessProfile.businessName,
      tagline: profile.tagline || defaultBusinessProfile.tagline,
      logoAlt:
        profile.logoAlt ||
        `${profile.businessName || defaultBusinessProfile.businessName} logo`,
      logoUrl: profile.logoUrl || defaultBusinessProfile.logoUrl,
      ...(profile.bannerUrl ? { bannerUrl: profile.bannerUrl } : {}),
      ...(profile.bannerAlt ? { bannerAlt: profile.bannerAlt } : {}),
      ...(profile.phone ? { phone: profile.phone } : {}),
      ...(profile.email ? { email: profile.email } : {}),
      ...(profile.address ? { address: profile.address } : {}),
      ...(profile.facebookUrl ? { facebookUrl: profile.facebookUrl } : {}),
      ...(profile.instagramUrl ? { instagramUrl: profile.instagramUrl } : {}),
      ...(profile.websiteUrl ? { websiteUrl: profile.websiteUrl } : {}),
      ...(profile.returnRefundPolicy
        ? { returnRefundPolicy: profile.returnRefundPolicy }
        : {}),
      ...(profile.metaTitle ? { metaTitle: profile.metaTitle } : {}),
      ...(profile.metaDescription ? { metaDescription: profile.metaDescription } : {}),
      ...(profile.metaKeywords ? { metaKeywords: profile.metaKeywords } : {}),
      ...(profile.ogImageUrl ? { ogImageUrl: profile.ogImageUrl } : {}),
    } satisfies StorefrontBusinessProfile;
  },
  ['storefront-business-profile'],
  {
    revalidate: STOREFRONT_REVALIDATE_SECONDS,
    tags: ['storefront-business-profile'],
  },
);

export const getStorefrontCategories = cacheStorefrontLoader(
  async () => {
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
      categories: ['All', ...activeCategories.map((category) => category.name)],
      categoryThumbnails: Object.fromEntries(
        activeCategories.map((category) => [
          category.name,
          toSizedImage(category.imagePath || '', 'thumb'),
        ]),
      ),
    };
  },
  ['storefront-categories'],
  {
    revalidate: STOREFRONT_REVALIDATE_SECONDS,
    tags: ['storefront-categories'],
  },
);

export async function getStorefrontCatalog() {
  const [products, homepageSections, heroSlides, businessProfile, categoryData] =
    await Promise.all([
    getCatalogCards(),
    getHomepageSections(),
    getHeroSlides(),
    getBusinessProfile(),
    getStorefrontCategories(),
  ]);

  return {
    businessProfile,
    heroSlides: businessProfile.bannerUrl
      ? heroSlides.map((slide, index) =>
          index === 0 ? { ...slide, imageUrl: businessProfile.bannerUrl! } : slide,
        )
      : heroSlides,
    products,
    homepageSections,
    ...categoryData,
  };
}

async function loadProductDetail(productId: string) {
  return prisma.product.findFirst({
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
}

export const getProductDetail = cacheStorefrontLoader(
  async (productId: string) => {
    const product = await loadProductDetail(productId);
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
  },
  ['storefront-product-detail'],
  {
    revalidate: STOREFRONT_REVALIDATE_SECONDS,
    tags: ['storefront-products'],
  },
);

export async function getStorefrontProductDetailById(productId: string) {
  return getProductDetail(productId);
}

export async function getCartPricingLookup(
  productIds: string[],
  selectedVariantIds: string[],
) {
  return Promise.all([
    prisma.productVariant.findMany({
      where: {
        isActive: true,
        stockQuantity: { gt: 0 },
        ...(selectedVariantIds.length > 0
          ? { id: { in: selectedVariantIds } }
          : {}),
        product: {
          id: { in: productIds },
          status: 'active',
        },
      },
      select: {
        id: true,
        price: true,
        stockQuantity: true,
        productId: true,
        product: {
          select: {
            bundleOffers: {
              where: { isActive: true },
              orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
              select: {
                id: true,
                title: true,
                minTotalQty: true,
                discountPercent: true,
                isActive: true,
                variants: {
                  select: { variantId: true },
                },
              },
            },
          },
        },
      },
    }),
    selectedVariantIds.length > 0
      ? prisma.bundleOffer.findMany({
          where: {
            isActive: true,
            variants: {
              some: {
                variantId: { in: selectedVariantIds },
              },
            },
            OR: [{ startsAt: null }, { startsAt: { lte: new Date() } }],
            AND: [
              {
                OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }],
              },
            ],
          },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            variants: {
              select: { variantId: true },
            },
          },
        })
      : Promise.resolve([]),
  ]);
}
