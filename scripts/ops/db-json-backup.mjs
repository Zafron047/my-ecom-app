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

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}`;
}

async function run() {
  const [products, variants, orders, customers, categories, brands] = await Promise.all([
    prisma.product.count(),
    prisma.productVariant.count(),
    prisma.order.count(),
    prisma.customer.count(),
    prisma.category.count(),
    prisma.brand.count(),
  ]);

  const latestOrders = await prisma.order.findMany({
    take: 200,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      totalAmount: true,
      createdAt: true,
      updatedAt: true,
      phone: true,
      firstName: true,
      lastName: true,
    },
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    counts: { products, variants, orders, customers, categories, brands },
    recentOrders: latestOrders,
  };

  const outputDir = path.join(process.cwd(), 'backups');
  await fs.mkdir(outputDir, { recursive: true });
  const outFile = path.join(outputDir, `db-summary-${stamp()}.json`);
  await fs.writeFile(outFile, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`Saved DB summary backup: ${outFile}`);
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
