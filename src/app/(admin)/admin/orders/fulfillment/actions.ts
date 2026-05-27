'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminPermission } from '@/lib/admin-session';
import {
  BDBUY_SUPPLIER_KEY,
  sendBDBuyFulfillmentOrder,
} from '@/lib/supplier-fulfillment';
import { prisma } from '@/lib/prisma';

export async function retryBDBuyFulfillmentOrder(formData: FormData) {
  await requireAdminPermission('/admin/orders/fulfillment', 'orders.write');

  const fulfillmentOrderId = String(formData.get('fulfillmentOrderId') ?? '').trim();
  if (!fulfillmentOrderId) {
    throw new Error('Fulfillment order id is required.');
  }

  const fulfillmentOrder = await prisma.supplierFulfillmentOrder.findFirst({
    where: {
      id: fulfillmentOrderId,
      supplier: BDBUY_SUPPLIER_KEY,
    },
    select: {
      id: true,
      orderId: true,
    },
  });

  if (!fulfillmentOrder) {
    throw new Error('BDBuy fulfillment order was not found.');
  }

  const result = await sendBDBuyFulfillmentOrder(fulfillmentOrder.id);
  await prisma.orderEvent.create({
    data: {
      createdByName: 'Admin',
      eventType: result.ok
        ? 'supplier_fulfillment_retry_sent'
        : 'supplier_fulfillment_retry_failed',
      message: result.ok
        ? `BDBuy fulfillment retry sent as ${result.supplierOrderNumber}.`
        : `BDBuy fulfillment retry failed: ${result.error}`,
      orderId: fulfillmentOrder.orderId,
    },
  });

  revalidatePath('/admin/orders/fulfillment');
}
