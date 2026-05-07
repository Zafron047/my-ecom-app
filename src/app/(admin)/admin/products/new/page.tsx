import ProductForm from '@/components/admin/ProductForm';
import { requireAdminPermission, requireAdminRole } from '@/lib/admin-session';
import { prisma } from '@/lib/prisma';
import { createProduct } from '../actions';

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
      action={createProduct}
      categories={categories}
      brands={brands}
      submitLabel="Create Product"
    />
  );
}
