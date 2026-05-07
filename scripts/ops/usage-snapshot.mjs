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

function gb(bytes) {
  return (bytes / (1024 * 1024 * 1024)).toFixed(3);
}

function parseStorageBytes(url) {
  if (!url) return 0;
  try {
    const u = new URL(url);
    const maybeBytes = u.searchParams.get('bytes');
    if (!maybeBytes) return 0;
    const n = Number(maybeBytes);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

async function run() {
  const [products, variants, images, orders7d, orders30d, draftProducts] = await Promise.all([
    prisma.product.count(),
    prisma.productVariant.count(),
    prisma.productImage.findMany({ select: { storagePath: true } }),
    prisma.order.count({
      where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    }),
    prisma.order.count({
      where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    }),
    prisma.product.count({ where: { status: 'draft' } }),
  ]);

  const taggedBytes = images.reduce((sum, i) => sum + parseStorageBytes(i.storagePath), 0);

  console.log('=== Usage Snapshot ===');
  console.log(`Generated: ${new Date().toISOString()}`);
  console.log(`Products: ${products}`);
  console.log(`Variants: ${variants}`);
  console.log(`Draft products: ${draftProducts}`);
  console.log(`Orders (7d): ${orders7d}`);
  console.log(`Orders (30d): ${orders30d}`);
  console.log(`Product images tracked: ${images.length}`);
  console.log(
    taggedBytes > 0
      ? `Approx storage from URL tags: ${gb(taggedBytes)} GB`
      : 'Approx storage: unavailable from DB URLs (check Supabase dashboard).',
  );
  console.log('');
  console.log('Manual checks to run now:');
  console.log('1) Supabase: Project > Reports/Usage (DB size, storage size, egress)');
  console.log('2) Vercel: Project > Usage (bandwidth, function invocations, edge)');
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
