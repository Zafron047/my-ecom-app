import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

if (typeof process.loadEnvFile === 'function') {
  process.loadEnvFile();
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set.');
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function ensureAdminActor() {
  const preferredEmail = (process.env.ECOM_SEED_ADMIN_EMAIL ?? 'seed-admin@shopeasy.local')
    .trim()
    .toLowerCase();

  const existingActiveAdmin = await prisma.adminUser.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  });

  if (existingActiveAdmin) {
    return existingActiveAdmin;
  }

  return prisma.adminUser.upsert({
    where: { email: preferredEmail },
    create: {
      email: preferredEmail,
      name: 'Seed Admin',
      role: 'admin',
      passwordHash: 'seed:disabled',
      isActive: true,
    },
    update: {
      name: 'Seed Admin',
      role: 'admin',
      isActive: true,
    },
  });
}

async function main() {
  const admin = await ensureAdminActor();

  const categories = await Promise.all([
    prisma.category.upsert({
      where: { slug: 'wellness-supplements' },
      create: {
        name: 'Wellness Supplements',
        slug: 'wellness-supplements',
        description: 'Daily health and immunity-focused supplements.',
        sortOrder: 10,
      },
      update: {
        name: 'Wellness Supplements',
        description: 'Daily health and immunity-focused supplements.',
        isActive: true,
        sortOrder: 10,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'home-finds' },
      create: {
        name: 'Home Finds',
        slug: 'home-finds',
        description: 'Useful home and lifestyle essentials.',
        sortOrder: 20,
      },
      update: {
        name: 'Home Finds',
        description: 'Useful home and lifestyle essentials.',
        isActive: true,
        sortOrder: 20,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'travel-gear' },
      create: {
        name: 'Travel Gear',
        slug: 'travel-gear',
        description: 'Portable products for everyday travel comfort.',
        sortOrder: 30,
      },
      update: {
        name: 'Travel Gear',
        description: 'Portable products for everyday travel comfort.',
        isActive: true,
        sortOrder: 30,
      },
    }),
  ]);

  const product = await prisma.product.upsert({
    where: { sku: 'SKU-SEED-001' },
    create: {
      name: 'Vita Immunity Booster',
      slug: 'vita-immunity-booster',
      sku: 'SKU-SEED-001',
      shortDescription: 'A daily immunity support supplement.',
      description:
        'Starter product seed for admin and order workflows. Includes vitamin C, zinc, and herbal extracts.',
      price: '1290.00',
      compareAtPrice: '1490.00',
      costPrice: '830.00',
      weightKg: '0.250',
      status: 'active',
      inventoryPolicy: 'deny',
      trackQuantity: true,
      isFeatured: true,
      publishedAt: new Date(),
    },
    update: {
      name: 'Vita Immunity Booster',
      slug: 'vita-immunity-booster',
      shortDescription: 'A daily immunity support supplement.',
      description:
        'Starter product seed for admin and order workflows. Includes vitamin C, zinc, and herbal extracts.',
      price: '1290.00',
      compareAtPrice: '1490.00',
      costPrice: '830.00',
      weightKg: '0.250',
      status: 'active',
      inventoryPolicy: 'deny',
      trackQuantity: true,
      isFeatured: true,
      publishedAt: new Date(),
    },
  });

  await prisma.productCategory.upsert({
    where: {
      productId_categoryId: {
        productId: product.id,
        categoryId: categories[0].id,
      },
    },
    create: {
      productId: product.id,
      categoryId: categories[0].id,
    },
    update: {},
  });

  await prisma.inventory.upsert({
    where: {
      productId_locationCode: {
        productId: product.id,
        locationCode: 'DHAKA-MAIN',
      },
    },
    create: {
      productId: product.id,
      locationCode: 'DHAKA-MAIN',
      onHand: 120,
      reserved: 5,
      incoming: 40,
      reorderPoint: 25,
      safetyStock: 15,
      lastStockedAt: new Date(),
    },
    update: {
      onHand: 120,
      reserved: 5,
      incoming: 40,
      reorderPoint: 25,
      safetyStock: 15,
      lastStockedAt: new Date(),
    },
  });

  const zone = await prisma.shippingZone.upsert({
    where: { code: 'BD-DHAKA' },
    create: {
      name: 'Dhaka Metro',
      code: 'BD-DHAKA',
      countries: ['BD'],
      regions: ['Dhaka'],
      postalCodes: [],
      isActive: true,
    },
    update: {
      name: 'Dhaka Metro',
      countries: ['BD'],
      regions: ['Dhaka'],
      isActive: true,
    },
  });

  const existingRate = await prisma.shippingRate.findFirst({
    where: {
      shippingZoneId: zone.id,
      name: 'Standard Delivery',
    },
  });

  if (existingRate) {
    await prisma.shippingRate.update({
      where: { id: existingRate.id },
      data: {
        type: 'flat',
        minOrderAmount: '0',
        maxOrderAmount: null,
        rate: '80.00',
        perKgRate: null,
        estimatedDaysMin: 1,
        estimatedDaysMax: 2,
        isActive: true,
        sortOrder: 10,
      },
    });
  } else {
    await prisma.shippingRate.create({
      data: {
        shippingZoneId: zone.id,
        name: 'Standard Delivery',
        type: 'flat',
        minOrderAmount: '0',
        rate: '80.00',
        estimatedDaysMin: 1,
        estimatedDaysMax: 2,
        isActive: true,
        sortOrder: 10,
      },
    });
  }

  const coupon = await prisma.coupon.upsert({
    where: { code: 'WELCOME10' },
    create: {
      code: 'WELCOME10',
      name: 'Welcome Discount',
      description: 'Starter 10% off coupon for first orders.',
      type: 'percentage',
      scope: 'order',
      value: '10.00',
      minOrderAmount: '500.00',
      usageLimit: 500,
      usagePerCustomer: 1,
      startsAt: new Date('2026-01-01T00:00:00.000Z'),
      isActive: true,
    },
    update: {
      name: 'Welcome Discount',
      description: 'Starter 10% off coupon for first orders.',
      type: 'percentage',
      scope: 'order',
      value: '10.00',
      minOrderAmount: '500.00',
      usageLimit: 500,
      usagePerCustomer: 1,
      isActive: true,
    },
  });

  const customer = await prisma.customer.upsert({
    where: { email: 'customer.seed@shopeasy.local' },
    create: {
      firstName: 'Nadia',
      lastName: 'Rahman',
      customerType: 'reseller',
      canViewStock: true,
      email: 'customer.seed@shopeasy.local',
      phone: '+8801700000000',
      defaultAddress: {
        division: 'Dhaka',
        district: 'Dhaka',
        thana: 'Dhanmondi',
        address: 'Road 12, House 34',
      },
      notes: 'Seed customer for admin customer/order dashboard previews.',
      isActive: true,
    },
    update: {
      firstName: 'Nadia',
      lastName: 'Rahman',
      customerType: 'reseller',
      canViewStock: true,
      phone: '+8801700000000',
      notes: 'Seed customer for admin customer/order dashboard previews.',
      isActive: true,
    },
  });

  const existingOrder = await prisma.order.findUnique({
    where: { orderNumber: 'ORD-SEED-0001' },
    select: { id: true },
  });

  let orderId;
  if (existingOrder) {
    orderId = existingOrder.id;

    await prisma.order.update({
      where: { id: existingOrder.id },
      data: {
        customerId: customer.id,
        couponId: coupon.id,
        shippingZoneId: zone.id,
        status: 'confirmed',
        paymentStatus: 'paid',
        fulfillmentStatus: 'unfulfilled',
        email: customer.email,
        customerFirstName: customer.firstName,
        customerLastName: customer.lastName,
        customerMobile: customer.phone ?? '+8801700000000',
        receiverMobile: customer.phone,
        shippingDivision: 'Dhaka',
        shippingDistrict: 'Dhaka',
        shippingThana: 'Dhanmondi',
        shippingAddress: 'Road 12, House 34',
        subtotalAmount: '1290.00',
        discountAmount: '129.00',
        shippingAmount: '80.00',
        taxAmount: '0.00',
        totalAmount: '1241.00',
        paidAt: new Date(),
      },
    });
  } else {
    const createdOrder = await prisma.order.create({
      data: {
        orderNumber: 'ORD-SEED-0001',
        customerId: customer.id,
        couponId: coupon.id,
        shippingZoneId: zone.id,
        status: 'confirmed',
        paymentStatus: 'paid',
        fulfillmentStatus: 'unfulfilled',
        email: customer.email,
        customerFirstName: customer.firstName,
        customerLastName: customer.lastName,
        customerMobile: customer.phone ?? '+8801700000000',
        receiverMobile: customer.phone,
        shippingDivision: 'Dhaka',
        shippingDistrict: 'Dhaka',
        shippingThana: 'Dhanmondi',
        shippingAddress: 'Road 12, House 34',
        subtotalAmount: '1290.00',
        discountAmount: '129.00',
        shippingAmount: '80.00',
        taxAmount: '0.00',
        totalAmount: '1241.00',
        paidAt: new Date(),
        items: {
          create: [
            {
              productId: product.id,
              productName: product.name,
              productSku: product.sku,
              quantity: 1,
              unitPrice: '1290.00',
              compareAtPrice: '1490.00',
              discountAmount: '129.00',
              lineTotal: '1161.00',
            },
          ],
        },
      },
    });

    orderId = createdOrder.id;
  }

  await prisma.couponRedemption.upsert({
    where: {
      couponId_orderId: {
        couponId: coupon.id,
        orderId,
      },
    },
    create: {
      couponId: coupon.id,
      orderId,
      customerId: customer.id,
      amount: '129.00',
    },
    update: {
      customerId: customer.id,
      amount: '129.00',
    },
  });

  await prisma.setting.upsert({
    where: { key: 'store.name' },
    create: {
      key: 'store.name',
      valueType: 'string',
      valueString: 'shopeasy',
      description: 'Public storefront name.',
      updatedByAdminId: admin.id,
    },
    update: {
      valueType: 'string',
      valueString: 'shopeasy',
      description: 'Public storefront name.',
      updatedByAdminId: admin.id,
    },
  });

  await prisma.setting.upsert({
    where: { key: 'shipping.free_threshold' },
    create: {
      key: 'shipping.free_threshold',
      valueType: 'number',
      valueNumber: '2000.00',
      description: 'Order subtotal threshold for free shipping in BDT.',
      updatedByAdminId: admin.id,
    },
    update: {
      valueType: 'number',
      valueNumber: '2000.00',
      description: 'Order subtotal threshold for free shipping in BDT.',
      updatedByAdminId: admin.id,
    },
  });

  await prisma.setting.upsert({
    where: { key: 'checkout.cod_enabled' },
    create: {
      key: 'checkout.cod_enabled',
      valueType: 'boolean',
      valueBoolean: true,
      description: 'Enable cash on delivery payment option.',
      updatedByAdminId: admin.id,
    },
    update: {
      valueType: 'boolean',
      valueBoolean: true,
      description: 'Enable cash on delivery payment option.',
      updatedByAdminId: admin.id,
    },
  });

  const auditEntries = [
    {
      action: 'create',
      entityType: 'product',
      entityId: product.id,
      message: 'Seeded starter product.',
    },
    {
      action: 'create',
      entityType: 'order',
      entityId: orderId,
      message: 'Seeded starter order.',
    },
    {
      action: 'update',
      entityType: 'setting',
      entityId: 'store.name',
      message: 'Seeded initial store settings.',
    },
  ];

  for (const entry of auditEntries) {
    const existing = await prisma.auditLog.findFirst({
      where: {
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        message: entry.message,
      },
      select: { id: true },
    });

    if (!existing) {
      await prisma.auditLog.create({
        data: {
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          message: entry.message,
          actorAdminId: admin.id,
          actorCustomerId: entry.entityType === 'order' ? customer.id : null,
          metadata: {
            source: 'seed-ecommerce',
          },
        },
      });
    }
  }

  console.log('Ecommerce seed completed.');
  console.log(`Admin actor: ${admin.email}`);
  console.log(`Categories: ${categories.length}`);
  console.log(`Product: ${product.sku}`);
  console.log(`Customer: ${customer.email}`);
  console.log('Order: ORD-SEED-0001');
  console.log('Coupon: WELCOME10');
  console.log('Settings: store.name, shipping.free_threshold, checkout.cod_enabled');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
