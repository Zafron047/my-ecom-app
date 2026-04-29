import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';

const prisma = new PrismaClient();

const PRODUCT_IMAGE_VARIANTS = [
  { suffix: 'thumb', width: 320, quality: 72 },
  { suffix: 'detail', width: 1200, quality: 78 },
  { suffix: 'zoom', width: 1800, quality: 75 },
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

function getSupabaseConfig() {
  const supabaseUrl =
    process.env.SUPABASE_URL?.replace(/\/$/, '') ??
    getSupabaseProjectUrlFromDatabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'product-images';

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing SUPABASE_URL (or DATABASE_URL-inferred URL) and SUPABASE_SERVICE_ROLE_KEY.',
    );
  }

  return { bucket, serviceRoleKey, supabaseUrl };
}

function encodeStorageObjectKey(objectKey) {
  return objectKey.split('/').map(encodeURIComponent).join('/');
}

function getStorageObjectKey(storagePath, config) {
  const prefix = `${config.supabaseUrl}/storage/v1/object/public/${config.bucket}/`;
  if (!storagePath.startsWith(prefix)) return null;
  try {
    return decodeURIComponent(storagePath.slice(prefix.length));
  } catch {
    return storagePath.slice(prefix.length);
  }
}

function getVariantObjectKey(objectKey, suffix) {
  const extensionMatch = objectKey.match(/\.[^./]+$/);
  if (!extensionMatch) return `${objectKey}-${suffix}.webp`;
  const extension = extensionMatch[0];
  return objectKey.replace(
    new RegExp(`${extension.replace('.', '\\.')}$`),
    `-${suffix}.webp`,
  );
}

async function uploadStorageBuffer(objectKey, bytes, contentType, config) {
  const response = await fetch(
    `${config.supabaseUrl}/storage/v1/object/${config.bucket}/${encodeStorageObjectKey(
      objectKey,
    )}`,
    {
      method: 'POST',
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        'Content-Type': contentType,
        'Cache-Control': '31536000',
        'x-upsert': 'true',
      },
      body: bytes,
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed upload for ${objectKey}: ${response.status} ${await response.text()}`,
    );
  }
}

async function generateVariantsForPublicUrl(publicUrl, config) {
  const objectKey = getStorageObjectKey(publicUrl, config);
  if (!objectKey) return { skipped: true };

  const response = await fetch(publicUrl);
  if (!response.ok) {
    return { skipped: true, reason: `Source unavailable (${response.status})` };
  }

  const sourceBuffer = Buffer.from(await response.arrayBuffer());

  for (const variant of PRODUCT_IMAGE_VARIANTS) {
    const bytes = await sharp(sourceBuffer)
      .rotate()
      .resize({ width: variant.width, withoutEnlargement: true })
      .webp({ quality: variant.quality })
      .toBuffer();

    await uploadStorageBuffer(
      getVariantObjectKey(objectKey, variant.suffix),
      bytes,
      'image/webp',
      config,
    );
  }

  return { skipped: false };
}

async function main() {
  const config = getSupabaseConfig();

  const [productImages, productVariants] = await Promise.all([
    prisma.productImage.findMany({
      select: { storagePath: true },
      where: { storagePath: { not: '' } },
    }),
    prisma.productVariant.findMany({
      select: { imagePath: true },
      where: { imagePath: { not: null } },
    }),
  ]);

  const imageUrls = new Set();
  for (const row of productImages) imageUrls.add(row.storagePath);
  for (const row of productVariants) {
    if (row.imagePath) imageUrls.add(row.imagePath);
  }

  let processed = 0;
  let skipped = 0;

  for (const imageUrl of imageUrls) {
    const result = await generateVariantsForPublicUrl(imageUrl, config);
    if (result.skipped) {
      skipped += 1;
      continue;
    }
    processed += 1;
  }

  console.log(
    `Backfill complete. Processed ${processed} source images, skipped ${skipped}.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
