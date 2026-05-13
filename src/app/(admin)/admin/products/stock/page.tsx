import StockListClient from '@/components/admin/StockListClient';
import { requireAdminPermission } from '@/lib/admin-session';
import { prisma } from '@/lib/prisma';

type StockPageProps = {
  searchParams: Promise<{
    q?: string;
    level?: string;
    variant?: string;
  }>;
};

export default async function AdminProductsStockPage({
  searchParams,
}: StockPageProps) {
  await requireAdminPermission('/admin/products/stock', 'products.read');

  const params = await searchParams;
  const query = params.q?.trim() ?? '';
  const level = (params.level ?? '').trim().toLowerCase();
  const variantState = (params.variant ?? '').trim().toLowerCase();

  const variants = await prisma.productVariant.findMany({
    select: {
      color: true,
      id: true,
      imagePath: true,
      isActive: true,
      reorderLevel: true,
      size: true,
      sku: true,
      stockQuantity: true,
      updatedAt: true,
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
        },
      },
    },
    orderBy: [
      { stockQuantity: 'asc' },
      { updatedAt: 'desc' },
    ],
    take: 200,
    where: {
      ...(query
        ? {
            OR: [
              { sku: { contains: query, mode: 'insensitive' } },
              { color: { contains: query, mode: 'insensitive' } },
              { size: { contains: query, mode: 'insensitive' } },
              {
                product: {
                  OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { slug: { contains: query, mode: 'insensitive' } },
                  ],
                },
              },
            ],
          }
        : {}),
    },
  });

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Stock</h2>
          <p className="mt-1 text-sm text-slate-600">
            Read-only variant inventory view with low-stock alerts.
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <StockListClient
          initialQuery={query}
          initialLevel={level}
          rows={variants.map((variant) => ({
            id: variant.id,
            product: {
              id: variant.product.id,
              name: variant.product.name,
              slug: variant.product.slug,
              status: variant.product.status,
            },
            sku: variant.sku,
            color: variant.color,
            size: variant.size,
            imagePath: variant.imagePath,
            stockQuantity: variant.stockQuantity,
            reorderLevel: variant.reorderLevel,
            isActive: variant.isActive,
            updatedAt: variant.updatedAt.toISOString(),
          }))}
          initialVariantState={variantState}
        />
      </section>
    </section>
  );
}
