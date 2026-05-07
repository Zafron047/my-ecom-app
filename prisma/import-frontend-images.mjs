import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

if (typeof process.loadEnvFile === 'function') {
  process.loadEnvFile();
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set.');
}

const SUPABASE_STORAGE_BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET || 'product-images';
const PRODUCT_STORAGE_PREFIX = 'products/demo';

const storefrontImageUrls = [
  'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=1200&h=1200&fit=crop',
  'https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=1200&h=1200&fit=crop',
  'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?w=1200&h=1200&fit=crop',
  'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=1200&h=1200&fit=crop',
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&h=1200&fit=crop',
  'https://images.unsplash.com/photo-1577937927133-66ef06acdf18?w=1200&h=1200&fit=crop',
  'https://images.unsplash.com/photo-1517849845537-4d257902454a?w=1200&h=1200&fit=crop',
  'https://images.unsplash.com/photo-1527631746610-bca00a040d60?w=1200&h=1200&fit=crop',
];

const seededProductSlugs = [
  'wireless-noise-canceling-earbuds-pro',
  'portable-mini-blender-bottle',
  'led-vanity-makeup-mirror',
  'magnetic-car-phone-holder-360',
  'air-fryer-silicone-basket-liner-set',
  'satin-heatless-curling-headband',
  'layered-minimalist-chain-necklace',
  'resistance-band-set-with-handles',
  'rechargeable-electric-lint-remover',
  'portable-facial-steamer-nano-mist',
  'crossbody-sling-bag-anti-theft',
  'smart-watch-fitness-tracker-s9',
  'silicone-dish-drying-mat-roll-up',
  'electric-blackhead-remover-vacuum',
  'uv-protection-polarized-sunglasses',
  'ab-roller-wheel-with-knee-pad',
  'mini-portable-projector-yg300',
  'oil-spray-bottle-for-cooking',
  'jade-roller-and-gua-sha-set',
  'metal-strap-quartz-wrist-watch',
];

function getSupabaseProjectUrlFromDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return undefined;

  try {
    const parsedUrl = new URL(databaseUrl);
    const usernameProjectRef = decodeURIComponent(parsedUrl.username).match(
      /^postgres\.([a-z0-9]+)$/i,
    )?.[1];
    const hostProjectRef = parsedUrl.hostname.match(
      /^(?:db|pooler)\.([a-z0-9]+)\.supabase\.co$/i,
    )?.[1];
    const projectRef = usernameProjectRef ?? hostProjectRef;
    return projectRef ? `https://${projectRef}.supabase.co` : undefined;
  } catch {
    return undefined;
  }
}

function getSupabaseUrl() {
  return (
    process.env.SUPABASE_URL?.replace(/\/$/, '') ??
    getSupabaseProjectUrlFromDatabaseUrl()
  );
}

function getSupabaseStorageConfig() {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Image import requires SUPABASE_SERVICE_ROLE_KEY. Set SUPABASE_URL too if it cannot be inferred from DATABASE_URL.',
    );
  }

  return {
    bucket: SUPABASE_STORAGE_BUCKET,
    serviceRoleKey,
    supabaseUrl,
  };
}

function encodeStorageObjectKey(objectKey) {
  return objectKey.split('/').map(encodeURIComponent).join('/');
}

function toPublicStorageUrl(objectKey) {
  const { bucket, supabaseUrl } = getSupabaseStorageConfig();
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${encodeStorageObjectKey(
    objectKey,
  )}`;
}

function extensionFromContentType(contentType) {
  if (!contentType) return 'jpg';
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('gif')) return 'gif';
  return 'jpg';
}

async function uploadStorageObject(objectKey, contentType, bytes) {
  const { bucket, serviceRoleKey, supabaseUrl } = getSupabaseStorageConfig();
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/${bucket}/${encodeStorageObjectKey(
      objectKey,
    )}`,
    {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Cache-Control': '31536000',
        'Content-Type': contentType || 'image/jpeg',
        'x-upsert': 'true',
      },
      body: bytes,
    },
  );

  if (!response.ok) {
    throw new Error(`Upload failed: ${await response.text()}`);
  }
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const products = await prisma.product.findMany({
    where: {
      slug: {
        in: seededProductSlugs,
      },
    },
    select: {
      id: true,
      name: true,
      slug: true,
    },
    orderBy: {
      slug: 'asc',
    },
  });

  if (products.length === 0) {
    throw new Error(
      'No seeded products found. Run `npm run prisma:seed:catalog` first.',
    );
  }

  let importedCount = 0;

  for (let index = 0; index < products.length; index += 1) {
    const product = products[index];
    const sourceUrl = storefrontImageUrls[index % storefrontImageUrls.length];
    const sourceResponse = await fetch(sourceUrl);

    if (!sourceResponse.ok) {
      throw new Error(
        `Failed to download source image for ${product.slug}: ${sourceResponse.status}`,
      );
    }

    const contentType = sourceResponse.headers.get('content-type') || 'image/jpeg';
    const extension = extensionFromContentType(contentType);
    const bytes = Buffer.from(await sourceResponse.arrayBuffer());
    const objectKey = `${PRODUCT_STORAGE_PREFIX}/${product.slug}.${extension}`;

    await uploadStorageObject(objectKey, contentType, bytes);
    const storagePath = toPublicStorageUrl(objectKey);

    await prisma.$transaction(async (tx) => {
      await tx.productImage.deleteMany({
        where: {
          productId: product.id,
        },
      });

      await tx.productImage.create({
        data: {
          productId: product.id,
          storagePath,
          altText: product.name,
          isPrimary: true,
          sortOrder: 0,
        },
      });

      await tx.productVariant.updateMany({
        where: {
          productId: product.id,
        },
        data: {
          imagePath: storagePath,
        },
      });
    });

    importedCount += 1;
  }

  console.log(`Imported ${importedCount} product images into Supabase Storage.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
