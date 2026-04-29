import { prisma } from '@/lib/prisma';
import { toVariantImageUrl } from '@/lib/image-variants';
import type {
  StorefrontCatalogProduct,
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
          createdAt: 'asc',
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

function toCatalogProduct(product: ProductWithRelations): StorefrontCatalogProduct {
  const { price, salePrice } = getPricing(product);
  const hasSale = typeof salePrice === 'number' && salePrice < price;

  const variantRows = product.variants.map((variant) => {
    const basePrice = variant.price.toNumber();
    const compareAt = variant.compareAtPrice?.toNumber();
    const hasVariantSale = typeof compareAt === 'number' && compareAt > basePrice;

    return {
      id: variant.id,
      color: variant.color?.trim() || 'Standard',
      size: variant.size?.trim() || 'Standard',
      price: hasVariantSale ? compareAt : basePrice,
      ...(hasVariantSale ? { salePrice: basePrice } : {}),
      image: toVariantImageUrl(
        variant.imagePath || getPrimaryImage(product),
        'thumb',
      ),
    };
  });

  return {
    id: product.id,
    name: product.name,
    price,
    ...(hasSale ? { salePrice } : {}),
    image: toVariantImageUrl(getPrimaryImage(product), 'thumb'),
    category: getCategoryName(product),
    ...(hasSale ? { badge: 'Sale', superSale: true } : {}),
    variants: variantRows,
  };
}

export async function getStorefrontCatalog() {
  const products = await getStorefrontProducts();
  const catalogProducts = products.map(toCatalogProduct);
  const categorySet = new Set(catalogProducts.map((product) => product.category));

  return {
    products: catalogProducts,
    categories: ['All', ...[...categorySet].sort((a, b) => a.localeCompare(b))],
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
          createdAt: 'asc',
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
  const images = [...new Set([...galleryImages, ...fallbackImages, catalogBase.image])].filter(
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

  return {
    ...catalogBase,
    images: images.length > 0 ? images : [''],
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
    inStock: stock > 0,
    rating: 4.5,
    reviews: 124,
  } satisfies StorefrontProductDetail;
}
