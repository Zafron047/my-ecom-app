import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { buildCheckoutPricing, type CheckoutItemInput } from '@/lib/checkout-pricing';
import { getDeliveryDivisionForDistrict } from '@/lib/delivery-locations';
import {
  CUSTOMER_RECENT_ORDER_COOKIE,
  createRecentOrderAccessToken,
} from '@/lib/customer-auth';
import { getCustomerSessionFromToken } from '@/lib/customer-session';
import { withPrivateNoStoreHeaders } from '@/lib/http-cache';
import { allocateInventoryForOrderProduct } from '@/lib/inventory-allocation';
import {
  createMetaCapiEventId,
  sendMetaPurchaseEvent,
  sendMetaServerEvent,
} from '@/lib/meta-capi';
import { sendOrderInvoiceEmail } from '@/lib/order-invoice-email';
import {
  checkDistributedRateLimit,
  getClientIp,
  rateLimitHeaders,
} from '@/lib/rate-limit';

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
  meta?: {
    initiateCheckoutEventId?: string;
  };
  abandonedCheckoutSessionId?: string;
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

function getValidMetaEventId(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 160) return undefined;
  return trimmed;
}

function buildMetaCheckoutCustomData(payload: PlaceOrderPayload) {
  return {
    content_ids: payload.items.map((item) => item.variantId ?? item.detailId ?? item.id),
    content_type: 'product',
    contents: payload.items.map((item) => ({
      id: item.variantId ?? item.detailId ?? item.id,
      item_price: item.salePrice ?? item.price,
      quantity: item.quantity,
    })),
    currency: 'BDT',
    num_items: payload.items.reduce((sum, item) => sum + item.quantity, 0),
    value: payload.totals.total,
  };
}

function getCookieValue(request: Request, name: string) {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return undefined;

  return cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

const PLACE_ORDER_RATE_LIMIT = {
  limit: 8,
  windowMs: 60_000,
};

function blockedCustomerResponse() {
  return Response.json(
    {
      code: 'CUSTOMER_BLOCKED',
      error: 'This customer account cannot place new orders.',
      redirectTo: '/unauthorized',
    },
    withPrivateNoStoreHeaders({ status: 403 }),
  );
}

export async function POST(request: Request) {
  try {
    const rateLimit = await checkDistributedRateLimit({
      key: `checkout:place-order:${getClientIp(request)}`,
      ...PLACE_ORDER_RATE_LIMIT,
    });
    if (!rateLimit.allowed) {
      return Response.json(
        { error: 'Too many checkout attempts. Please wait a moment and retry.' },
        withPrivateNoStoreHeaders({
          status: 429,
          headers: rateLimitHeaders(rateLimit, PLACE_ORDER_RATE_LIMIT.limit),
        }),
      );
    }

    const payload = (await request.json()) as PlaceOrderPayload;

    if (!payload?.customer?.firstName?.trim()) {
      return Response.json(
        { error: 'First name is required.' },
        withPrivateNoStoreHeaders({ status: 400 }),
      );
    }
    if (!payload?.customer?.customerMobile?.trim()) {
      return Response.json(
        { error: 'Customer mobile is required.' },
        withPrivateNoStoreHeaders({ status: 400 }),
      );
    }
    if (!payload?.shipping?.district?.trim() || !payload?.shipping?.thana?.trim()) {
      return Response.json(
        { error: 'Shipping location is required.' },
        withPrivateNoStoreHeaders({ status: 400 }),
      );
    }
    if (!payload?.shipping?.address?.trim()) {
      return Response.json(
        { error: 'Shipping address is required.' },
        withPrivateNoStoreHeaders({ status: 400 }),
      );
    }
    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      return Response.json(
        { error: 'At least one product is required.' },
        withPrivateNoStoreHeaders({ status: 400 }),
      );
    }
    if (payload.payment?.method !== 'bkash' && payload.payment?.method !== 'cod') {
      return Response.json(
        { error: 'Invalid payment method.' },
        withPrivateNoStoreHeaders({ status: 400 }),
      );
    }

    const resolvedDivision =
      payload.shipping.division.trim() ||
      (await getDeliveryDivisionForDistrict(payload.shipping.district.trim()));
    if (!resolvedDivision) {
      return Response.json(
        { error: 'Could not match the selected district to a delivery division.' },
        withPrivateNoStoreHeaders({ status: 400 }),
      );
    }

    const productIds = payload.items.map((item) => item.detailId ?? item.id).filter(Boolean);
    if (productIds.length === 0) {
      return Response.json(
        { error: 'Your cart is empty or outdated. Please refresh and add items again.' },
        withPrivateNoStoreHeaders({ status: 400 }),
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
        withPrivateNoStoreHeaders({ status: 400 }),
      );
    }

    for (const item of payload.items) {
      const productId = item.detailId ?? item.id;
      const product = productById.get(productId);
      if (!product) {
        return Response.json(
          {
            error: `${item.name || 'A cart item'} is no longer active. Please remove it from cart and add an available product.`,
          },
          withPrivateNoStoreHeaders({ status: 400 }),
        );
      }

      const variant =
        product.variants.find((candidate) => candidate.id === item.variantId) ??
        (product.variants.length === 1 ? product.variants[0] : undefined);
      if (!variant) {
        return Response.json(
          {
            error: `${item.name || product.name} is no longer available in the selected option. Please remove it from cart and add it again.`,
          },
          withPrivateNoStoreHeaders({ status: 400 }),
        );
      }

      const quantity = Math.max(1, Math.floor(item.quantity || 1));
      if (variant.stockQuantity <= 0) {
        const label = [variant.color, variant.size].filter(Boolean).join(' / ');
        return Response.json(
          {
            error: `${product.name}${label ? ` (${label})` : ''} is out of stock. Please remove it from cart.`,
          },
          withPrivateNoStoreHeaders({ status: 400 }),
        );
      }
      if (quantity > variant.stockQuantity) {
        return Response.json(
          {
            error: `Only ${variant.stockQuantity} piece${variant.stockQuantity === 1 ? '' : 's'} of ${product.name} are available. Please update your cart quantity.`,
          },
          withPrivateNoStoreHeaders({ status: 400 }),
        );
      }
    }
    const selectedVariantIds = [
      ...new Set(
        payload.items
          .map((item) => item.variantId)
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    const globalBundleOffers = await prisma.bundleOffer.findMany({
      where: {
        isActive: true,
        variants: {
          some: {
            variantId: { in: selectedVariantIds },
          },
        },
        OR: [{ startsAt: null }, { startsAt: { lte: new Date() } }],
        AND: [
          {
            OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }],
          },
        ],
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        variants: {
          select: { variantId: true },
        },
      },
    });
    const pricingResult = buildCheckoutPricing({
      globalBundleOffers,
      items: payload.items,
      products,
      shipping: {
        ...payload.shipping,
        division: resolvedDivision,
      },
    });
    if (!pricingResult.ok) {
      return Response.json(
        { error: pricingResult.error },
        withPrivateNoStoreHeaders({ status: 400 }),
      );
    }

    const subtotalBeforeDiscount = pricingResult.subtotalBeforeDiscount;
    const discountAmount = pricingResult.discountAmount;
    const deliveryCharge = pricingResult.deliveryCharge;
    const totalAmount = pricingResult.totalAmount;
    const normalizedPhone = normalizePhone(payload.customer.customerMobile);
    const customerSession = await getCustomerSessionFromToken(
      getCookieValue(request, 'customer_session'),
    );
    const sessionCustomer = customerSession
      ? await prisma.customer.findUnique({
          where: { id: customerSession.customerId },
        })
      : null;
    if (sessionCustomer?.isBlocked) {
      return blockedCustomerResponse();
    }

    const existingCustomerByPhone = await prisma.customer.findFirst({
      where: {
        OR: [{ phone: normalizedPhone }, { phone: payload.customer.customerMobile.trim() }],
      },
    });
    if (existingCustomerByPhone?.isBlocked) {
      return blockedCustomerResponse();
    }

    const customer =
      existingCustomerByPhone ??
      sessionCustomer ??
      (await prisma.customer.create({
        data: {
          firstName: payload.customer.firstName.trim(),
          lastName: payload.customer.lastName?.trim() || null,
          email: payload.customer.email?.trim() || null,
          phone: normalizedPhone,
          division: resolvedDivision,
          district: payload.shipping.district.trim(),
          thana: payload.shipping.thana.trim(),
          address: payload.shipping.address.trim(),
          customerType: 'retail',
          isBlocked: false,
          identifierTag: 'NEW',
        },
      }));

    const initiateCheckoutEventId = getValidMetaEventId(
      payload.meta?.initiateCheckoutEventId,
    );
    if (initiateCheckoutEventId) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL;
      const eventSourceUrl = appUrl
        ? `${appUrl.replace(/\/$/, '')}/checkout`
        : request.headers.get('referer') ?? undefined;
      await sendMetaServerEvent({
        eventId: initiateCheckoutEventId,
        eventName: 'InitiateCheckout',
        eventSourceUrl,
        request,
        user: {
          city: payload.shipping.district,
          email: payload.customer.email,
          externalId: customer.id,
          firstName: payload.customer.firstName,
          lastName: payload.customer.lastName,
          phone: normalizedPhone,
        },
        customData: {
          ...buildMetaCheckoutCustomData(payload),
          content_ids: pricingResult.lines.map((line) => line.variantId || line.productId),
          contents: pricingResult.lines.map((line) => ({
            id: line.variantId || line.productId,
            item_price: line.unitPrice,
            quantity: line.quantity,
          })),
          num_items: pricingResult.lines.reduce((sum, line) => sum + line.quantity, 0),
          value: totalAmount,
        },
      }).catch((error) => {
        console.error('Meta CAPI InitiateCheckout event failed', error);
      });
    }

    if (existingCustomerByPhone || sessionCustomer) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          firstName: payload.customer.firstName.trim(),
          lastName: payload.customer.lastName?.trim() || null,
          email: payload.customer.email?.trim() || null,
          phone: normalizedPhone,
          division: resolvedDivision,
          district: payload.shipping.district.trim(),
          thana: payload.shipping.thana.trim(),
          address: payload.shipping.address.trim(),
        },
      });
    }

    let order: Prisma.OrderGetPayload<{ include: { products: true } }> | null = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        order = await prisma.$transaction(async (tx) => {
          const createdOrder = await tx.order.create({
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
              division: resolvedDivision,
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
                  imagePath: line.imagePath || null,
                  sku: line.sku,
                  quantity: line.quantity,
                  unitPrice: line.unitPrice,
                  lineTotal: line.lineTotal,
                  discountAmount: line.discountAmount,
                  bundleTitle: line.bundleTitle,
                  bundleRule: line.bundleRule,
                })),
              },
            },
            include: {
              products: true,
            },
          });

          for (const line of createdOrder.products) {
            await allocateInventoryForOrderProduct(tx, {
              orderProductId: line.id,
              quantity: line.quantity,
              variantId: line.variantId,
            });
          }

          return createdOrder;
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
        withPrivateNoStoreHeaders({ status: 500 }),
      );
    }

    if (payload.abandonedCheckoutSessionId?.trim()) {
      await prisma.abandonedCheckout.updateMany({
        where: {
          sessionId: payload.abandonedCheckoutSessionId.trim(),
        },
        data: {
          status: 'recovered',
          recoveredOrderId: order.id,
          completedAt: new Date(),
          lastActivityAt: new Date(),
        },
      });
    }

    const metaEventId = createMetaCapiEventId('purchase', order.orderNumber);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const eventSourceUrl = appUrl
      ? `${appUrl.replace(/\/$/, '')}/order-confirmation?orderId=${encodeURIComponent(order.orderNumber)}`
      : request.headers.get('referer') ?? undefined;
    await sendMetaPurchaseEvent({
      request,
      eventId: metaEventId,
      eventSourceUrl,
      order,
    }).catch((error) => {
      console.error('Meta CAPI Purchase event failed', error);
    });

    await sendOrderInvoiceEmail(order).catch((error) => {
      console.error('Order invoice email failed', error);
    });

    const response = NextResponse.json(
      {
        success: true,
        orderId: order.orderNumber,
        metaEventId,
      },
      withPrivateNoStoreHeaders(),
    );
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
    if (
      error instanceof Error &&
      (error.message.startsWith('Insufficient stock') ||
        error.message.includes('Stock changed while saving order'))
    ) {
      return Response.json(
        { error: error.message },
        withPrivateNoStoreHeaders({ status: 400 }),
      );
    }
    const isDev = process.env.NODE_ENV !== 'production';
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to place order.';
    return Response.json(
      { error: isDev ? `Failed to place order: ${message}` : 'Failed to place order.' },
      withPrivateNoStoreHeaders({ status: 500 }),
    );
  }
}
