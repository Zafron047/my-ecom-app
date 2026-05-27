import 'server-only';

import { SupplierFulfillmentStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import {
  createBDBuyPartnerOrder,
  type PartnerOrderPayload,
} from '@/lib/bdbuy-partner-api';
import { prisma } from '@/lib/prisma';

export const BDBUY_SUPPLIER_KEY = 'bdbuy';

type SendResult =
  | {
      ok: true;
      supplierOrderNumber: string;
    }
  | {
      ok: false;
      error: string;
    };

function getErrorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : 'Failed to send supplier fulfillment order.';
}

export async function sendBDBuyFulfillmentOrder(
  fulfillmentOrderId: string,
): Promise<SendResult> {
  const fulfillmentOrder = await prisma.supplierFulfillmentOrder.findUnique({
    where: { id: fulfillmentOrderId },
  });

  if (!fulfillmentOrder) {
    return { ok: false, error: 'Supplier fulfillment order was not found.' };
  }

  if (fulfillmentOrder.supplier !== BDBUY_SUPPLIER_KEY) {
    return { ok: false, error: 'Unsupported supplier fulfillment order.' };
  }

  try {
    const partnerResult = await createBDBuyPartnerOrder(
      fulfillmentOrder.requestPayload as PartnerOrderPayload,
    );
    const supplierOrderNumber = partnerResult.order.orderNumber;

    await prisma.supplierFulfillmentOrder.update({
      where: { id: fulfillmentOrder.id },
      data: {
        attemptCount: { increment: 1 },
        lastError: null,
        responsePayload: partnerResult as Prisma.InputJsonValue,
        sentAt: new Date(),
        status: SupplierFulfillmentStatus.sent,
        supplierOrderNumber,
      },
    });

    return { ok: true, supplierOrderNumber };
  } catch (error) {
    const message = getErrorMessage(error);
    await prisma.supplierFulfillmentOrder.update({
      where: { id: fulfillmentOrder.id },
      data: {
        attemptCount: { increment: 1 },
        lastError: message,
        status: SupplierFulfillmentStatus.failed,
      },
    });

    return { ok: false, error: message };
  }
}
