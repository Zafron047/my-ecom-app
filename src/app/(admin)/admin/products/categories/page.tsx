import Link from 'next/link';
import CategoryList from '@/components/admin/CategoryList';
import CategoryStatCards, {
  type CategoryStatCard,
} from '@/components/admin/CategoryStatCards';
import { requireAdminPermission } from '@/lib/admin-session';
import { prisma } from '@/lib/prisma';
import { updateCategory } from './actions';

type AdminProductsCategoriesPageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
  }>;
};

function getStatusFilter(value: string | undefined) {
  if (value === 'active') return true;
  if (value === 'inactive') return false;
  return undefined;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('en-BD', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(value);
}

export default async function AdminProductsCategoriesPage({
  searchParams,
}: AdminProductsCategoriesPageProps) {
  await requireAdminPermission('/admin/products/categories', 'products.read');

  const params = await searchParams;
  const query = params.q?.trim() ?? '';
  const status = getStatusFilter(params.status);

  const [categories, uncategorizedProductCount, uncategorizedProducts] =
    await Promise.all([
      prisma.category.findMany({
        select: {
          description: true,
          id: true,
          imagePath: true,
          isActive: true,
          name: true,
          slug: true,
          updatedAt: true,
          _count: {
            select: {
              products: true,
            },
          },
        },
        orderBy: [
          {
            isActive: 'desc',
          },
          {
            name: 'asc',
          },
        ],
        take: 100,
        where: {
          ...(typeof status === 'boolean' ? { isActive: status } : {}),
          ...(query
            ? {
                OR: [
                  { name: { contains: query, mode: 'insensitive' } },
                  { slug: { contains: query, mode: 'insensitive' } },
                  { description: { contains: query, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
      }),
      prisma.product.count({
        where: {
          categories: {
            none: {},
          },
        },
      }),
      prisma.product.findMany({
        orderBy: {
          updatedAt: 'desc',
        },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
        },
        take: 25,
        where: {
          categories: {
            none: {},
          },
        },
      }),
    ]);

  const totalCategories = categories.length;
  const activeCategories = categories.filter((category) => category.isActive).length;
  const emptyCategories = categories.filter(
    (category) => category._count.products === 0,
  ).length;
  const statCards: CategoryStatCard[] = [
    {
      id: 'visible',
      items: categories
        .filter((category) => category.isActive)
        .map((category) => ({
          badge: `${category._count.products}`,
          imagePath: category.imagePath ?? undefined,
          primary: category.name,
          secondary: category.slug,
        })),
      label: 'Visible Categories',
      value: activeCategories.toString(),
    },
    {
      id: 'listed',
      items: categories.map((category) => ({
        badge: category.isActive ? 'Active' : 'Inactive',
        imagePath: category.imagePath ?? undefined,
        primary: category.name,
        secondary: category.slug,
      })),
      label: 'Listed Categories',
      value: totalCategories.toString(),
    },
    {
      id: 'uncategorized',
      items: uncategorizedProducts.map((product) => ({
        badge: product.status,
        primary: product.name,
        secondary: product.slug,
      })),
      label: 'Uncategorized Products',
      value: uncategorizedProductCount.toString(),
    },
    {
      id: 'empty',
      items: categories
        .filter((category) => category._count.products === 0)
        .map((category) => ({
          badge: category.isActive ? 'Active' : 'Inactive',
          imagePath: category.imagePath ?? undefined,
          primary: category.name,
          secondary: category.slug,
        })),
      label: 'Empty Categories',
      value: emptyCategories.toString(),
    },
  ];
  const categoryListItems = categories.map((category) => ({
    description: category.description,
    id: category.id,
    imagePath: category.imagePath,
    isActive: category.isActive,
    name: category.name,
    productCount: category._count.products,
    slug: category.slug,
    updatedAtLabel: formatDate(category.updatedAt),
  }));

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Categories</h2>
          <p className="mt-1 text-sm text-slate-600">
            Organize product groups, visibility, and product assignment health.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/products/categories/new"
            aria-label="Add category"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-2xl font-semibold leading-none text-blue-700 shadow-sm transition hover:bg-blue-100"
          >
            <span className="relative -top-px leading-none">+</span>
          </Link>
        </div>
      </div>

      <CategoryStatCards cards={statCards} />

      <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search categories"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-300"
        />
        <select
          name="status"
          defaultValue={params.status ?? ''}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-300"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          Filter
        </button>
      </form>

      <CategoryList action={updateCategory} categories={categoryListItems} />
    </section>
  );
}
