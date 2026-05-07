import { cookies } from 'next/headers';
import { getAdminSession } from '@/lib/admin-session';
import {
  CUSTOMER_RECENT_ORDER_COOKIE,
  verifyRecentOrderAccessToken,
} from '@/lib/customer-auth';
import { getCustomerSession } from '@/lib/customer-session';
import { prisma } from '@/lib/prisma';

export async function GET(
  _request: Request,
  context: { params: Promise<{ orderNumber: string }> },
) {
  const { orderNumber } = await context.params;
  if (!orderNumber) {
    return Response.json({ error: 'Order number is required.' }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { orderNumber },
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
    return Response.json({ error: 'Order not found.' }, { status: 404 });
  }

  const adminSession = await getAdminSession();
  const customerSession = await getCustomerSession();
  const cookieStore = await cookies();
  const recentOrderToken = cookieStore.get(CUSTOMER_RECENT_ORDER_COOKIE)?.value ?? null;
  const recentOrderNumber = recentOrderToken
    ? verifyRecentOrderAccessToken(recentOrderToken)
    : null;
  const canAccess =
    Boolean(adminSession) ||
    (customerSession !== null && order.customerId === customerSession.customerId) ||
    (recentOrderNumber !== null && recentOrderNumber === order.orderNumber);

  if (!canAccess) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const items = order.products.map((item) => ({
    id: item.productId,
    detailId: item.productId,
    name: item.productName,
    price: Number(item.unitPrice),
    salePrice: undefined,
    quantity: item.quantity,
    image: item.product.images.find((image) => image.isPrimary)?.storagePath || item.product.images[0]?.storagePath || '',
  }));

  return Response.json({
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
  });
}
