import { cookies } from 'next/headers';
import { getAdminSession } from '@/lib/admin-session';
import {
  CUSTOMER_RECENT_ORDER_COOKIE,
  verifyRecentOrderAccessToken,
} from '@/lib/customer-auth';
import { getCustomerSession } from '@/lib/customer-session';
import {
  getBDBuyPartnerOrder,
  isBDBuyPartnerModeEnabled,
} from '@/lib/bdbuy-partner-api';
import { withPrivateNoStoreHeaders } from '@/lib/http-cache';
import { prisma } from '@/lib/prisma';
import {
  checkDistributedRateLimit,
  getClientIp,
  rateLimitHeaders,
} from '@/lib/rate-limit';

const ORDER_LOOKUP_RATE_LIMIT = {
  limit: 30,
  windowMs: 60_000,
};

function isPartnerOrderNumber(orderNumber: string) {
  return orderNumber.startsWith('WM-');
}

export async function GET(
  request: Request,
  context: { params: Promise<{ orderNumber: string }> },
) {
  const { orderNumber } = await context.params;
  if (!orderNumber) {
    return Response.json(
      { error: 'Order number is required.' },
      withPrivateNoStoreHeaders({ status: 400 }),
    );
  }

  const rateLimit = await checkDistributedRateLimit({
    key: `orders:lookup:${getClientIp(request)}`,
    ...ORDER_LOOKUP_RATE_LIMIT,
  });
  if (!rateLimit.allowed) {
    return Response.json(
      { error: 'Too many order lookups. Please wait a moment and retry.' },
      withPrivateNoStoreHeaders({
        status: 429,
        headers: rateLimitHeaders(rateLimit, ORDER_LOOKUP_RATE_LIMIT.limit),
      }),
    );
  }

  const adminSession = await getAdminSession();
  const customerSession = await getCustomerSession();
  const cookieStore = await cookies();
  const recentOrderToken = cookieStore.get(CUSTOMER_RECENT_ORDER_COOKIE)?.value ?? null;
  const recentOrderNumber = recentOrderToken
    ? verifyRecentOrderAccessToken(recentOrderToken)
    : null;
  const hasRecentOrderAccess = recentOrderNumber === orderNumber;

  let orderWhere: { orderNumber: string; customerId?: string };
  if (adminSession || hasRecentOrderAccess) {
    orderWhere = { orderNumber };
  } else {
    if (!customerSession) {
      return Response.json(
        { error: 'Unauthorized.' },
        withPrivateNoStoreHeaders({ status: 401 }),
      );
    }

    orderWhere = { orderNumber, customerId: customerSession.customerId };
  }

  if (isBDBuyPartnerModeEnabled() && isPartnerOrderNumber(orderNumber)) {
    if (!adminSession && !hasRecentOrderAccess) {
      return Response.json(
        { error: 'Unauthorized.' },
        withPrivateNoStoreHeaders({ status: 401 }),
      );
    }

    const partnerOrder = await getBDBuyPartnerOrder(orderNumber);
    if (!partnerOrder) {
      return Response.json(
        { error: 'Order not found.' },
        withPrivateNoStoreHeaders({ status: 404 }),
      );
    }

    return Response.json(
      {
        id: partnerOrder.orderNumber,
        customer: {
          firstName: partnerOrder.customer.firstName,
          lastName: partnerOrder.customer.lastName ?? '',
          email: partnerOrder.customer.email ?? '',
          customerMobile: partnerOrder.customer.phone,
          receiverMobile: partnerOrder.customer.receiverPhone ?? partnerOrder.customer.phone,
        },
        shipping: partnerOrder.shipping,
        payment: {
          method: partnerOrder.paymentMethod === 'BKASH' ? 'bkash' : 'cod',
        },
        items: partnerOrder.items.map((item) => ({
          id: item.productId,
          detailId: item.productId,
          variantId: item.variantId,
          name: item.productName,
          price: item.unitPrice,
          salePrice: undefined,
          quantity: item.quantity,
          variantLabel: item.variantLabel ?? 'Standard',
          image: '',
          bundleTitle: null,
          bundleRule: null,
        })),
        totals: {
          subtotal: partnerOrder.totals.subtotal,
          shipping: partnerOrder.totals.shipping,
          total: partnerOrder.totals.total,
        },
        orderDate: partnerOrder.createdAt,
      },
      withPrivateNoStoreHeaders(),
    );
  }

  const order = await prisma.order.findFirst({
    where: orderWhere,
    include: {
      products: {
        include: {
          product: {
            include: {
              images: {
                orderBy: { sortOrder: 'asc' },
              },
            },
          },
        },
      },
    },
  });

  if (!order) {
    return Response.json(
      { error: 'Order not found.' },
      withPrivateNoStoreHeaders({ status: 404 }),
    );
  }

  const items = order.products.map((item) => ({
    id: item.productId,
    detailId: item.productId,
    variantId: item.variantId,
    name: item.productName,
    price: Number(item.unitPrice),
    salePrice: undefined,
    quantity: item.quantity,
    variantLabel: item.variantLabel ?? 'Standard',
    image:
      item.imagePath ||
      item.product.images.find((image) => image.isPrimary)?.storagePath ||
      item.product.images[0]?.storagePath ||
      '',
    bundleTitle: item.bundleTitle,
    bundleRule: item.bundleRule,
  }));

  return Response.json(
    {
      id: order.orderNumber,
      customer: {
        firstName: order.firstName,
        lastName: order.lastName ?? '',
        email: order.email ?? '',
        customerMobile: order.phone,
        receiverMobile: order.receiverPhone,
      },
      shipping: {
        division: order.division,
        district: order.district,
        thana: order.thana,
        address: order.address,
      },
      payment: {
        method: order.paymentMethod === 'BKASH' ? 'bkash' : 'cod',
      },
      items,
      totals: {
        subtotal: Number(order.subtotalAmount),
        shipping: Number(order.deliveryCharge),
        total: Number(order.totalAmount),
      },
      orderDate: order.createdAt.toISOString(),
    },
    withPrivateNoStoreHeaders(),
  );
}
