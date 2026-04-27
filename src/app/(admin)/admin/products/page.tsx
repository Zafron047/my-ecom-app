import Link from 'next/link';
import Image from 'next/image';
import { ProductStatus } from '@prisma/client';
import { requireAdminPermission } from '@/lib/admin-session';
import { prisma } from '@/lib/prisma';
import { removeProduct } from './actions';

type ProductsPageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
  }>;
};

const productStatuses = Object.values(ProductStatus);

function getStatus(value: string | undefined) {
  return productStatuses.includes(value as ProductStatus)
    ? (value as ProductStatus)
    : undefined;
}

function formatMoney(value: { toNumber: () => number } | number) {
  const amount = typeof value === 'number' ? value : value.toNumber();

  return new Intl.NumberFormat('en-BD', {
    currency: 'BDT',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(amount);
}

export default async function AdminProductsPage({
  searchParams,
}: ProductsPageProps) {
  await requireAdminPermission('/admin/products', 'products.read');

  const params = await searchParams;
  const query = params.q?.trim() ?? '';
  const status = getStatus(params.status);

  const products = await prisma.product.findMany({
    include: {
      categories: {
        include: {
          category: true,
        },
        take: 2,
      },
      variants: {
        orderBy: {
          createdAt: 'asc',
        },
      },
      images: {
        orderBy: [
          {
            isPrimary: 'desc',
          },
          {
            sortOrder: 'asc',
          },
        ],
        take: 1,
      },
      _count: {
        select: {
          variants: true,
        },
      },
    },
    orderBy: {
      updatedAt: 'desc',
    },
    take: 50,
    where: {
      ...(status ? { status } : {}),
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { slug: { contains: query, mode: 'insensitive' } },
              {
                variants: {
                  some: {
                    sku: { contains: query, mode: 'insensitive' },
                  },
                },
              },
            ],
          }
        : {}),
    },
  });

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Products</h2>
          <p className="mt-1 text-sm text-slate-600">
            Manage catalog status, variants, category assignment, and stock at a
            glance.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/products/new"
            aria-label="Add product"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-2xl font-semibold leading-none text-blue-700 shadow-sm transition hover:bg-blue-100"
          >
            <span className="relative -top-px leading-none">+</span>
          </Link>
        </div>
      </div>

      <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search products or SKU"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-300"
        />
        <select
          name="status"
          defaultValue={status ?? ''}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-300"
        >
          <option value="">All statuses</option>
          {productStatuses.map((item) => (
            <option key={item} value={item}>
              {item.charAt(0).toUpperCase() + item.slice(1)}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          Filter
        </button>
      </form>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Categories</th>
              <th className="px-3 py-2">Variants</th>
              <th className="px-3 py-2 text-right">Stock</th>
              <th className="px-3 py-2 text-right">Price</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.length > 0 ? (
              products.map((product) => {
                const stock = product.variants.reduce(
                  (total, variant) => total + variant.stockQuantity,
                  0,
                );
                const prices = product.variants.map((variant) =>
                  variant.price.toNumber(),
                );
                const minimumPrice = prices.length > 0 ? Math.min(...prices) : null;
                const maximumPrice = prices.length > 0 ? Math.max(...prices) : null;
                const priceLabel =
                  minimumPrice === null || maximumPrice === null
                    ? 'No price'
                    : minimumPrice === maximumPrice
                      ? formatMoney(minimumPrice)
                      : `${formatMoney(minimumPrice)} - ${formatMoney(maximumPrice)}`;
                const primaryImage = product.images[0];

                return (
                  <tr key={product.id} className="align-top">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase text-slate-400">
                          {primaryImage ? (
                            <Image
                              src={primaryImage.storagePath}
                              alt={primaryImage.altText ?? product.name}
                              fill
                              unoptimized
                              sizes="48px"
                              className="object-contain p-1"
                            />
                          ) : (
                            'No img'
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900">
                            {product.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {product.slug}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold capitalize text-slate-700">
                        {product.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {product.categories.length > 0
                        ? product.categories
                            .map((item) => item.category.name)
                            .join(', ')
                        : 'Unassigned'}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {product._count.variants}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-slate-900">
                      {stock}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-700">
                      {priceLabel}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/admin/products/${product.id}/edit`}
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          Edit
                        </Link>
                        <form action={removeProduct}>
                          <input
                            type="hidden"
                            name="productId"
                            value={product.id}
                          />
                          <button
                            type="submit"
                            className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                          >
                            Remove
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  className="px-3 py-6 text-center text-slate-500"
                  colSpan={7}
                >
                  No products match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
