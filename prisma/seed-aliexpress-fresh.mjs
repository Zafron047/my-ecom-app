import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

if (typeof process.loadEnvFile === 'function') process.loadEnvFile();

const DATABASE_URL = process.env.DATABASE_URL;
const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'product-images';

if (!DATABASE_URL) throw new Error('DATABASE_URL is not set.');

const CATEGORY_ITEMS = [
  { name: 'Toys and Games', slug: 'toys-and-games', itemIds: ['1005010344928426','1005012036219876','1005011811147014','1005012114463780','1005007619255270'] },
  { name: 'Beauty and Health', slug: 'beauty-and-health', itemIds: ['1005011950858149','1005010445113083','1005010545875901','1005010048943933','1005009790785988'] },
  { name: 'Electronics', slug: 'electronics', itemIds: ['1005011742916276','1005005969574846','1005010499304641','1005010446380180','1005006735849669'] },
  { name: 'Jewelry and Accessories', slug: 'jewelry-and-accessories', itemIds: ['1005005765962658','1005009901742091','1005010093442508','1005008510025686','1005009299235811'] },
  { name: 'Cell Phones and Accessories', slug: 'cell-phones-and-accessories', itemIds: ['1005011740176418','1005007054972204','1005010547915720','1005012037877327','1005010376419934'] },
  { name: 'Baby and Maternity', slug: 'baby-and-maternity', itemIds: ['1005006453934213','1005009391917250','1005009957604608','1005009483424548','4000459805384'] },
  { name: 'Bags and Luggage', slug: 'bags-and-luggage', itemIds: ['1005011839419442','1005007224578397','1005006767621417','1005005905310228','1005008944390699'] },
  { name: 'Sports and Outdoor', slug: 'sports-and-outdoor', itemIds: ['1005002089504023','1005010032048621','1005010328849012','1005008700575566','1005011806346266'] },
  { name: 'Office and School Supplies', slug: 'office-and-school-supplies', itemIds: ['1005006974683022','1005011847767967','1005006493880231','1005012014947437','1005009873757447'] },
  { name: 'Shoes', slug: 'shoes', itemIds: ['1005009896880163','1005005352934571','1005005572860727','1005009057076821','1005009852832429'] },
];

const adapter = new PrismaPg({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function uniq(arr) { return [...new Set(arr)]; }

function getSupabaseProjectUrlFromDatabaseUrl() {
  try {
    const parsedUrl = new URL(DATABASE_URL);
    const usernameProjectRef = decodeURIComponent(parsedUrl.username).match(/^postgres\.([a-z0-9]+)$/i)?.[1];
    const hostProjectRef = parsedUrl.hostname.match(/^(?:db|pooler)\.([a-z0-9]+)\.supabase\.co$/i)?.[1];
    const projectRef = usernameProjectRef ?? hostProjectRef;
    return projectRef ? `https://${projectRef}.supabase.co` : undefined;
  } catch {
    return undefined;
  }
}

function getSupabaseStorageConfig() {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '') ?? getSupabaseProjectUrlFromDatabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY missing.');
  }
  return { supabaseUrl, serviceRoleKey, bucket: SUPABASE_STORAGE_BUCKET };
}

function encodeStorageObjectKey(objectKey) {
  return objectKey.split('/').map(encodeURIComponent).join('/');
}

async function fetchWithRetry(url, options = {}, attempts = 5) {
  let last;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      last = err;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw last;
}

function cleanTitle(rawTitle, itemId) {
  const title = (rawTitle || '').replace(/\s*-\s*AliExpress.*$/i, '').trim();
  if (title) return title;
  return `AliExpress Product ${itemId}`;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

function extractProductFromMarkdown(md, itemId) {
  const titleMatch = md.match(/^Title:\s*(.+)$/m);
  const title = cleanTitle(titleMatch?.[1], itemId);

  const imageMatches = [...md.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)]+)\)/g)]
    .map((m) => m[1])
    .filter((url) => /aliexpress-media|alicdn|ae01\.alicdn|ae-pic/i.test(url))
    .filter((url) => !/150x150\.gif/i.test(url));

  const priceMatch = md.match(/(?:US\s*\$|BDT\s*)([0-9]+(?:\.[0-9]{1,2})?)/i);
  const parsedPrice = priceMatch ? Number.parseFloat(priceMatch[1]) : NaN;
  const basePrice = Number.isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : 25 + (Number(itemId.slice(-2)) % 50);

  const snippets = md
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 20 && !line.startsWith('http'))
    .slice(0, 6);

  return {
    title,
    imageUrl: imageMatches[0] || '',
    extraImages: imageMatches.slice(1, 5),
    description: snippets.join(' '),
    basePrice,
  };
}

async function fetchAliItem(itemId) {
  const proxyUrl = `https://r.jina.ai/http://www.aliexpress.com/item/${itemId}.html`;
  const res = await fetchWithRetry(proxyUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, 6);
  const md = await res.text();
  return extractProductFromMarkdown(md, itemId);
}

async function uploadStorageObject(objectKey, contentType, bytes) {
  const { bucket, serviceRoleKey, supabaseUrl } = getSupabaseStorageConfig();
  const response = await fetchWithRetry(
    `${supabaseUrl}/storage/v1/object/${bucket}/${encodeStorageObjectKey(objectKey)}`,
    {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': contentType || 'image/jpeg',
        'Cache-Control': '31536000',
        'x-upsert': 'true',
      },
      body: bytes,
    },
    4,
  );
  return response.ok;
}

function publicStorageUrl(objectKey) {
  const { bucket, supabaseUrl } = getSupabaseStorageConfig();
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${encodeStorageObjectKey(objectKey)}`;
}

async function listBucketObjects(prefix = '', offset = 0, accum = []) {
  const { bucket, serviceRoleKey, supabaseUrl } = getSupabaseStorageConfig();
  const res = await fetchWithRetry(`${supabaseUrl}/storage/v1/object/list/${bucket}`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prefix, limit: 100, offset, sortBy: { column: 'name', order: 'asc' } }),
  });
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) return accum;
  accum.push(...rows.map((row) => (prefix ? `${prefix}/${row.name}` : row.name)).filter((name) => !name.endsWith('/')));
  if (rows.length < 100) return accum;
  return listBucketObjects(prefix, offset + 100, accum);
}

async function deleteBucketObjects(objectKeys) {
  if (objectKeys.length === 0) return;
  const { bucket, serviceRoleKey, supabaseUrl } = getSupabaseStorageConfig();
  for (let i = 0; i < objectKeys.length; i += 100) {
    const batch = objectKeys.slice(i, i + 100);
    await fetchWithRetry(`${supabaseUrl}/storage/v1/object/${bucket}`, {
      method: 'DELETE',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prefixes: batch }),
    });
  }
}

function inferTags(categoryName, title) {
  const normalized = `${categoryName} ${title}`.toLowerCase();
  const tags = new Set(['aliexpress', 'imported']);
  if (normalized.includes('wireless') || normalized.includes('bluetooth') || normalized.includes('smart')) tags.add('tech');
  if (normalized.includes('baby')) tags.add('baby');
  if (normalized.includes('shoe') || normalized.includes('bag') || normalized.includes('jewelry')) tags.add('fashion');
  if (normalized.includes('sport') || normalized.includes('fitness')) tags.add('sports');
  if (normalized.includes('beauty') || normalized.includes('skin')) tags.add('beauty');
  return [...tags];
}

async function main() {
  const allIds = uniq(CATEGORY_ITEMS.flatMap((c) => c.itemIds));
  if (allIds.length !== 50) {
    throw new Error(`Expected 50 unique product ids, got ${allIds.length}.`);
  }

  console.log('Fetching AliExpress details for 50 products...');
  const fetched = [];
  for (const category of CATEGORY_ITEMS) {
    for (const itemId of category.itemIds) {
      const item = await fetchAliItem(itemId);
      fetched.push({ ...item, itemId, categorySlug: category.slug, categoryName: category.name });
      console.log(`Fetched ${itemId}: ${item.title}`);
    }
  }

  const slugSet = new Set();
  for (const row of fetched) {
    let slugBase = slugify(`${row.title}-${row.itemId}`) || `aliexpress-${row.itemId}`;
    let slug = slugBase;
    let n = 2;
    while (slugSet.has(slug)) {
      slug = `${slugBase}-${n}`;
      n += 1;
    }
    slugSet.add(slug);
    row.slug = slug;
  }

  console.log('Clearing bucket objects...');
  const existingObjects = await listBucketObjects('');
  await deleteBucketObjects(existingObjects);
  console.log(`Deleted ${existingObjects.length} objects from bucket ${SUPABASE_STORAGE_BUCKET}.`);

  console.log('Cleaning product/order data from DB...');
  await prisma.$transaction(async (tx) => {
    await tx.orderProduct.deleteMany();
    await tx.order.deleteMany();
    await tx.productImage.deleteMany();
    await tx.homepageSectionProduct.deleteMany();
    await tx.homepageSection.deleteMany();
    await tx.productSpecification.deleteMany();
    await tx.productVariant.deleteMany();
    await tx.productCategory.deleteMany();
    await tx.productTag.deleteMany();
    await tx.product.deleteMany();
    await tx.tag.deleteMany();
    await tx.category.deleteMany();
  });

  const categoryBySlug = new Map();
  for (const category of CATEGORY_ITEMS) {
    const saved = await prisma.category.create({
      data: {
        name: category.name,
        slug: category.slug,
        description: `${category.name} collection curated from AliExpress products.`,
        isActive: true,
      },
    });
    categoryBySlug.set(category.slug, saved.id);
  }

  const tagCache = new Map();
  async function ensureTag(tagName) {
    const slug = slugify(tagName);
    if (tagCache.has(slug)) return tagCache.get(slug);
    const tag = await prisma.tag.create({ data: { name: tagName, slug, isActive: true } });
    tagCache.set(slug, tag.id);
    return tag.id;
  }

  let uploadedCount = 0;

  for (const row of fetched) {
    const categoryId = categoryBySlug.get(row.categorySlug);

    let primaryStoragePath = '';
    const gallery = [row.imageUrl, ...row.extraImages].filter(Boolean);

    if (gallery.length > 0) {
      const first = gallery[0];
      try {
        const imgRes = await fetchWithRetry(first, { headers: { 'User-Agent': 'Mozilla/5.0' } }, 5);
        const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
        const bytes = Buffer.from(await imgRes.arrayBuffer());
        const objectKey = `products/aliexpress/${row.slug}-1.jpg`;
        await uploadStorageObject(objectKey, contentType, bytes);
        primaryStoragePath = publicStorageUrl(objectKey);
        uploadedCount += 1;
      } catch {
        primaryStoragePath = first;
      }
    }

    const product = await prisma.product.create({
      data: {
        name: row.title,
        slug: row.slug,
        shortDescription: row.description.slice(0, 280) || `AliExpress product ${row.itemId}`,
        description: row.description || `Imported from AliExpress item ${row.itemId}.`,
        status: 'active',
      },
    });

    await prisma.productCategory.create({ data: { productId: product.id, categoryId } });

    const base = Math.max(3, Number(row.basePrice.toFixed(2)));
    const variantRows = [
      { color: 'Standard', size: 'Default', price: base, compareAtPrice: Number((base * 1.12).toFixed(2)), stockQuantity: 20 },
      { color: 'Premium', size: 'Default', price: Number((base * 1.08).toFixed(2)), compareAtPrice: Number((base * 1.2).toFixed(2)), stockQuantity: 15 },
    ];

    await prisma.productVariant.createMany({
      data: variantRows.map((v, i) => ({
        productId: product.id,
        sku: `AE-${row.itemId}-${String(i + 1).padStart(2, '0')}`,
        color: v.color,
        size: v.size,
        price: v.price.toFixed(2),
        compareAtPrice: v.compareAtPrice.toFixed(2),
        stockQuantity: v.stockQuantity,
        reorderLevel: 5,
        isActive: true,
        imagePath: primaryStoragePath || null,
      })),
      skipDuplicates: true,
    });

    await prisma.productSpecification.createMany({
      data: [
        { productId: product.id, name: 'AliExpress Item ID', value: row.itemId, sortOrder: 0 },
        { productId: product.id, name: 'Source', value: 'AliExpress', sortOrder: 1 },
      ],
    });

    if (primaryStoragePath) {
      await prisma.productImage.create({
        data: {
          productId: product.id,
          storagePath: primaryStoragePath,
          altText: row.title,
          isPrimary: true,
          sortOrder: 0,
        },
      });
    }

    const tags = inferTags(row.categoryName, row.title);
    for (const t of tags) {
      const tagId = await ensureTag(t);
      await prisma.productTag.create({ data: { productId: product.id, tagId } });
    }
  }

  console.log('Seed finished.');
  console.log(`Categories: ${CATEGORY_ITEMS.length}`);
  console.log(`Products: ${fetched.length}`);
  console.log(`Tags: ${tagCache.size}`);
  console.log(`Uploaded primary images to bucket: ${uploadedCount}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
