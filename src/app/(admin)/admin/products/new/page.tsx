import ProductForm from '@/components/admin/ProductForm';
import { requireAdminPermission, requireAdminRole } from '@/lib/admin-session';
import { prisma } from '@/lib/prisma';
import { createProduct } from '../actions';

async function safeCreateProduct(formData: FormData) {
  'use server';

  try {
    return await createProduct(formData);
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

export default async function NewProductPage() {
  await requireAdminPermission('/admin/products/new', 'products.write');
  await requireAdminRole('/admin/products/new', ['admin']);

  const [categories, brands] = await Promise.all([
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
  ]);

  return (
    <ProductForm
      action={safeCreateProduct}
      categories={categories}
      brands={brands}
      submitLabel="Create Product"
    />
  );
}
