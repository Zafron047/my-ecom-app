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

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { id } = await params;
  await requireAdminPermission(`/admin/products/${id}/edit`, 'products.write');

  const [product, categories] = await Promise.all([
    prisma.product.findUnique({
      include: {
        categories: {
          select: {
            categoryId: true,
          },
        },
        variants: {
          orderBy: {
            createdAt: 'asc',
          },
          select: {
            id: true,
            sku: true,
            color: true,
            size: true,
            imagePath: true,
            price: true,
            compareAtPrice: true,
            costPrice: true,
            stockQuantity: true,
            reorderLevel: true,
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
  ]);

  if (!product) {
    notFound();
  }

  return (
    <ProductForm
      action={updateProduct}
      categories={categories}
      product={{
        id: product.id,
        name: product.name,
        slug: product.slug,
        images: product.images,
        shortDescription: product.shortDescription ?? '',
        description: product.description ?? '',
        status: product.status,
        categoryIds: product.categories.map((category) => category.categoryId),
        specifications: product.specifications.map((specification) => ({
          id: specification.id,
          name: specification.name,
          value: specification.value,
        })),
        variants: product.variants.map((variant) => {
          const selectedImage = product.images.find(
            (image) => image.storagePath === variant.imagePath,
          );

          return {
            id: variant.id,
            sku: variant.sku,
            color: variant.color ?? '',
            imageSelection: selectedImage ? `existing:${selectedImage.id}` : '',
            size: variant.size ?? '',
            price: decimalToString(variant.price),
            compareAtPrice: decimalToString(variant.compareAtPrice),
            costPrice: decimalToString(variant.costPrice),
            stockQuantity: variant.stockQuantity.toString(),
            reorderLevel: variant.reorderLevel.toString(),
            isActive: variant.isActive,
          };
        }),
      }}
      submitLabel="Save Product"
    />
  );
}
