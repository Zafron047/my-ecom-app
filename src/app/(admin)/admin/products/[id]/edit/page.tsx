import { notFound } from 'next/navigation';
import ProductForm from '@/components/admin/ProductForm';
import { requireAdminPermission } from '@/lib/admin-session';
import { prisma } from '@/lib/prisma';
import { updateProduct } from '../../actions';

type EditProductPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function decimalToString(value: { toString: () => string } | null) {
  return value?.toString() ?? '';
}

function normalizeImagePathForMatch(path: string | null) {
  if (!path) return null;
  const withoutQuery = path.split('?')[0] ?? '';
  return withoutQuery.replace(/-(thumb|detail|zoom)(\.[a-z0-9]+)$/i, '$2');
}

async function safeUpdateProduct(formData: FormData) {
  'use server';

  try {
    await updateProduct(formData);
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'digest' in error &&
      typeof (error as { digest?: unknown }).digest === 'string' &&
      (error as { digest: string }).digest.startsWith('NEXT_REDIRECT')
    ) {
      throw error;
    }

    return {
      error:
        error instanceof Error && error.message
          ? error.message
          : 'Failed to save product. Please try again.',
    };
  }
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { id } = await params;
  await requireAdminPermission(`/admin/products/${id}/edit`, 'products.write');

  const [product, categories, brands, productNavigationRows] = await Promise.all([
    prisma.product.findUnique({
      include: {
        categories: {
          select: {
            categoryId: true,
          },
        },
        variants: {
          orderBy: {
            sortOrder: 'asc',
          },
          select: {
            id: true,
            sku: true,
            color: true,
            colorHex: true,
            size: true,
            imagePath: true,
            variantImages: {
              orderBy: {
                sortOrder: 'asc',
              },
              select: {
                imagePath: true,
              },
            },
            price: true,
            compareAtPrice: true,
            isActive: true,
          },
        },
        images: {
          orderBy: {
            sortOrder: 'asc',
          },
          select: {
            altText: true,
            id: true,
            storagePath: true,
          },
        },
        specifications: {
          orderBy: {
            sortOrder: 'asc',
          },
          select: {
            id: true,
            name: true,
            value: true,
          },
        },
      },
      where: { id },
    }),
    prisma.category.findMany({
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        name: true,
      },
      where: {
        isActive: true,
      },
    }),
    prisma.brand.findMany({
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        name: true,
      },
      where: {
        isActive: true,
      },
    }),
    prisma.product.findMany({
      orderBy: [
        {
          updatedAt: 'desc',
        },
        {
          id: 'asc',
        },
      ],
      select: {
        id: true,
      },
      take: 500,
    }),
  ]);

  if (!product) {
    notFound();
  }

  const currentProductIndex = productNavigationRows.findIndex(
    (row) => row.id === product.id,
  );
  const productNavigation =
    currentProductIndex >= 0
      ? {
          previousId: productNavigationRows[currentProductIndex - 1]?.id ?? null,
          nextId: productNavigationRows[currentProductIndex + 1]?.id ?? null,
        }
      : {
          previousId: null,
          nextId: null,
        };

  return (
    <ProductForm
      key={product.updatedAt.toISOString()}
      action={safeUpdateProduct}
      categories={categories}
      brands={brands}
      productNavigation={productNavigation}
      product={{
        id: product.id,
        name: product.name,
        slug: product.slug,
        images: product.images,
        shortDescription: product.shortDescription ?? '',
        description: product.description ?? '',
        brandId: product.brandId ?? '',
        seoTitle: product.seoTitle ?? '',
        seoDescription: product.seoDescription ?? '',
        status: product.status,
        categoryIds: product.categories.map((category) => category.categoryId),
        specifications: product.specifications.map((specification) => ({
          id: specification.id,
          name: specification.name,
          value: specification.value,
        })),
        bundleOffers: [],
        variants: product.variants.map((variant) => {
          const imagePathsFromVariant =
            variant.variantImages.length > 0
              ? variant.variantImages.map((item) => item.imagePath)
              : variant.imagePath
                ? [variant.imagePath]
                : [];
          const imageSelectionKeys = imagePathsFromVariant
            .map((imagePath) => {
              const normalizedVariantPath = normalizeImagePathForMatch(imagePath);
              const selectedImage = product.images.find(
                (image) =>
                  image.storagePath === imagePath ||
                  normalizeImagePathForMatch(image.storagePath) ===
                    normalizedVariantPath,
              );
              return selectedImage ? `existing:${selectedImage.id}` : '';
            })
            .filter(Boolean);

          return {
            id: variant.id,
            sku: variant.sku,
            color: variant.color ?? '',
            colorHex: variant.colorHex ?? '',
            imageSelection: imageSelectionKeys.join(','),
            size: variant.size ?? '',
            price: decimalToString(variant.price),
            compareAtPrice: decimalToString(variant.compareAtPrice),
            isActive: variant.isActive,
          };
        }),
      }}
      submitLabel="Update Product"
    />
  );
}
