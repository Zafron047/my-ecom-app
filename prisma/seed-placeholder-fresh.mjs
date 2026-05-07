import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

if (typeof process.loadEnvFile === 'function') process.loadEnvFile();

const DATABASE_URL = process.env.DATABASE_URL;
const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'product-images';
if (!DATABASE_URL) throw new Error('DATABASE_URL is not set.');

const CATEGORIES = [
  { name: 'Toys and Games', slug: 'toys-and-games', description: 'Fun toys and creative play items for kids and families.' },
  { name: 'Beauty and Health', slug: 'beauty-and-health', description: 'Skincare, wellness, and personal care essentials.' },
  { name: 'Electronics', slug: 'electronics', description: 'Practical tech accessories and smart devices.' },
  { name: 'Jewelry and Accessories', slug: 'jewelry-and-accessories', description: 'Fashion-forward jewelry and personal accessories.' },
  { name: 'Cell Phones and Accessories', slug: 'cell-phones-and-accessories', description: 'Mobile accessories for protection, charging, and daily use.' },
  { name: 'Baby and Maternity', slug: 'baby-and-maternity', description: 'Comfort and care essentials for baby and mother.' },
  { name: 'Bags and Luggage', slug: 'bags-and-luggage', description: 'Bags, wallets, and travel-ready carry options.' },
  { name: 'Sports and Outdoor', slug: 'sports-and-outdoor', description: 'Fitness tools and outdoor activity products.' },
  { name: 'Office and School Supplies', slug: 'office-and-school-supplies', description: 'Stationery and workspace productivity items.' },
  { name: 'Shoes', slug: 'shoes', description: 'Daily wear shoes for comfort and style.' },
];

const PRODUCT_NAME_MAP = {
  'toys-and-games': [
    'Rocket Brick Builder Set',
    'Mini Magnetic Puzzle Cubes',
    'Glow Track Racing Car Kit',
    'Wooden Balance Stacking Game',
    'Cartoon Claw Surprise Box'
  ],
  'beauty-and-health': [
    'Hydra Mist Facial Sprayer',
    'Silicone Cleansing Brush Pro',
    'Rose Quartz Massage Roller',
    'Portable Nail Care Drill Kit',
    'Herbal Heat Therapy Eye Mask'
  ],
  electronics: [
    'Smart Desk Ambient Lamp',
    'Portable Thermal Label Printer',
    'Mini Bluetooth Audio Receiver',
    'Dual Lens Pocket Camera',
    'Universal Travel Plug Adapter'
  ],
  'jewelry-and-accessories': [
    'Luna Crystal Pendant Necklace',
    'Twist Cuff Bracelet Duo',
    'Pearl Hoop Earring Set',
    'Minimal Bar Ring Collection',
    'Star Charm Anklet Chain'
  ],
  'cell-phones-and-accessories': [
    'MagSafe Ring Phone Case',
    'Braided Fast Charge Cable',
    'Foldable Phone Stand Dock',
    'Anti-Glare Screen Protector Pack',
    'Magnetic Car Vent Mount'
  ],
  'baby-and-maternity': [
    'Convertible Baby Diaper Backpack',
    'Soft Cotton Swaddle Wrap Set',
    'Baby Bottle Warmer Sleeve',
    'Portable Stroller Organizer Caddy',
    'Maternity Support Waist Belt'
  ],
  'bags-and-luggage': [
    'Urban Crossbody Sling Bag',
    'Compact Travel Packing Cubes',
    'Waterproof Gym Duffel Bag',
    'RFID Zip Wallet Organizer',
    'Carry-On Compression Backpack'
  ],
  'sports-and-outdoor': [
    'Resistance Loop Band Bundle',
    'Hydration Running Waist Pack',
    'Foam Roller Recovery Stick',
    'Camping Lantern Flashlight Combo',
    'Adjustable Jump Rope Pro'
  ],
  'office-and-school-supplies': [
    'Ergo Laptop Stand Riser',
    'Quick-Dry Gel Pen Set',
    'Magnetic Weekly Planner Board',
    'Desktop Cable Tidy Box',
    'Refillable Marker Highlighter Kit'
  ],
  shoes: [
    'AirFlex Knit Walking Shoes',
    'CloudStep Casual Sneakers',
    'TrailGrip Outdoor Trainers',
    'Urban Canvas Platform Shoes',
    'Comfort Slide Daily Sandals'
  ]
};

const TAGS_BY_CATEGORY = {
  'toys-and-games': ['kids', 'playtime', 'creative'],
  'beauty-and-health': ['beauty', 'wellness', 'self-care'],
  electronics: ['tech', 'smart', 'daily-use'],
  'jewelry-and-accessories': ['fashion', 'style', 'giftable'],
  'cell-phones-and-accessories': ['mobile', 'charging', 'protection'],
  'baby-and-maternity': ['baby', 'maternity', 'care'],
  'bags-and-luggage': ['travel', 'carry', 'organizer'],
  'sports-and-outdoor': ['fitness', 'outdoor', 'active'],
  'office-and-school-supplies': ['office', 'school', 'productivity'],
  shoes: ['footwear', 'comfort', 'everyday']
};

const adapter = new PrismaPg({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

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

function getStorageConfig() {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '') ?? getSupabaseProjectUrlFromDatabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY missing.');
  return { supabaseUrl, serviceRoleKey, bucket: SUPABASE_STORAGE_BUCKET };
}

function encodeStorageObjectKey(objectKey) {
  return objectKey.split('/').map(encodeURIComponent).join('/');
}

async function fetchRetry(url, options = {}, attempts = 5) {
  let lastErr;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 700 * (i + 1)));
    }
  }
  throw lastErr;
}

async function listBucketObjects(prefix = '', offset = 0, accum = []) {
  const { bucket, serviceRoleKey, supabaseUrl } = getStorageConfig();
  const res = await fetchRetry(`${supabaseUrl}/storage/v1/object/list/${bucket}`, {
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
  const { bucket, serviceRoleKey, supabaseUrl } = getStorageConfig();

  for (let i = 0; i < objectKeys.length; i += 100) {
    const batch = objectKeys.slice(i, i + 100);
    await fetchRetry(`${supabaseUrl}/storage/v1/object/${bucket}`, {
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

async function uploadObject(objectKey, bytes, contentType = 'image/jpeg') {
  const { bucket, serviceRoleKey, supabaseUrl } = getStorageConfig();
  await fetchRetry(`${supabaseUrl}/storage/v1/object/${bucket}/${encodeStorageObjectKey(objectKey)}`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': contentType,
      'Cache-Control': '31536000',
      'x-upsert': 'true',
    },
    body: bytes,
  });
}

function toPublicUrl(objectKey) {
  const { bucket, supabaseUrl } = getStorageConfig();
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${encodeStorageObjectKey(objectKey)}`;
}

function productSpecs(name, categoryName) {
  return [
    { name: 'Category', value: categoryName },
    { name: 'Material', value: 'Composite' },
    { name: 'Use Case', value: `Everyday ${name.split(' ')[0]} use` },
  ];
}

function variantsForBase(basePrice, categorySlug) {
  if (categorySlug === 'shoes') {
    return [
      { color: 'Black', size: '40', price: basePrice, compareAtPrice: basePrice * 1.18, stockQuantity: 18 },
      { color: 'White', size: '41', price: basePrice * 1.03, compareAtPrice: basePrice * 1.2, stockQuantity: 14 },
    ];
  }

  return [
    { color: 'Standard', size: 'Default', price: basePrice, compareAtPrice: basePrice * 1.12, stockQuantity: 22 },
    { color: 'Premium', size: 'Default', price: basePrice * 1.08, compareAtPrice: basePrice * 1.22, stockQuantity: 15 },
  ];
}

async function main() {
  const products = [];
  for (const category of CATEGORIES) {
    const names = PRODUCT_NAME_MAP[category.slug];
    names.forEach((name, index) => {
      products.push({
        category,
        name,
        slug: slugify(`${name}-${category.slug}`),
        shortDescription: `${name} designed for quality, convenience, and daily use.`,
        description: `${name} from our ${category.name} collection. Curated as a premium placeholder item with realistic pricing and variants for storefront testing and launch readiness.`,
        basePrice: 12 + index * 3 + category.name.length,
      });
    });
  }

  if (products.length !== 50) throw new Error(`Expected 50 products, got ${products.length}`);

  console.log('Deleting existing bucket objects...');
  const existingObjects = await listBucketObjects('');
  await deleteBucketObjects(existingObjects);
  console.log(`Deleted ${existingObjects.length} bucket objects.`);

  console.log('Cleaning DB product/order related tables...');
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
  for (const category of CATEGORIES) {
    const saved = await prisma.category.create({
      data: {
        name: category.name,
        slug: category.slug,
        description: category.description,
        isActive: true,
      },
    });
    categoryBySlug.set(category.slug, saved.id);
  }

  const tagCache = new Map();
  async function ensureTag(name) {
    const slug = slugify(name);
    if (tagCache.has(slug)) return tagCache.get(slug);
    const tag = await prisma.tag.create({ data: { name, slug, isActive: true } });
    tagCache.set(slug, tag.id);
    return tag.id;
  }

  let uploaded = 0;
  for (let i = 0; i < products.length; i += 1) {
    const p = products[i];
    const categoryId = categoryBySlug.get(p.category.slug);

    const product = await prisma.product.create({
      data: {
        name: p.name,
        slug: p.slug,
        shortDescription: p.shortDescription,
        description: p.description,
        status: 'active',
      },
    });

    await prisma.productCategory.create({ data: { productId: product.id, categoryId } });

    const specs = productSpecs(p.name, p.category.name);
    await prisma.productSpecification.createMany({
      data: specs.map((s, idx) => ({ productId: product.id, name: s.name, value: s.value, sortOrder: idx })),
    });

    const variants = variantsForBase(p.basePrice, p.category.slug);
    await prisma.productVariant.createMany({
      data: variants.map((v, idx) => ({
        productId: product.id,
        sku: `${p.category.slug.slice(0, 3).toUpperCase()}-${String(i + 1).padStart(2, '0')}-${idx + 1}`,
        color: v.color,
        size: v.size,
        price: v.price.toFixed(2),
        compareAtPrice: v.compareAtPrice.toFixed(2),
        stockQuantity: v.stockQuantity,
        reorderLevel: 6,
        isActive: true,
      })),
    });

    const seedTags = ['placeholder', 'launch-ready', ...TAGS_BY_CATEGORY[p.category.slug]];
    for (const tagName of seedTags) {
      const tagId = await ensureTag(tagName);
      await prisma.productTag.create({ data: { productId: product.id, tagId } });
    }

    const imageUrl = `https://picsum.photos/seed/${encodeURIComponent(p.slug)}/1200/1200`;
    const imageResponse = await fetchRetry(imageUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const bytes = Buffer.from(await imageResponse.arrayBuffer());
    const objectKey = `products/placeholders/${p.slug}.jpg`;
    await uploadObject(objectKey, bytes, 'image/jpeg');
    const publicUrl = toPublicUrl(objectKey);

    await prisma.productImage.create({
      data: {
        productId: product.id,
        storagePath: publicUrl,
        altText: p.name,
        isPrimary: true,
        sortOrder: 0,
      },
    });

    await prisma.productVariant.updateMany({ where: { productId: product.id }, data: { imagePath: publicUrl } });
    uploaded += 1;
  }

  const dupNames = await prisma.$queryRawUnsafe(`SELECT name, COUNT(*) c FROM "Product" GROUP BY name HAVING COUNT(*)>1`);
  const dupSlugs = await prisma.$queryRawUnsafe(`SELECT slug, COUNT(*) c FROM "Product" GROUP BY slug HAVING COUNT(*)>1`);

  const [categoryCount, productCount, variantCount, imageCount, orderCount] = await Promise.all([
    prisma.category.count(),
    prisma.product.count(),
    prisma.productVariant.count(),
    prisma.productImage.count(),
    prisma.order.count(),
  ]);

  console.log('Fresh placeholder seed complete.');
  console.log({
    categoryCount,
    productCount,
    variantCount,
    imageCount,
    orderCount,
    uploaded,
    duplicateNameRows: dupNames.length,
    duplicateSlugRows: dupSlugs.length,
    tagCount: tagCache.size,
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
