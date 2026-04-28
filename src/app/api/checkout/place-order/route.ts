import { prisma } from '@/lib/prisma';

type CheckoutItemInput = {
  id: string;
  detailId?: string;
  name: string;
  price: number;
  salePrice?: number;
  quantity: number;
};

type PlaceOrderPayload = {
  customer: {
    firstName: string;
    lastName?: string;
    email?: string;
    customerMobile: string;
    receiverMobile?: string;
  };
  shipping: {
    division: string;
    district: string;
    thana: string;
    address: string;
  };
  payment: {
    method: 'bkash' | 'cod';
  };
  items: CheckoutItemInput[];
  totals: {
    subtotal: number;
    shipping: number;
    total: number;
  };
};

function createOrderNumber() {
  const time = Date.now().toString().slice(-10);
  const nonce = Math.floor(Math.random() * 9000 + 1000);
  return `ORD-${time}-${nonce}`;
}

function toMoney(value: number) {
  return Number(value.toFixed(2));
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as PlaceOrderPayload;

    if (!payload?.customer?.firstName?.trim()) {
      return Response.json({ error: 'First name is required.' }, { status: 400 });
    }
    if (!payload?.customer?.customerMobile?.trim()) {
      return Response.json({ error: 'Customer mobile is required.' }, { status: 400 });
    }
    if (!payload?.shipping?.division?.trim() || !payload?.shipping?.district?.trim() || !payload?.shipping?.thana?.trim()) {
      return Response.json({ error: 'Shipping location is required.' }, { status: 400 });
    }
    if (!payload?.shipping?.address?.trim()) {
      return Response.json({ error: 'Shipping address is required.' }, { status: 400 });
    }
    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      return Response.json({ error: 'At least one product is required.' }, { status: 400 });
    }
    if (payload.payment?.method !== 'bkash' && payload.payment?.method !== 'cod') {
      return Response.json({ error: 'Invalid payment method.' }, { status: 400 });
    }

    const productIds = payload.items.map((item) => item.detailId ?? item.id).filter(Boolean);
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        status: 'active',
      },
      include: {
        variants: {
          where: { isActive: true },
          orderBy: [{ price: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    const productById = new Map(products.map((product) => [product.id, product]));
    const lineItems: Array<{
      productId: string;
      variantId: string;
      productName: string;
      variantLabel: string;
      sku: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }> = [];

    for (const item of payload.items) {
      const productId = item.detailId ?? item.id;
      const product = productById.get(productId);
      const variant = product?.variants[0];
      if (!product || !variant) {
        return Response.json(
          { error: `Product variant not found for item ${item.name}.` },
          { status: 400 },
        );
      }

      const quantity = Math.max(1, Math.floor(item.quantity || 1));
      const itemUnitPrice = toMoney(item.salePrice ?? item.price);
      const lineTotal = toMoney(itemUnitPrice * quantity);
      const variantLabel = [variant.color, variant.size].filter(Boolean).join(' / ');

      lineItems.push({
        productId: product.id,
        variantId: variant.id,
        productName: product.name,
        variantLabel,
        sku: variant.sku,
        quantity,
        unitPrice: itemUnitPrice,
        lineTotal,
      });
    }

    const subtotal = toMoney(payload.totals.subtotal);
    const deliveryCharge = toMoney(payload.totals.shipping);
    const totalAmount = toMoney(payload.totals.total);
    const orderNumber = createOrderNumber();

    const existingCustomerByPhone = await prisma.customer.findUnique({
      where: { phone: payload.customer.customerMobile.trim() },
    });

    const customer =
      existingCustomerByPhone ??
      (await prisma.customer.create({
        data: {
          firstName: payload.customer.firstName.trim(),
          lastName: payload.customer.lastName?.trim() || null,
          email: payload.customer.email?.trim() || null,
          phone: payload.customer.customerMobile.trim(),
          customerType: 'retail',
          isBlocked: false,
          identifierTag: 'NEW',
        },
      }));

    if (existingCustomerByPhone) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          firstName: payload.customer.firstName.trim(),
          lastName: payload.customer.lastName?.trim() || null,
          email: payload.customer.email?.trim() || null,
        },
      });
    }

    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerId: customer.id,
        status: 'pending',
        paymentMethod: payload.payment.method === 'bkash' ? 'BKASH' : 'COD',
        firstName: payload.customer.firstName.trim(),
        lastName: payload.customer.lastName?.trim() || null,
        phone: payload.customer.customerMobile.trim(),
        receiverPhone: payload.customer.receiverMobile?.trim() || payload.customer.customerMobile.trim(),
        email: payload.customer.email?.trim() || null,
        division: payload.shipping.division.trim(),
        district: payload.shipping.district.trim(),
        thana: payload.shipping.thana.trim(),
        address: payload.shipping.address.trim(),
        subtotalAmount: subtotal,
        deliveryCharge,
        totalAmount,
        discountAmount: 0,
        products: {
          create: lineItems.map((line) => ({
            productId: line.productId,
            variantId: line.variantId,
            productName: line.productName,
            variantLabel: line.variantLabel || null,
            sku: line.sku,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            lineTotal: line.lineTotal,
            discountAmount: 0,
          })),
        },
      },
      include: {
        products: true,
      },
    });

    return Response.json({
      success: true,
      orderId: order.orderNumber,
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to place order.' }, { status: 500 });
  }
}

