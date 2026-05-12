import BrandManager from '@/components/admin/BrandManager';
import { requireAdminPermission } from '@/lib/admin-session';
import { prisma } from '@/lib/prisma';
import { createBrand, updateBrand } from './actions';

type AdminProductsBrandsPageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
  }>;
};

function getStatusFilter(value: string | undefined) {
  if (value === 'active') return true;
  if (value === 'archived') return false;
  return undefined;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('en-BD', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(value);
}

export default async function AdminProductsBrandsPage({
  searchParams,
}: AdminProductsBrandsPageProps) {
  await requireAdminPermission('/admin/products/brands', 'products.read');

  const params = await searchParams;
  const query = params.q?.trim() ?? '';
  const status = getStatusFilter(params.status);

  const brands = await prisma.brand.findMany({
    select: {
      description: true,
      id: true,
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
  });

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <BrandManager
        createAction={createBrand}
        updateAction={updateBrand}
        query={query}
        status={params.status ?? ''}
        brands={brands.map((brand) => ({
          description: brand.description,
          id: brand.id,
          isActive: brand.isActive,
          name: brand.name,
          productCount: brand._count.products,
          slug: brand.slug,
          updatedAtLabel: formatDate(brand.updatedAt),
        }))}
      />
    </section>
  );
}
