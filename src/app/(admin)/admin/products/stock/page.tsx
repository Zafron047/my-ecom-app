import Link from 'next/link';
import Image from 'next/image';
import { updateVariantInventory } from '../actions';
import VariantInventoryInlineForm from '@/components/admin/VariantInventoryInlineForm';
import { requireAdminPermission } from '@/lib/admin-session';
import { prisma } from '@/lib/prisma';

type StockPageProps = {
  searchParams: Promise<{
    q?: string;
    level?: string;
    edit?: string;
  }>;
};

function getStockBadge(stockQuantity: number, reorderLevel: number) {
  if (stockQuantity <= 0) {
    return {
      className: 'bg-rose-50 text-rose-700 border-rose-200',
      label: 'Out of stock',
    };
  }

  if (stockQuantity <= reorderLevel) {
    return {
      className: 'bg-amber-50 text-amber-700 border-amber-200',
      label: 'Low stock',
    };
  }

  return {
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    label: 'Healthy',
  };
}

export default async function AdminProductsStockPage({
  searchParams,
}: StockPageProps) {
  await requireAdminPermission('/admin/products/stock', 'products.read');

  const params = await searchParams;
  const query = params.q?.trim() ?? '';
  const level = (params.level ?? '').trim().toLowerCase();
  const editVariantId = (params.edit ?? '').trim();

  const variants = await prisma.productVariant.findMany({
    include: {
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

  const filteredVariants = variants.filter((variant) => {
    if (level === 'out') return variant.stockQuantity <= 0;
    if (level === 'low') {
      return variant.stockQuantity > 0 && variant.stockQuantity <= variant.reorderLevel;
    }
    if (level === 'healthy') return variant.stockQuantity > variant.reorderLevel;
    return true;
  });

  const totalUnits = filteredVariants.reduce(
    (sum, variant) => sum + variant.stockQuantity,
    0,
  );
  const outOfStockCount = filteredVariants.filter(
    (variant) => variant.stockQuantity <= 0,
  ).length;
  const lowStockCount = filteredVariants.filter(
    (variant) =>
      variant.stockQuantity > 0 &&
      variant.stockQuantity <= variant.reorderLevel,
  ).length;
  const healthyCount = filteredVariants.length - outOfStockCount - lowStockCount;

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Stock</h2>
          <p className="mt-1 text-sm text-slate-600">
            Variant-level inventory view with low-stock alerts.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <article className="rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm ring-1 ring-slate-100 transition hover:border-slate-300 hover:shadow-md">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Products</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {new Set(filteredVariants.map((variant) => variant.product.id)).size}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm ring-1 ring-slate-100 transition hover:border-slate-300 hover:shadow-md">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Variants</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{filteredVariants.length}</p>
        </article>
        <article className="rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm ring-1 ring-slate-100 transition hover:border-slate-300 hover:shadow-md">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Total Units</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{totalUnits}</p>
        </article>
        <article className="rounded-2xl border border-amber-200/90 bg-gradient-to-br from-amber-50 to-lime-50 p-4 shadow-sm ring-1 ring-amber-100 transition hover:border-amber-300 hover:shadow-md">
          <p className="text-xs uppercase tracking-[0.14em] text-amber-700">Low Stock</p>
          <p className="mt-2 text-2xl font-semibold text-amber-900">{lowStockCount}</p>
        </article>
        <article className="rounded-2xl border border-rose-200/90 bg-gradient-to-br from-rose-50 to-red-50 p-4 shadow-sm ring-1 ring-rose-100 transition hover:border-rose-300 hover:shadow-md">
          <p className="text-xs uppercase tracking-[0.14em] text-rose-700">Out of Stock</p>
          <p className="mt-2 text-2xl font-semibold text-rose-900">{outOfStockCount}</p>
        </article>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_190px_auto]">
          <input
            name="q"
            defaultValue={query}
            placeholder="Search product, slug, SKU, color, size"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-300"
          />
          <select
            name="level"
            defaultValue={level}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-300"
          >
            <option value="">All levels</option>
            <option value="out">Out of stock</option>
            <option value="low">Low stock</option>
            <option value="healthy">Healthy</option>
          </select>
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Filter
          </button>
        </form>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">Variant</th>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2 text-right">Stock</th>
                <th className="px-3 py-2 text-right">Reorder</th>
                <th className="px-3 py-2">Level</th>
                <th className="px-3 py-2">Updated</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVariants.length > 0 ? (
                filteredVariants.map((variant) => {
                  const stockBadge = getStockBadge(
                    variant.stockQuantity,
                    variant.reorderLevel,
                  );
                  const isEditing = editVariantId === variant.id;
                  return (
                    <tr
                      key={variant.id}
                      className={
                        variant.stockQuantity > 0 &&
                        variant.stockQuantity <= variant.reorderLevel
                          ? 'bg-amber-50/30'
                          : ''
                      }
                    >
                      <td className="px-3 py-3">
                        <p className="font-medium text-slate-900">{variant.product.name}</p>
                        <p className="text-xs text-slate-500">{variant.product.slug}</p>
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        <div className="flex items-center gap-2">
                          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                            {variant.imagePath ? (
                              <Image
                                src={variant.imagePath}
                                alt={`${variant.product.name} variant`}
                                fill
                                unoptimized
                                sizes="40px"
                                className="object-contain p-0.5"
                              />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center text-[10px] font-semibold uppercase text-slate-400">
                                N/A
                              </span>
                            )}
                          </div>
                          <span>
                            {(variant.color?.trim() || 'Standard') +
                              ' / ' +
                              (variant.size?.trim() || 'Standard')}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{variant.sku}</td>
                      {isEditing ? (
                        <VariantInventoryInlineForm
                          variantId={variant.id}
                          initialStockQuantity={variant.stockQuantity}
                          initialReorderLevel={variant.reorderLevel}
                          levelBadgeClassName={stockBadge.className}
                          levelBadgeLabel={stockBadge.label}
                          updatedAtLabel={variant.updatedAt.toLocaleString()}
                          q={query}
                          level={level}
                          onSubmit={updateVariantInventory}
                        />
                      ) : (
                        <>
                          <td className="px-3 py-3 text-right font-semibold text-slate-900">
                            {variant.stockQuantity}
                          </td>
                          <td className="px-3 py-3 text-right text-slate-700">
                            {variant.reorderLevel}
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${stockBadge.className}`}
                            >
                              {stockBadge.label}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-xs text-slate-600">
                            {variant.updatedAt.toLocaleString()}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <Link
                              href={
                                `/admin/products/stock?${new URLSearchParams({
                                  ...(query ? { q: query } : {}),
                                  ...(level ? { level } : {}),
                                  edit: variant.id,
                                }).toString()}`
                              }
                              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              Update
                            </Link>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="px-3 py-6 text-center text-slate-500" colSpan={8}>
                    No stock rows match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
