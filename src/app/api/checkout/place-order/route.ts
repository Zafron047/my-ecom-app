import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { buildCheckoutPricing, type CheckoutItemInput } from '@/lib/checkout-pricing';
import {
  CUSTOMER_RECENT_ORDER_COOKIE,
  createRecentOrderAccessToken,
} from '@/lib/customer-auth';

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

function normalizePhone(phone: string) {
  const trimmed = phone.trim();
  if (trimmed.startsWith('+880')) {
    return `0${trimmed.slice(4)}`;
  }
  return trimmed;
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
    if (productIds.length === 0) {
      return Response.json(
        { error: 'Your cart is empty or outdated. Please refresh and add items again.' },
        { status: 400 },
      );
    }
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
        bundleOffers: {
          where: { isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            variants: {
              select: { variantId: true },
            },
          },
        },
      },
    });

    const productById = new Map(products.map((product) => [product.id, product]));
    if (productById.size === 0) {
      return Response.json(
        {
          error:
            'Your cart items are outdated after recent data reset. Please clear cart and add products again.',
        },
        { status: 400 },
      );
    }
    const pricingResult = buildCheckoutPricing({
      items: payload.items,
      products,
      shipping: payload.shipping,
    });
    if (!pricingResult.ok) {
      return Response.json({ error: pricingResult.error }, { status: 400 });
    }

    const subtotalBeforeDiscount = pricingResult.subtotalBeforeDiscount;
    const discountAmount = pricingResult.discountAmount;
    const deliveryCharge = pricingResult.deliveryCharge;
    const totalAmount = pricingResult.totalAmount;
    const normalizedPhone = normalizePhone(payload.customer.customerMobile);
    const existingCustomerByPhone = await prisma.customer.findFirst({
      where: {
        OR: [{ phone: normalizedPhone }, { phone: payload.customer.customerMobile.trim() }],
      },
    });

    const customer =
      existingCustomerByPhone ??
      (await prisma.customer.create({
        data: {
          firstName: payload.customer.firstName.trim(),
          lastName: payload.customer.lastName?.trim() || null,
          email: payload.customer.email?.trim() || null,
          phone: normalizedPhone,
          division: payload.shipping.division.trim(),
          district: payload.shipping.district.trim(),
          thana: payload.shipping.thana.trim(),
          address: payload.shipping.address.trim(),
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
          phone: normalizedPhone,
          division: payload.shipping.division.trim(),
          district: payload.shipping.district.trim(),
          thana: payload.shipping.thana.trim(),
          address: payload.shipping.address.trim(),
        },
      });
    }

    let order = null as Awaited<ReturnType<typeof prisma.order.create>> | null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        order = await prisma.order.create({
          data: {
            orderNumber: createOrderNumber(),
            customerId: customer.id,
            status: 'pending',
            paymentMethod: payload.payment.method === 'bkash' ? 'BKASH' : 'COD',
            firstName: payload.customer.firstName.trim(),
            lastName: payload.customer.lastName?.trim() || null,
            phone: normalizedPhone,
            receiverPhone:
              payload.customer.receiverMobile?.trim() || payload.customer.customerMobile.trim(),
            email: payload.customer.email?.trim() || null,
            division: payload.shipping.division.trim(),
            district: payload.shipping.district.trim(),
            thana: payload.shipping.thana.trim(),
            address: payload.shipping.address.trim(),
            subtotalAmount: subtotalBeforeDiscount,
            deliveryCharge,
            totalAmount,
            discountAmount,
            products: {
              create: pricingResult.lines.map((line) => ({
                productId: line.productId,
                variantId: line.variantId,
                productName: line.productName,
                variantLabel: line.variantLabel || null,
                sku: line.sku,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                lineTotal: line.lineTotal,
                discountAmount: line.discountAmount,
              })),
            },
          },
          include: {
            products: true,
          },
        });
        break;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          attempt < 2
        ) {
          continue;
        }
        throw error;
      }
    }

    if (!order) {
      return Response.json(
        { error: 'Could not generate a unique order number. Please retry.' },
        { status: 500 },
      );
    }

    const response = NextResponse.json({
      success: true,
      orderId: order.orderNumber,
    });
    const recentOrderToken = createRecentOrderAccessToken(order.orderNumber);
    if (recentOrderToken) {
      response.cookies.set(CUSTOMER_RECENT_ORDER_COOKIE, recentOrderToken, {
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24,
      });
    }
    return response;
  } catch (error) {
    console.error(error);
    const isDev = process.env.NODE_ENV !== 'production';
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to place order.';
    return Response.json(
      { error: isDev ? `Failed to place order: ${message}` : 'Failed to place order.' },
      { status: 500 },
    );
  }
}
