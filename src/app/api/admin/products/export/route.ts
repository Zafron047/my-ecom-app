import { NextResponse } from 'next/server';
import { requireAdminApiRole } from '@/lib/admin-api-auth';
import { prisma } from '@/lib/prisma';

function escapeCsvValue(value: string) {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsvLine(values: Array<string | number | null>) {
  return values
    .map((value) => {
      if (value === null) return '';
      return escapeCsvValue(String(value));
    })
    .join(',');
}

export async function GET() {
  const auth = await requireAdminApiRole(['admin']);
  if (auth.response) return auth.response;

  const products = await prisma.product.findMany({
    include: {
      brand: {
        select: {
          name: true,
        },
      },
      variants: {
        orderBy: {
          sortOrder: 'asc',
        },
        select: {
          id: true,
          sku: true,
          color: true,
          size: true,
          price: true,
          compareAtPrice: true,
          costPrice: true,
          stockQuantity: true,
          reorderLevel: true,
          isActive: true,
        },
      },
      categories: {
        include: {
          category: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          assignedAt: 'asc',
        },
      },
      images: {
        orderBy: [
          { isPrimary: 'desc' },
          { sortOrder: 'asc' },
        ],
        take: 1,
        select: {
          storagePath: true,
        },
      },
    },
    orderBy: {
      updatedAt: 'desc',
    },
  });

  const headers = [
    'product_id',
    'product_title',
    'product_slug',
    'product_status',
    'product_brand',
    'product_categories',
    'product_short_description',
    'product_description',
    'product_seo_title',
    'product_seo_description',
    'product_image_url',
    'variant_id',
    'variant_sku',
    'variant_color',
    'variant_size',
    'variant_price',
    'variant_compare_at_price',
    'variant_cost_price',
    'variant_stock_quantity',
    'variant_reorder_level',
    'variant_is_active',
    'updated_at',
  ];

  const csvRows = products.flatMap((product) => {
    const categoriesLabel = product.categories
      .map((row) => row.category.name)
      .join(' | ');
    const primaryImage = product.images[0]?.storagePath ?? null;
    const variantRows =
      product.variants.length > 0
        ? product.variants
        : [
            {
              id: null,
              sku: null,
              color: null,
              size: null,
              price: null,
              compareAtPrice: null,
              costPrice: null,
              stockQuantity: null,
              reorderLevel: null,
              isActive: null,
            },
          ];

    return variantRows.map((variant) =>
      toCsvLine([
        product.id,
        product.name,
        product.slug,
        product.status,
        product.brand?.name ?? null,
        categoriesLabel,
        product.shortDescription ?? null,
        product.description ?? null,
        product.seoTitle ?? null,
        product.seoDescription ?? null,
        primaryImage,
        variant.id,
        variant.sku,
        variant.color,
        variant.size,
        variant.price?.toString() ?? null,
        variant.compareAtPrice?.toString() ?? null,
        variant.costPrice?.toString() ?? null,
        variant.stockQuantity,
        variant.reorderLevel,
        typeof variant.isActive === 'boolean'
          ? variant.isActive
            ? 'true'
            : 'false'
          : null,
        product.updatedAt.toISOString(),
      ]),
    );
  });

  const csvContent = [toCsvLine(headers), ...csvRows].join('\n');
  const now = new Date();
  const pad2 = (value: number) => String(value).padStart(2, '0');
  const dateTag = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const timeTag = `${pad2(now.getHours())}-${pad2(now.getMinutes())}`;

  return new NextResponse(csvContent, {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Disposition': `attachment; filename="products-snapshot-${dateTag}-${timeTag}.csv"`,
      'Content-Type': 'text/csv; charset=utf-8',
    },
  });
}
