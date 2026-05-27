import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

if (typeof process.loadEnvFile === 'function') {
  process.loadEnvFile();
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required to seed the invoice test order.');
}

const DELETE_MODE = process.argv.includes('--delete');
const ORDER_NUMBER = 'ORD-INVOICE-UI-20260526';
const TEST_MARKER = 'TEST_INVOICE_UI_ORDER_DELETE_ME';
const CUSTOMER_PHONE = '01999052626';
const CUSTOMER_EMAIL = 'invoice-ui-test@wowmall.test';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  }),
});

function asMoney(value) {
  return Number(value.toString());
}

function variantLabel(variant) {
  return [variant.color, variant.size].filter(Boolean).join(' / ') || 'Standard';
}

async function deleteSeededOrder() {
  const order = await prisma.order.findUnique({
    where: { orderNumber: ORDER_NUMBER },
    select: { id: true, customerId: true, orderNumber: true },
  });

  if (!order) {
    console.log(`No invoice UI test order found for ${ORDER_NUMBER}.`);
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.delete({ where: { id: order.id } });

    const remainingCustomerOrders = await tx.order.count({
      where: { customerId: order.customerId },
    });
    const customer = await tx.customer.findUnique({
      where: { id: order.customerId },
      select: { notes: true, phone: true, email: true },
    });

    if (
      remainingCustomerOrders === 0 &&
      customer?.notes?.includes(TEST_MARKER) &&
      customer.phone === CUSTOMER_PHONE
    ) {
      await tx.customer.delete({ where: { id: order.customerId } });
    }
  });

  console.log(`Deleted invoice UI test order ${order.orderNumber}.`);
}

async function seedInvoiceTestOrder() {
  const existing = await prisma.order.findUnique({
    where: { orderNumber: ORDER_NUMBER },
    select: { id: true, orderNumber: true },
  });

  if (existing) {
    console.log(`Invoice UI test order already exists: ${existing.orderNumber}`);
    console.log(`/admin/orders/${existing.id}`);
    return;
  }

  const variants = await prisma.productVariant.findMany({
    where: {
      isActive: true,
      product: { status: 'active' },
    },
    select: {
      id: true,
      sku: true,
      color: true,
      size: true,
      price: true,
      imagePath: true,
      product: {
        select: {
          id: true,
          name: true,
          images: {
            where: { isPrimary: true },
            select: { storagePath: true },
            take: 1,
          },
        },
      },
    },
    orderBy: [{ product: { name: 'asc' } }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    take: 3,
  });

  if (variants.length < 2) {
    throw new Error('Need at least two active product variants to make a useful invoice test order.');
  }

  const lines = variants.slice(0, 2).map((variant, index) => {
    const quantity = index === 0 ? 2 : 1;
    const unitPrice = asMoney(variant.price);
    const discountAmount = index === 0 ? 50 : 0;
    return {
      variant,
      quantity,
      unitPrice,
      discountAmount,
      lineTotal: (unitPrice - discountAmount) * quantity,
    };
  });

  const subtotalAmount = lines.reduce((total, line) => total + line.unitPrice * line.quantity, 0);
  const discountAmount = lines.reduce(
    (total, line) => total + line.discountAmount * line.quantity,
    0,
  );
  const deliveryCharge = 80;
  const totalAmount = subtotalAmount - discountAmount + deliveryCharge;

  const order = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.upsert({
      where: { phone: CUSTOMER_PHONE },
      update: {
        firstName: 'Invoice',
        lastName: 'Tester',
        email: CUSTOMER_EMAIL,
        division: 'Dhaka',
        district: 'Dhaka',
        thana: 'Mirpur',
        address: 'Invoice UI test address, delete after testing',
        notes: TEST_MARKER,
      },
      create: {
        firstName: 'Invoice',
        lastName: 'Tester',
        email: CUSTOMER_EMAIL,
        phone: CUSTOMER_PHONE,
        division: 'Dhaka',
        district: 'Dhaka',
        thana: 'Mirpur',
        address: 'Invoice UI test address, delete after testing',
        customerType: 'retail',
        isBlocked: false,
        identifierTag: 'NEW',
        notes: TEST_MARKER,
      },
    });

    return tx.order.create({
      data: {
        orderNumber: ORDER_NUMBER,
        customerId: customer.id,
        status: 'pending',
        paymentMethod: 'COD',
        firstName: 'Invoice',
        lastName: 'Tester',
        phone: CUSTOMER_PHONE,
        receiverPhone: CUSTOMER_PHONE,
        email: CUSTOMER_EMAIL,
        division: 'Dhaka',
        district: 'Dhaka',
        thana: 'Mirpur',
        address: 'Invoice UI test address, delete after testing',
        notes: TEST_MARKER,
        subtotalAmount,
        discountAmount,
        deliveryCharge,
        totalAmount,
        paidAmount: 0,
        products: {
          create: lines.map((line, index) => ({
            productId: line.variant.product.id,
            variantId: line.variant.id,
            productName: line.variant.product.name,
            variantLabel: variantLabel(line.variant),
            imagePath: line.variant.imagePath ?? line.variant.product.images[0]?.storagePath ?? null,
            sku: line.variant.sku,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            discountAmount: line.discountAmount,
            lineTotal: line.lineTotal,
            bundleTitle: index === 0 ? 'Invoice UI Test Bundle' : null,
            bundleRule: index === 0 ? 'Seeded visual test discount' : null,
          })),
        },
        orderNotes: {
          create: {
            note: `${TEST_MARKER}: seeded for invoice print UI testing.`,
            createdByName: 'Seed Script',
          },
        },
        orderEvents: {
          create: {
            eventType: 'seed',
            message: `${TEST_MARKER}: seeded invoice UI test order.`,
            createdByName: 'Seed Script',
          },
        },
      },
      select: {
        id: true,
        orderNumber: true,
        totalAmount: true,
        products: {
          select: {
            productName: true,
            variantLabel: true,
            quantity: true,
          },
        },
      },
    });
  });

  console.log(`Seeded invoice UI test order: ${order.orderNumber}`);
  console.log(`/admin/orders/${order.id}`);
  console.log(`Total: Tk ${asMoney(order.totalAmount).toFixed(2)}`);
  for (const item of order.products) {
    console.log(`- ${item.productName} (${item.variantLabel}) x ${item.quantity}`);
  }
  console.log(`Delete later with: node scripts/ops/seed-invoice-test-order.mjs --delete`);
}

try {
  if (DELETE_MODE) {
    await deleteSeededOrder();
  } else {
    await seedInvoiceTestOrder();
  }
} finally {
  await prisma.$disconnect();
}
