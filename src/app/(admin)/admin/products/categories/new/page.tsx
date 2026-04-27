import CategoryForm from '@/components/admin/CategoryForm';
import { requireAdminPermission } from '@/lib/admin-session';
import { createCategory } from '../actions';

export default async function NewCategoryPage() {
  await requireAdminPermission('/admin/products/categories/new', 'products.write');

  return <CategoryForm action={createCategory} submitLabel="Create Category" />;
}
