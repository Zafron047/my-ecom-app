import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const TEST_PRODUCT_SLUGS = [
  'test-sharp-update',
  'test-3-in-1-food-processor',
  'test-product-silicone-spatula-set-12pcs',
  'test-product-title',
  'test-product-hp-pavilion-laptop',
  'test-product-lipton-taaza-tea-bags',
  'test-product',
  'test-item-microwave-cover',
  'test-item-nail-polish-display-organizer',
  'test-item-closeup-freshness-toothpaste',
  'test-item-gillette-twin-blade-razor-max',
  'test-item-crack-heel-cream',
  'test-item-womens-chest-bag',
  'test-item-oxford-simple-crossbody-bag',
  'test-item-metal-strap-quartz-wrist-watch',
];

const TEST_ORDER_NUMBERS = [
  'ORD-9724111730-4535',
  'ORD-9724022946-4924',
  'ORD-9721994908-7353',
  'ORD-9445575717-3885',
  'ORD-9181521624-5613',
  'ORD-9180697239-7859',
  'ORD-9171633810-5789',
  'ORD-9108744472-2466',
  'ORD-9100111297-9125',
  'ORD-7983090483-2714',
  'ORD-7803174685-8847',
  'ORD-7731172882-1584',
  'ORD-7730023680-4171',
  'ORD-7716834096-7796',
  'ORD-7709718458-7721',
];

const DELETE_ALL_ORDERS = true;
const DELETE_ALL_CUSTOMERS = true;
const KEEP_OPENING_PO_NUMBER = 'PO-OPENING-20260518';
const KEEP_ONLY_OPENING_NON_TEST_STOCK = true;
const APPLY = process.argv.includes('--apply');
const YES = process.argv.includes('--yes');

const TEST_GLOBAL_BUNDLE_TITLES = [
  'TEST 4PCS SET',
  '"TEST BUNDLE" Buy 10 Bags get 20% OFF (2)',
  '"TEST BUNDLE" Buy 5 Bags get 10% OFF (1)',
  '"TEST BUNDLE" Clearance - Buy 3 Red Bags get 60% OFF',
  '"TEST BUNDLE" Clearance!!! Buy 5 Leopard Bags get 50% OFF',
  '"TEST BUNDLE" Buy 3 Bags get 10% OFF',
  '"TEST BUNDLE" Buy 5 Bags get 20% OFF',
  '"TEST BUNDLE" Buy 10 Bags get 30% OFF',
];

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fsSync.existsSync(envPath)) return;

  for (const rawLine of fsSync.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] ??= value;
  }
}

function readPositiveIntEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

function decimalToString(value) {
  return value == null ? null : value.toString();
}

function decimalToNumber(value) {
  return value == null ? 0 : Number(value.toString());
}

function byId(rows) {
  return Array.from(new Set(rows.map((row) => row.id)));
}

function sum(rows, field) {
  return rows.reduce((total, row) => total + (row[field] ?? 0), 0);
}

function sorted(values) {
  return Array.from(values).sort((a, b) => a.localeCompare(b));
}

function summarizeProduct(product) {
  const variants = product.variants ?? [];
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    status: product.status,
    stock: product.stock,
    variants: variants.length,
    skus: variants.map((variant) => variant.sku),
    images: product.images.length,
    specifications: product.specifications.length,
    categories: product.categories.map((row) => row.category.name),
    brand: product.brand?.name ?? null,
    homepageLinks: product.homepageSectionProducts.length,
    productBundleOffers: product.bundleOffers.length,
    orderLines: product.orderProducts.length,
    purchaseOrderLines: product.purchaseLines.length,
  };
}

function summarizeOrder(order) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    placedAt: order.placedAt.toISOString(),
    customer: `${order.firstName}${order.lastName ? ` ${order.lastName}` : ''}`,
    phone: order.phone,
    totalAmount: decimalToString(order.totalAmount),
    products: order.products.map((item) => ({
      productName: item.productName,
      sku: item.sku,
      quantity: item.quantity,
      bundleTitle: item.bundleTitle,
    })),
    events: order.orderEvents.length,
    notes: order.orderNotes.length,
    returns: order.orderReturns.length,
  };
}

function isTestProduct(product) {
  return Boolean(product && TEST_PRODUCT_SLUGS.includes(product.slug));
}

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

function getStorageObjectKey(storagePath) {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'product-images';
  const supabaseUrl =
    process.env.SUPABASE_URL?.replace(/\/$/, '') ?? getSupabaseProjectUrlFromDatabaseUrl();

  const decodeKey = (value) => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };

  if (supabaseUrl) {
    const publicPrefix = `${supabaseUrl}/storage/v1/object/public/${bucket}/`;
    if (storagePath.startsWith(publicPrefix)) {
      return decodeKey(storagePath.slice(publicPrefix.length));
    }
  }

  try {
    const parsed = new URL(storagePath);
    const publicSegment = `/storage/v1/object/public/${bucket}/`;
    const segmentIndex = parsed.pathname.indexOf(publicSegment);
    if (segmentIndex >= 0) {
      return decodeKey(parsed.pathname.slice(segmentIndex + publicSegment.length));
    }
  } catch {
    // Fall through to raw object-key handling.
  }

  return storagePath.startsWith('products/') ? storagePath : null;
}

function getVariantObjectKey(objectKey, suffix) {
  if (objectKey.includes('/original/')) {
    return objectKey
      .replace('/original/', `/${suffix}/`)
      .replace(/\.[^./]+$/i, '.webp');
  }

  const extensionMatch = objectKey.match(/\.[^./]+$/);
  if (!extensionMatch) return `${objectKey}-${suffix}.webp`;
  return objectKey.slice(0, -extensionMatch[0].length) + `-${suffix}.webp`;
}

function getStorageObjectKeysWithVariants(objectKey) {
  return [
    objectKey,
    getVariantObjectKey(objectKey, 'thumb'),
    getVariantObjectKey(objectKey, 'detail'),
    getVariantObjectKey(objectKey, 'zoom'),
  ];
}

async function deleteStoragePathsBestEffort(storagePaths) {
  const supabaseUrl =
    process.env.SUPABASE_URL?.replace(/\/$/, '') ?? getSupabaseProjectUrlFromDatabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'product-images';

  if (!supabaseUrl || !serviceRoleKey || storagePaths.length === 0) {
    return { attempted: 0, deleted: 0, error: supabaseUrl && serviceRoleKey ? null : 'storage not configured' };
  }

  const objectKeys = Array.from(
    new Set(
      storagePaths
        .map((storagePath) => getStorageObjectKey(storagePath))
        .filter(Boolean)
        .flatMap((objectKey) => getStorageObjectKeysWithVariants(objectKey)),
    ),
  );

  let deleted = 0;
  let lastError = null;
  for (let i = 0; i < objectKeys.length; i += 100) {
    const prefixes = objectKeys.slice(i, i + 100);
    try {
      const response = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}`, {
        body: JSON.stringify({ prefixes }),
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Supabase delete failed with ${response.status}: ${await response.text()}`);
      }
      deleted += prefixes.length;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.error(`Storage cleanup failed for batch starting at ${i}:`, error);
    }
  }

  return { attempted: objectKeys.length, deleted, error: lastError };
}

loadEnv();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for the cleanup dry run.');
}

if (APPLY && !YES) {
  throw new Error('Refusing to apply cleanup without --yes.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: readPositiveIntEnv('PRISMA_PG_CONNECTION_TIMEOUT_MS', 10_000),
    idleTimeoutMillis: readPositiveIntEnv('PRISMA_PG_IDLE_TIMEOUT_MS', 10_000),
    max: readPositiveIntEnv('PRISMA_PG_POOL_MAX', 5),
  }),
});

async function run() {
  const products = await prisma.product.findMany({
    where: { slug: { in: TEST_PRODUCT_SLUGS } },
    orderBy: { slug: 'asc' },
    include: {
      brand: { select: { id: true, name: true, slug: true } },
      variants: {
        orderBy: { sortOrder: 'asc' },
        include: {
          variantImages: true,
          bundleOfferLinks: true,
          globalBundleOfferLinks: true,
          inventoryBatches: true,
          inventoryAllocations: true,
          orderProducts: true,
          purchaseLines: true,
        },
      },
      images: true,
      specifications: true,
      categories: { include: { category: true } },
      tags: { include: { tag: true } },
      bundleOffers: { include: { variants: true } },
      homepageSectionProducts: { include: { homepageSection: true } },
      orderProducts: true,
      purchaseLines: true,
    },
  });

  const productIds = byId(products);
  const variantIds = products.flatMap((product) => product.variants.map((variant) => variant.id));
  const foundSlugs = new Set(products.map((product) => product.slug));
  const missingProductSlugs = TEST_PRODUCT_SLUGS.filter((slug) => !foundSlugs.has(slug));

  const openingPo = await prisma.purchaseOrder.findUnique({
    where: { orderNumber: KEEP_OPENING_PO_NUMBER },
    include: {
      lifecycleEvents: true,
      noteHistory: true,
      lines: {
        include: {
          product: {
            include: {
              images: true,
              specifications: true,
              categories: { include: { category: true } },
              tags: true,
              brand: true,
            },
          },
          variant: {
            include: {
              variantImages: true,
              inventoryBatches: true,
              inventoryAllocations: true,
            },
          },
          batch: { include: { allocations: true } },
        },
      },
    },
  });

  if (!openingPo) {
    throw new Error(`${KEEP_OPENING_PO_NUMBER} was not found.`);
  }

  const openingKeepLines = openingPo.lines.filter((line) => !isTestProduct(line.product));
  const openingRemoveLines = openingPo.lines.filter((line) => isTestProduct(line.product));
  const openingKeepProductIds = new Set(
    openingKeepLines.map((line) => line.productId).filter(Boolean),
  );
  const openingKeepVariantIds = new Set(
    openingKeepLines.map((line) => line.variantId).filter(Boolean),
  );
  const openingKeepBatchIds = new Set(
    openingKeepLines.map((line) => line.batch?.id).filter(Boolean),
  );

  const listedOrders = await prisma.order.findMany({
    where: DELETE_ALL_ORDERS ? {} : { orderNumber: { in: TEST_ORDER_NUMBERS } },
    orderBy: { placedAt: 'desc' },
    include: {
      customer: {
        include: {
          sessions: true,
          passwordResetTokens: true,
          socialAccounts: true,
          orders: { select: { id: true, orderNumber: true } },
        },
      },
      products: true,
      orderEvents: true,
      orderNotes: true,
      orderReturns: { include: { lines: true } },
    },
  });

  const orderIds = byId(listedOrders);
  const foundOrderNumbers = new Set(listedOrders.map((order) => order.orderNumber));
  const missingOrderNumbers = DELETE_ALL_ORDERS
    ? []
    : TEST_ORDER_NUMBERS.filter((orderNumber) => !foundOrderNumbers.has(orderNumber));

  const otherOrdersWithTestProducts = await prisma.order.findMany({
    where: {
      id: { notIn: orderIds.length ? orderIds : [''] },
      products: {
        some: {
          OR: [{ productId: { in: productIds } }, { variantId: { in: variantIds } }],
        },
      },
    },
    orderBy: { placedAt: 'desc' },
    include: {
      products: true,
      orderEvents: true,
      orderNotes: true,
      orderReturns: { include: { lines: true } },
    },
  });

  const customerIds = Array.from(new Set(listedOrders.map((order) => order.customerId)));
  const customers =
    DELETE_ALL_CUSTOMERS || customerIds.length
      ? await prisma.customer.findMany({
          where: DELETE_ALL_CUSTOMERS ? {} : { id: { in: customerIds } },
          orderBy: { createdAt: 'asc' },
          include: {
            sessions: true,
            passwordResetTokens: true,
            socialAccounts: true,
            orders: { select: { id: true, orderNumber: true } },
          },
        })
      : [];

  const purchaseOrderLines = await prisma.purchaseOrderLine.findMany({
    where: {
      OR: [{ productId: { in: productIds } }, { variantId: { in: variantIds } }],
    },
    include: {
      purchaseOrder: {
        include: {
          lifecycleEvents: true,
          noteHistory: true,
          lines: true,
        },
      },
      batch: { include: { allocations: true } },
      product: { select: { slug: true, name: true } },
      variant: { select: { sku: true } },
    },
  });

  const purchaseOrdersById = new Map();
  for (const line of purchaseOrderLines) {
    purchaseOrdersById.set(line.purchaseOrder.id, line.purchaseOrder);
  }

  const inventoryBatches = await prisma.inventoryBatch.findMany({
    where: { variantId: { in: variantIds } },
    include: {
      allocations: true,
      variant: { select: { sku: true } },
      purchaseOrderLine: {
        include: {
          purchaseOrder: { select: { orderNumber: true } },
        },
      },
    },
    orderBy: { receivedAt: 'desc' },
  });

  const inventoryAllocations = await prisma.inventoryAllocation.findMany({
    where: { variantId: { in: variantIds } },
    include: {
      orderProduct: { select: { orderId: true, sku: true, productName: true } },
      inventoryBatch: { select: { batchNumber: true } },
    },
  });

  const productBundleOffers = await prisma.productBundleOffer.findMany({
    where: { productId: { in: productIds } },
    include: { product: { select: { slug: true, name: true } }, variants: true },
    orderBy: [{ productId: 'asc' }, { sortOrder: 'asc' }],
  });

  const globalBundleOffers = await prisma.bundleOffer.findMany({
    where: {
      OR: [
        { title: { in: TEST_GLOBAL_BUNDLE_TITLES } },
        { variants: { some: { variantId: { in: variantIds } } } },
      ],
    },
    include: { variants: true },
    orderBy: { sortOrder: 'asc' },
  });

  const homepageLinks = await prisma.homepageSectionProduct.findMany({
    where: { productId: { in: productIds } },
    include: {
      homepageSection: { select: { title: true, sourceType: true, sourceValue: true } },
      product: { select: { slug: true, name: true } },
    },
  });

  const categoryIds = Array.from(
    new Set(products.flatMap((product) => product.categories.map((row) => row.categoryId))),
  );
  const categories = categoryIds.length
    ? await prisma.category.findMany({
        where: { id: { in: categoryIds } },
        include: { products: { include: { product: { select: { slug: true } } } } },
        orderBy: { name: 'asc' },
      })
    : [];

  const brandIds = Array.from(new Set(products.map((product) => product.brandId).filter(Boolean)));
  const brands = brandIds.length
    ? await prisma.brand.findMany({
        where: { id: { in: brandIds } },
        include: { products: { select: { slug: true } } },
        orderBy: { name: 'asc' },
      })
    : [];

  const productMediaPaths = sorted(
    new Set([
      ...products.flatMap((product) => product.images.map((image) => image.storagePath)),
      ...products.flatMap((product) =>
        product.variants.flatMap((variant) => [
          variant.imagePath,
          ...variant.variantImages.map((image) => image.imagePath),
        ]),
      ),
      ...productBundleOffers.map((offer) => offer.imagePath),
      ...globalBundleOffers.map((offer) => offer.imagePath),
    ].filter(Boolean)),
  );

  const keepProductMediaPaths = sorted(
    new Set(
      openingKeepLines.flatMap((line) => [
        ...(line.product?.images.map((image) => image.storagePath) ?? []),
        line.variant?.imagePath,
        ...(line.variant?.variantImages.map((image) => image.imagePath) ?? []),
      ].filter(Boolean)),
    ),
  );

  const allProducts = KEEP_ONLY_OPENING_NON_TEST_STOCK
    ? await prisma.product.findMany({
        include: {
          images: true,
          specifications: true,
          categories: true,
          tags: true,
          variants: {
            include: {
              variantImages: true,
              inventoryBatches: true,
              inventoryAllocations: true,
              orderProducts: true,
              purchaseLines: true,
            },
          },
        },
      })
    : [];

  const allProductIds = new Set(allProducts.map((product) => product.id));
  const allVariantIds = new Set(
    allProducts.flatMap((product) => product.variants.map((variant) => variant.id)),
  );
  const productsToDeleteForReset = allProducts.filter(
    (product) => !openingKeepProductIds.has(product.id),
  );
  const variantsToDeleteForReset = allProducts.flatMap((product) =>
    product.variants.filter((variant) => !openingKeepVariantIds.has(variant.id)),
  );
  const productImageRowsToDeleteForReset = allProducts.flatMap((product) =>
    openingKeepProductIds.has(product.id) ? [] : product.images,
  );
  const productVariantImageRowsToDeleteForReset = allProducts.flatMap((product) =>
    product.variants.flatMap((variant) =>
      openingKeepVariantIds.has(variant.id) ? [] : variant.variantImages,
    ),
  );
  const mediaPathsToDeleteForReset = sorted(
    new Set([
      ...productImageRowsToDeleteForReset.map((image) => image.storagePath),
      ...allProducts.flatMap((product) =>
        product.variants.flatMap((variant) =>
          openingKeepVariantIds.has(variant.id)
            ? []
            : [variant.imagePath, ...variant.variantImages.map((image) => image.imagePath)],
        ),
      ),
      ...productBundleOffers.map((offer) => offer.imagePath),
      ...globalBundleOffers.map((offer) => offer.imagePath),
    ].filter(Boolean)),
  );

  const keepCategoryIds = new Set(
    openingKeepLines.flatMap((line) =>
      line.product?.categories.map((row) => row.categoryId) ?? [],
    ),
  );
  const keepBrandIds = new Set(
    openingKeepLines.map((line) => line.product?.brandId).filter(Boolean),
  );

  const [
    allCategories,
    allBrands,
    allHomepageSections,
    allBundleOffers,
    allProductBundleOffers,
    allAbandonedCheckouts,
    allCoupons,
    allRateLimitBuckets,
  ] = KEEP_ONLY_OPENING_NON_TEST_STOCK
    ? await Promise.all([
        prisma.category.findMany({ include: { products: true } }),
        prisma.brand.findMany({ include: { products: true } }),
        prisma.homepageSection.findMany({ include: { products: true } }),
        prisma.bundleOffer.findMany({ include: { variants: true } }),
        prisma.productBundleOffer.findMany({ include: { variants: true } }),
        prisma.abandonedCheckout.findMany(),
        prisma.coupon.findMany({ include: { orders: true } }),
        prisma.rateLimitBucket.findMany(),
      ])
    : [[], [], [], [], [], [], [], []];

  const categoriesToDeleteForReset = allCategories.filter(
    (category) => !keepCategoryIds.has(category.id),
  );
  const brandsToDeleteForReset = allBrands.filter((brand) => !keepBrandIds.has(brand.id));

  const allPurchaseOrders = KEEP_ONLY_OPENING_NON_TEST_STOCK
    ? await prisma.purchaseOrder.findMany({
        include: {
          lines: { include: { batch: { include: { allocations: true } } } },
          lifecycleEvents: true,
          noteHistory: true,
        },
      })
    : [];

  const allInventoryAllocations = KEEP_ONLY_OPENING_NON_TEST_STOCK
    ? await prisma.inventoryAllocation.findMany()
    : [];
  const purchaseOrdersToDeleteForReset = allPurchaseOrders.filter(
    (po) => po.orderNumber !== KEEP_OPENING_PO_NUMBER,
  );
  const openingTestBatchesToDelete = openingRemoveLines.map((line) => line.batch).filter(Boolean);
  const nonOpeningBatchesToDelete = purchaseOrdersToDeleteForReset.flatMap((po) =>
    po.lines.map((line) => line.batch).filter(Boolean),
  );
  const batchesToDeleteForReset = [...openingTestBatchesToDelete, ...nonOpeningBatchesToDelete];
  const allocationsToDeleteForReset = batchesToDeleteForReset.flatMap((batch) => batch.allocations);

  const plannedOrderIds = new Set(orderIds);
  const customerReview = customers.map((customer) => {
    const outsideOrders = customer.orders.filter((order) => !plannedOrderIds.has(order.id));
    return {
      id: customer.id,
      name: `${customer.firstName}${customer.lastName ? ` ${customer.lastName}` : ''}`,
      phone: customer.phone,
      email: customer.email,
      totalOrders: customer.orders.length,
      plannedOrders: customer.orders.length - outsideOrders.length,
      outsideOrders: outsideOrders.map((order) => order.orderNumber),
      sessions: customer.sessions.length,
      passwordResetTokens: customer.passwordResetTokens.length,
      socialAccounts: customer.socialAccounts.length,
      safeToDeleteAfterOrders: outsideOrders.length === 0,
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'dry-run',
    warnings: [
      'This script does not write to the database.',
      'Do not run an apply cleanup until this report is reviewed and confirmed.',
      'Storage files are listed for manual review only; no storage objects are deleted.',
    ],
    inputs: {
      productSlugs: TEST_PRODUCT_SLUGS,
      orderNumbers: TEST_ORDER_NUMBERS,
      deleteAllOrders: DELETE_ALL_ORDERS,
      deleteAllCustomers: DELETE_ALL_CUSTOMERS,
      keepOpeningPoNumber: KEEP_OPENING_PO_NUMBER,
      keepOnlyOpeningNonTestStock: KEEP_ONLY_OPENING_NON_TEST_STOCK,
      globalBundleTitles: TEST_GLOBAL_BUNDLE_TITLES,
    },
    missingInputs: {
      productSlugs: missingProductSlugs,
      orderNumbers: missingOrderNumbers,
    },
    found: {
      products: products.map(summarizeProduct),
      listedOrders: listedOrders.map(summarizeOrder),
      otherOrdersWithTestProducts: otherOrdersWithTestProducts.map(summarizeOrder),
      productBundleOffers: productBundleOffers.map((offer) => ({
        id: offer.id,
        title: offer.title,
        product: offer.product.slug,
        isActive: offer.isActive,
        minTotalQty: offer.minTotalQty,
        discountPercent: decimalToString(offer.discountPercent),
        variantLinks: offer.variants.length,
      })),
      globalBundleOffers: globalBundleOffers.map((offer) => ({
        id: offer.id,
        title: offer.title,
        isActive: offer.isActive,
        minTotalQty: offer.minTotalQty,
        discountPercent: decimalToString(offer.discountPercent),
        variantLinks: offer.variants.length,
      })),
      homepageLinks: homepageLinks.map((link) => ({
        homepageSectionTitle: link.homepageSection.title,
        product: link.product.slug,
      })),
      purchaseOrderLines: purchaseOrderLines.map((line) => ({
        id: line.id,
        purchaseOrderNumber: line.purchaseOrder.orderNumber,
        productSlug: line.product?.slug ?? null,
        variantSku: line.variant?.sku ?? null,
        batchNumber: line.batchNumber,
        quantity: line.quantity,
        batch: line.batch
          ? {
              batchNumber: line.batch.batchNumber,
              remainingQuantity: line.batch.remainingQuantity,
              allocations: line.batch.allocations.length,
            }
          : null,
      })),
      purchaseOrders: Array.from(purchaseOrdersById.values()).map((po) => ({
        id: po.id,
        orderNumber: po.orderNumber,
        supplierName: po.supplierName,
        status: po.status,
        paymentStatus: po.paymentStatus,
        totalLines: po.lines.length,
        testLines: purchaseOrderLines.filter((line) => line.purchaseOrderId === po.id).length,
        events: po.lifecycleEvents.length,
        notes: po.noteHistory.length,
        totalQuantity: po.totalQuantity,
        totalCost: decimalToString(po.totalCost),
        containsNonTestLines:
          po.lines.length > purchaseOrderLines.filter((line) => line.purchaseOrderId === po.id).length,
      })),
      inventoryBatches: inventoryBatches.map((batch) => ({
        id: batch.id,
        batchNumber: batch.batchNumber,
        variantSku: batch.variant.sku,
        purchaseOrderNumber: batch.purchaseOrderLine.purchaseOrder.orderNumber,
        receivedQuantity: batch.receivedQuantity,
        remainingQuantity: batch.remainingQuantity,
        allocations: batch.allocations.length,
      })),
      inventoryAllocations: inventoryAllocations.map((allocation) => ({
        id: allocation.id,
        variantId: allocation.variantId,
        sku: allocation.orderProduct.sku,
        productName: allocation.orderProduct.productName,
        batchNumber: allocation.inventoryBatch.batchNumber,
        quantity: allocation.quantity,
        releasedAt: allocation.releasedAt?.toISOString() ?? null,
      })),
      customers: customerReview,
      categories: categories.map((category) => {
        const testProducts = category.products.filter((row) => foundSlugs.has(row.product.slug));
        return {
          id: category.id,
          name: category.name,
          slug: category.slug,
          products: category.products.length,
          testProducts: testProducts.length,
          wouldBeEmptyAfterProductCleanup: category.products.length === testProducts.length,
        };
      }),
      brands: brands.map((brand) => {
        const testProducts = brand.products.filter((product) => foundSlugs.has(product.slug));
        return {
          id: brand.id,
          name: brand.name,
          slug: brand.slug,
          products: brand.products.length,
          testProducts: testProducts.length,
          wouldBeEmptyAfterProductCleanup: brand.products.length === testProducts.length,
        };
      }),
      productMediaPaths,
      resetKeepSet: {
        purchaseOrder: {
          id: openingPo.id,
          orderNumber: openingPo.orderNumber,
          lines: openingPo.lines.length,
          nonTestLinesToKeep: openingKeepLines.length,
          testLinesToRemove: openingRemoveLines.length,
          events: openingPo.lifecycleEvents.length,
          notes: openingPo.noteHistory.length,
        },
        products: openingKeepLines.map((line) => ({
          productId: line.productId,
          productSlug: line.product?.slug ?? null,
          productName: line.product?.name ?? null,
          variantId: line.variantId,
          variantSku: line.variant?.sku ?? null,
          batchId: line.batch?.id ?? null,
          batchNumber: line.batch?.batchNumber ?? null,
          remainingQuantity: line.batch?.remainingQuantity ?? null,
        })),
        mediaPaths: keepProductMediaPaths,
      },
      resetDeleteSet: KEEP_ONLY_OPENING_NON_TEST_STOCK
        ? {
            products: productsToDeleteForReset.map((product) => ({
              id: product.id,
              slug: product.slug,
              name: product.name,
            })),
            variants: variantsToDeleteForReset.map((variant) => ({
              id: variant.id,
              sku: variant.sku,
              productId: variant.productId,
            })),
            purchaseOrders: purchaseOrdersToDeleteForReset.map((po) => ({
              id: po.id,
              orderNumber: po.orderNumber,
              lines: po.lines.length,
              events: po.lifecycleEvents.length,
              notes: po.noteHistory.length,
            })),
            openingPoTestLines: openingRemoveLines.map((line) => ({
              id: line.id,
              productSlug: line.product?.slug ?? null,
              variantSku: line.variant?.sku ?? null,
              batchNumber: line.batch?.batchNumber ?? null,
            })),
            mediaPaths: mediaPathsToDeleteForReset,
            categories: categoriesToDeleteForReset.map((category) => ({
              id: category.id,
              name: category.name,
              slug: category.slug,
            })),
            brands: brandsToDeleteForReset.map((brand) => ({
              id: brand.id,
              name: brand.name,
              slug: brand.slug,
            })),
            homepageSections: allHomepageSections.map((section) => ({
              id: section.id,
              title: section.title,
              products: section.products.length,
            })),
            globalBundleOffers: allBundleOffers.map((offer) => ({
              id: offer.id,
              title: offer.title,
              variantLinks: offer.variants.length,
            })),
            productBundleOffers: allProductBundleOffers.map((offer) => ({
              id: offer.id,
              title: offer.title,
              productId: offer.productId,
              variantLinks: offer.variants.length,
            })),
          }
        : null,
    },
    counts: {
      products: products.length,
      productVariants: variantIds.length,
      productImages: products.reduce((total, product) => total + product.images.length, 0),
      productVariantImages: products.reduce(
        (total, product) =>
          total +
          product.variants.reduce(
            (variantTotal, variant) => variantTotal + variant.variantImages.length,
            0,
          ),
        0,
      ),
      productSpecifications: products.reduce(
        (total, product) => total + product.specifications.length,
        0,
      ),
      homepageLinks: homepageLinks.length,
      listedOrders: listedOrders.length,
      otherOrdersWithTestProducts: otherOrdersWithTestProducts.length,
      orderProducts: listedOrders.reduce((total, order) => total + order.products.length, 0),
      orderEvents: listedOrders.reduce((total, order) => total + order.orderEvents.length, 0),
      orderNotes: listedOrders.reduce((total, order) => total + order.orderNotes.length, 0),
      orderReturns: listedOrders.reduce((total, order) => total + order.orderReturns.length, 0),
      orderReturnLines: listedOrders.reduce(
        (total, order) =>
          total +
          order.orderReturns.reduce((returnTotal, row) => returnTotal + row.lines.length, 0),
        0,
      ),
      productBundleOffers: productBundleOffers.length,
      productBundleOfferVariantLinks: productBundleOffers.reduce(
        (total, offer) => total + offer.variants.length,
        0,
      ),
      globalBundleOffers: globalBundleOffers.length,
      globalBundleOfferVariantLinks: globalBundleOffers.reduce(
        (total, offer) => total + offer.variants.length,
        0,
      ),
      purchaseOrders: purchaseOrdersById.size,
      purchaseOrderLines: purchaseOrderLines.length,
      inventoryBatches: inventoryBatches.length,
      inventoryAllocations: inventoryAllocations.length,
      customers: customers.length,
      mediaPaths: productMediaPaths.length,
      resetKeepProducts: openingKeepProductIds.size,
      resetKeepVariants: openingKeepVariantIds.size,
      resetKeepOpeningPoLines: openingKeepLines.length,
      resetKeepOpeningBatches: openingKeepBatchIds.size,
      resetKeepMediaPaths: keepProductMediaPaths.length,
      resetDeleteProducts: productsToDeleteForReset.length,
      resetDeleteVariants: variantsToDeleteForReset.length,
      resetDeletePurchaseOrders: purchaseOrdersToDeleteForReset.length,
      resetDeleteOpeningPoTestLines: openingRemoveLines.length,
      resetDeleteBatches: batchesToDeleteForReset.length,
      resetDeleteInventoryAllocations: allInventoryAllocations.length,
      resetDeleteMediaPaths: mediaPathsToDeleteForReset.length,
      resetDeleteCategories: categoriesToDeleteForReset.length,
      resetKeepCategories: keepCategoryIds.size,
      resetDeleteBrands: brandsToDeleteForReset.length,
      resetKeepBrands: keepBrandIds.size,
      resetDeleteHomepageSections: allHomepageSections.length,
      resetDeleteHomepageSectionProducts: allHomepageSections.reduce(
        (total, section) => total + section.products.length,
        0,
      ),
      resetDeleteGlobalBundleOffers: allBundleOffers.length,
      resetDeleteGlobalBundleOfferVariantLinks: allBundleOffers.reduce(
        (total, offer) => total + offer.variants.length,
        0,
      ),
      resetDeleteProductBundleOffers: allProductBundleOffers.length,
      resetDeleteProductBundleOfferVariantLinks: allProductBundleOffers.reduce(
        (total, offer) => total + offer.variants.length,
        0,
      ),
      resetDeleteAbandonedCheckouts: allAbandonedCheckouts.length,
      resetDeleteCoupons: allCoupons.length,
      resetDeleteRateLimitBuckets: allRateLimitBuckets.length,
    },
  };

  const outputDir = path.join(process.cwd(), 'backups');
  await fs.mkdir(outputDir, { recursive: true });
  const outFile = path.join(outputDir, `test-content-cleanup-dry-run-${stamp()}.json`);
  await fs.writeFile(outFile, JSON.stringify(report, null, 2), 'utf8');

  let applyResult = null;
  if (APPLY) {
    const orderIdsToDelete = listedOrders.map((order) => order.id);
    const customerIdsToDelete = customers.map((customer) => customer.id);
    const purchaseOrderIdsToDelete = purchaseOrdersToDeleteForReset.map((po) => po.id);
    const openingLineIdsToDelete = openingRemoveLines.map((line) => line.id);
    const productIdsToDelete = productsToDeleteForReset.map((product) => product.id);
    const categoryIdsToDelete = categoriesToDeleteForReset.map((category) => category.id);
    const brandIdsToDelete = brandsToDeleteForReset.map((brand) => brand.id);
    const openingTotalQuantity = sum(openingKeepLines, 'quantity');
    const openingTotalCost = openingKeepLines
      .reduce((total, line) => total + decimalToNumber(line.lineTotal), 0)
      .toFixed(2);

    applyResult = await prisma.$transaction(
      async (tx) => {
        const result = {};

        result.inventoryAllocations = await tx.inventoryAllocation.deleteMany({});
        result.orderReturnLines = await tx.orderReturnLine.deleteMany({
          where: { orderReturn: { orderId: { in: orderIdsToDelete } } },
        });
        result.orders = await tx.order.deleteMany({
          where: { id: { in: orderIdsToDelete } },
        });
        result.customers = await tx.customer.deleteMany({
          where: { id: { in: customerIdsToDelete } },
        });

        result.abandonedCheckouts = await tx.abandonedCheckout.deleteMany({});
        result.rateLimitBuckets = await tx.rateLimitBucket.deleteMany({});
        result.coupons = await tx.coupon.deleteMany({});

        result.homepageSectionProducts = await tx.homepageSectionProduct.deleteMany({});
        result.homepageSections = await tx.homepageSection.deleteMany({});

        result.productBundleOfferVariants = await tx.productBundleOfferVariant.deleteMany({});
        result.productBundleOffers = await tx.productBundleOffer.deleteMany({});
        result.bundleOfferVariants = await tx.bundleOfferVariant.deleteMany({});
        result.bundleOffers = await tx.bundleOffer.deleteMany({});

        result.purchaseOrders = await tx.purchaseOrder.deleteMany({
          where: { id: { in: purchaseOrderIdsToDelete } },
        });
        result.openingPurchaseOrderLines = await tx.purchaseOrderLine.deleteMany({
          where: { id: { in: openingLineIdsToDelete } },
        });
        result.openingPurchaseOrder = await tx.purchaseOrder.update({
          data: {
            totalQuantity: openingTotalQuantity,
            totalCost: openingTotalCost,
          },
          where: { id: openingPo.id },
        });

        result.productVariants = await tx.productVariant.deleteMany({
          where: { id: { in: variantsToDeleteForReset.map((variant) => variant.id) } },
        });
        result.products = await tx.product.deleteMany({
          where: { id: { in: productIdsToDelete } },
        });
        result.categories = await tx.category.deleteMany({
          where: { id: { in: categoryIdsToDelete } },
        });
        result.brands = await tx.brand.deleteMany({
          where: { id: { in: brandIdsToDelete } },
        });

        return Object.fromEntries(
          Object.entries(result).map(([key, value]) => [
            key,
            typeof value?.count === 'number' ? value.count : value?.id ?? value,
          ]),
        );
      },
      { maxWait: 20_000, timeout: 120_000 },
    );

    const storageResult = await deleteStoragePathsBestEffort(mediaPathsToDeleteForReset);
    const applyOutFile = path.join(outputDir, `test-content-cleanup-apply-${stamp()}.json`);
    const applyPayload = {
      appliedAt: new Date().toISOString(),
      planReport: outFile,
      database: applyResult,
      storage: storageResult,
      kept: {
        purchaseOrder: KEEP_OPENING_PO_NUMBER,
        products: openingKeepProductIds.size,
        variants: openingKeepVariantIds.size,
        openingPoLines: openingKeepLines.length,
        openingBatches: openingKeepBatchIds.size,
      },
    };
    await fs.writeFile(applyOutFile, JSON.stringify(applyPayload, null, 2), 'utf8');
    report.applyResult = applyPayload;
    await fs.writeFile(outFile, JSON.stringify(report, null, 2), 'utf8');
  }

  console.log(`=== Test Content Cleanup ${APPLY ? 'Apply' : 'Dry Run'} ===`);
  console.log(`Generated: ${report.generatedAt}`);
  console.log(`Report: ${outFile}`);
  console.log('');
  console.log('Matched counts:');
  for (const [key, value] of Object.entries(report.counts)) {
    console.log(`- ${key}: ${value}`);
  }
  console.log('');
  if (missingProductSlugs.length || missingOrderNumbers.length) {
    console.log('Missing configured inputs:');
    if (missingProductSlugs.length) {
      console.log(`- product slugs: ${missingProductSlugs.join(', ')}`);
    }
    if (missingOrderNumbers.length) {
      console.log(`- order numbers: ${missingOrderNumbers.join(', ')}`);
    }
    console.log('');
  }
  if (otherOrdersWithTestProducts.length) {
    console.log('Review required: unlisted orders still reference test products:');
    for (const order of otherOrdersWithTestProducts) {
      console.log(`- ${order.orderNumber}`);
    }
    console.log('');
  }
  const unsafeCustomers = customerReview.filter((customer) => !customer.safeToDeleteAfterOrders);
  if (unsafeCustomers.length) {
    console.log('Review required: customers with orders outside this cleanup:');
    for (const customer of unsafeCustomers) {
      console.log(`- ${customer.name} (${customer.phone}): ${customer.outsideOrders.join(', ')}`);
    }
    console.log('');
  }
  if (APPLY) {
    console.log('Applied database cleanup:');
    for (const [key, value] of Object.entries(applyResult ?? {})) {
      console.log(`- ${key}: ${value}`);
    }
    console.log('');
    console.log(`Storage object delete attempted for ${report.applyResult.storage.attempted} object keys.`);
    if (report.applyResult.storage.error) {
      console.log(`Storage cleanup warning: ${report.applyResult.storage.error}`);
    }
  } else {
    console.log('No database rows were changed.');
  }
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
