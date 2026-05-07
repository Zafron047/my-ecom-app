import fs from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

function readPositiveIntEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: readPositiveIntEnv('PRISMA_PG_CONNECTION_TIMEOUT_MS', 10_000),
    idleTimeoutMillis: readPositiveIntEnv('PRISMA_PG_IDLE_TIMEOUT_MS', 10_000),
    max: readPositiveIntEnv('PRISMA_PG_POOL_MAX', 5),
  }),
});

function esc(value) {
  const raw = value == null ? '' : String(value);
  if (raw.includes('"') || raw.includes(',') || raw.includes('\n')) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function line(values) {
  return values.map(esc).join(',');
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}`;
}

async function run() {
  const products = await prisma.product.findMany({
    include: {
      brand: { select: { name: true } },
      variants: {
        orderBy: { sortOrder: 'asc' },
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
        include: { category: { select: { name: true } } },
        orderBy: { assignedAt: 'asc' },
      },
      images: {
        orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
        take: 1,
        select: { storagePath: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
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

  const rows = products.flatMap((product) => {
    const categories = product.categories.map((c) => c.category.name).join(' | ');
    const image = product.images[0]?.storagePath ?? null;
    const variants = product.variants.length
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

    return variants.map((v) =>
      line([
        product.id,
        product.name,
        product.slug,
        product.status,
        product.brand?.name ?? null,
        categories,
        product.shortDescription ?? null,
        product.description ?? null,
        product.seoTitle ?? null,
        product.seoDescription ?? null,
        image,
        v.id,
        v.sku,
        v.color,
        v.size,
        v.price?.toString() ?? null,
        v.compareAtPrice?.toString() ?? null,
        v.costPrice?.toString() ?? null,
        v.stockQuantity,
        v.reorderLevel,
        typeof v.isActive === 'boolean' ? (v.isActive ? 'true' : 'false') : null,
        product.updatedAt.toISOString(),
      ]),
    );
  });

  const outputDir = path.join(process.cwd(), 'backups');
  await fs.mkdir(outputDir, { recursive: true });
  const outFile = path.join(outputDir, `catalog-snapshot-${stamp()}.csv`);
  await fs.writeFile(outFile, [line(headers), ...rows].join('\n'), 'utf8');
  console.log(`Saved catalog backup: ${outFile}`);
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
