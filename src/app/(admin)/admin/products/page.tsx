import Link from 'next/link';
import { ProductStatus } from '@prisma/client';
import { requireAdminPermission } from '@/lib/admin-session';
import { canAccessPermission } from '@/lib/admin-rbac';
import { prisma } from '@/lib/prisma';
import ProductsFilters from '@/components/admin/ProductsFilters';
import ProductsListTable from '@/components/admin/ProductsListTable';
import {
  applyProductsBulkActionWithState,
} from './actions';

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

type ProductStatsRow = {
  activeProducts: number;
  archivedProducts: number;
  draftProducts: number;
  totalProducts: number;
  totalVariants: number;
  outOfStockVariants: number;
};

type ProductListRow = {
  altText: string | null;
  categoryNames: string[] | null;
  id: string;
  maximumPrice: string | null;
  minimumPrice: string | null;
  name: string;
  slug: string;
  status: ProductStatus;
  stock: number | null;
  storagePath: string | null;
  variantCount: number;
};

export default async function AdminProductsPage({
  searchParams,
}: ProductsPageProps) {
  const session = await requireAdminPermission('/admin/products', 'products.read');
  const canManageProducts = canAccessPermission(session.role, 'products.write');
  const canDeleteProducts = canAccessPermission(session.role, 'products.delete');

  const params = await searchParams;
  const query = params.q?.trim() ?? '';
  const status = getStatus(params.status);

  const [
    productStats,
    products,
  ] = await Promise.all([
    prisma.$queryRaw<ProductStatsRow[]>`
      SELECT
        COUNT(*)::int AS "totalProducts",
        COUNT(*) FILTER (WHERE "status" = 'active')::int AS "activeProducts",
        COUNT(*) FILTER (WHERE "status" = 'draft')::int AS "draftProducts",
        COUNT(*) FILTER (WHERE "status" = 'archived')::int AS "archivedProducts",
        (SELECT COUNT(*)::int FROM "ProductVariant") AS "totalVariants",
        (
          SELECT COUNT(*)::int
          FROM "ProductVariant"
          WHERE "stockQuantity" <= 0
        ) AS "outOfStockVariants"
      FROM "Product"
    `,
    prisma.$queryRaw<ProductListRow[]>`
      SELECT
        p."id",
        p."name",
        p."slug",
        p."status",
        COALESCE(variant_stats."variantCount", 0)::int AS "variantCount",
        COALESCE(variant_stats."stock", 0)::int AS "stock",
        variant_stats."minimumPrice"::text AS "minimumPrice",
        variant_stats."maximumPrice"::text AS "maximumPrice",
        category_stats."categoryNames",
        primary_image."storagePath",
        primary_image."altText"
      FROM "Product" p
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)::int AS "variantCount",
          SUM("stockQuantity")::int AS "stock",
          MIN("price") AS "minimumPrice",
          MAX("price") AS "maximumPrice"
        FROM "ProductVariant"
        WHERE "productId" = p."id"
      ) variant_stats ON true
      LEFT JOIN LATERAL (
        SELECT ARRAY_AGG(category_rows."name" ORDER BY category_rows."assignedAt") AS "categoryNames"
        FROM (
          SELECT c."name", pc."assignedAt"
          FROM "ProductCategory" pc
          INNER JOIN "Category" c ON c."id" = pc."categoryId"
          WHERE pc."productId" = p."id"
          ORDER BY pc."assignedAt" ASC
          LIMIT 2
        ) category_rows
      ) category_stats ON true
      LEFT JOIN LATERAL (
        SELECT "storagePath", "altText"
        FROM "ProductImage"
        WHERE "productId" = p."id"
        ORDER BY "isPrimary" DESC, "sortOrder" ASC
        LIMIT 1
      ) primary_image ON true
      WHERE
        (${status ?? null}::text IS NULL OR p."status" = (${status ?? null}::text)::"ProductStatus")
        AND (
          ${query || null}::text IS NULL
          OR p."name" ILIKE '%' || ${query || null} || '%'
          OR p."slug" ILIKE '%' || ${query || null} || '%'
          OR EXISTS (
            SELECT 1
            FROM "ProductVariant" pv
            WHERE pv."productId" = p."id"
              AND pv."sku" ILIKE '%' || ${query || null} || '%'
          )
        )
      ORDER BY p."updatedAt" DESC
      LIMIT 50
    `,
  ]);
  const {
    activeProducts = 0,
    archivedProducts = 0,
    draftProducts = 0,
    outOfStockVariants = 0,
    totalProducts = 0,
    totalVariants = 0,
  } = productStats[0] ?? {};

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
        {canManageProducts ? (
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/products/new"
              aria-label="Add product"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-2xl font-semibold leading-none text-blue-700 shadow-sm transition hover:bg-blue-100"
            >
              <span className="relative -top-px leading-none">+</span>
            </Link>
          </div>
        ) : null}
      </div>

      <ProductsFilters query={query} status={status ?? ''} />

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <p className="text-xs uppercase tracking-wide text-slate-500">Products</p>
          <p className="text-lg font-semibold text-slate-900">{totalProducts}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <p className="text-xs uppercase tracking-wide text-emerald-700">Active</p>
          <p className="text-lg font-semibold">{activeProducts}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p className="text-xs uppercase tracking-wide text-amber-700">Draft</p>
          <p className="text-lg font-semibold">{draftProducts}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <p className="text-xs uppercase tracking-wide text-slate-500">Archived</p>
          <p className="text-lg font-semibold text-slate-900">{archivedProducts}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <p className="text-xs uppercase tracking-wide text-slate-500">Variants</p>
          <p className="text-lg font-semibold text-slate-900">{totalVariants}</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
          <p className="text-xs uppercase tracking-wide text-rose-700">Out Of Stock Variants</p>
          <p className="text-lg font-semibold">{outOfStockVariants}</p>
        </div>
      </div>

      <ProductsListTable
        products={products.map((product) => {
          const stock = product.stock ?? 0;
          const minimumPrice =
            product.minimumPrice === null ? null : Number(product.minimumPrice);
          const maximumPrice =
            product.maximumPrice === null ? null : Number(product.maximumPrice);
          const priceLabel =
            minimumPrice === null || maximumPrice === null
              ? 'No price'
              : minimumPrice === maximumPrice
                ? formatMoney(minimumPrice)
                : `${formatMoney(minimumPrice)} - ${formatMoney(maximumPrice)}`;
          const categoryNames = product.categoryNames ?? [];

          return {
            id: product.id,
            name: product.name,
            slug: product.slug,
            status: product.status,
            categoriesLabel:
              categoryNames.length > 0
                ? categoryNames.join(', ')
                : 'Unassigned',
            minimumPrice,
            variantCount: product.variantCount,
            stock,
            priceLabel,
            primaryImage: product.storagePath
              ? {
                  storagePath: product.storagePath,
                  altText: product.altText,
                }
              : null,
          };
        })}
        applyProductsBulkActionWithState={applyProductsBulkActionWithState}
        canManageProducts={canManageProducts}
        canDeleteProducts={canDeleteProducts}
      />
    </section>
  );
}
