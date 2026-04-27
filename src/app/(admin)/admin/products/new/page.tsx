import ProductForm from '@/components/admin/ProductForm';
import { requireAdminPermission } from '@/lib/admin-session';
import { prisma } from '@/lib/prisma';
import { createProduct } from '../actions';

export default async function NewProductPage() {
  await requireAdminPermission('/admin/products/new', 'products.write');

  const categories = await prisma.category.findMany({
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
  });

  return (
    <ProductForm
      action={createProduct}
      categories={categories}
      submitLabel="Create Product"
    />
  );
}
