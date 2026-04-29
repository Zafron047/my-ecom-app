import Link from 'next/link';
import { ProductStatus } from '@prisma/client';
import { requireAdminPermission } from '@/lib/admin-session';
import { prisma } from '@/lib/prisma';
import ProductsFilters from '@/components/admin/ProductsFilters';
import ProductsListTable from '@/components/admin/ProductsListTable';
import { removeProduct, removeProductsBulk, unarchiveProduct } from './actions';

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

      <ProductsFilters query={query} status={status ?? ''} />

      <ProductsListTable
        products={products.map((product) => {
          const stock = product.variants.reduce(
            (total, variant) => total + variant.stockQuantity,
            0,
          );
          const prices = product.variants.map((variant) => variant.price.toNumber());
          const minimumPrice = prices.length > 0 ? Math.min(...prices) : null;
          const maximumPrice = prices.length > 0 ? Math.max(...prices) : null;
          const priceLabel =
            minimumPrice === null || maximumPrice === null
              ? 'No price'
              : minimumPrice === maximumPrice
                ? formatMoney(minimumPrice)
                : `${formatMoney(minimumPrice)} - ${formatMoney(maximumPrice)}`;
          const primaryImage = product.images[0];

          return {
            id: product.id,
            name: product.name,
            slug: product.slug,
            status: product.status,
            categoriesLabel:
              product.categories.length > 0
                ? product.categories.map((item) => item.category.name).join(', ')
                : 'Unassigned',
            variantCount: product._count.variants,
            stock,
            priceLabel,
            primaryImage: primaryImage
              ? {
                  storagePath: primaryImage.storagePath,
                  altText: primaryImage.altText,
                }
              : null,
          };
        })}
        removeProductAction={removeProduct}
        removeProductsBulkAction={removeProductsBulk}
        unarchiveProductAction={unarchiveProduct}
      />
    </section>
  );
}
