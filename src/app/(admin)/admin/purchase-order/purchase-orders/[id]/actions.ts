'use server';

import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { requireAdminPermission, requireAdminRole } from '@/lib/admin-session';
import { prisma } from '@/lib/prisma';
import {
  PURCHASE_ORDER_STATUS,
  PURCHASE_PAYMENT_STATUS,
  derivePurchaseOrderStatus,
  isPurchaseOrderDraft,
  isPurchaseOrderLockedClosed,
  isPurchasePaymentMethod,
  isPurchasePaymentStatus,
} from '@/lib/purchase-order-status';
import {
  addPurchaseOrderNote,
  createPurchaseOrderEvent,
  deletePurchaseOrderNote,
  getPurchaseOrderTimeline,
  updatePurchaseOrderNote,
} from '../../_lib/purchase-order-timeline';

type PurchaseRecordActionState = {
  batchNumberByLine?: Array<[string, string]>;
  error?: string;
  message?: string;
  timeline?: Array<{
    createdAt: string;
    createdByName: string;
    id: string;
    kind: 'event' | 'note';
    note: string;
  }>;
  notes?: string;
  paidAmount?: number;
  paymentMethod?: string;
  paymentReference?: string;
  paymentStatus?: string;
  purchaseDate?: string;
  receivedByLine?: Array<[string, number]>;
  referenceNo?: string;
  status?: string;
  supplierName?: string;
};

const PURCHASE_ORDERS_PATH = '/admin/purchase-order';
const PURCHASE_CLOSED_PATH = '/admin/purchase-order/closed';
const PURCHASE_ORDERS_PERMISSION_PATH = '/admin/purchase-order/purchase-orders';

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function getStringList(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim());
}

function parsePaymentStatus(raw: string) {
  const paymentStatus = raw || PURCHASE_PAYMENT_STATUS.DUE;
  if (!isPurchasePaymentStatus(paymentStatus)) {
    throw new Error('Payment status is invalid.');
  }
  return paymentStatus;
}

function parsePaymentMethod(raw: string) {
  if (!raw) return null;
  if (!isPurchasePaymentMethod(raw)) {
    throw new Error('Payment method is invalid.');
  }
  return raw;
}

function parsePositiveMoney(value: string, label: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive amount.`);
  }
  return new Prisma.Decimal(parsed.toFixed(2));
}

function parsePurchaseDate(raw: string) {
  const purchaseDate = raw ? new Date(raw) : new Date();
  if (Number.isNaN(purchaseDate.getTime())) {
    throw new Error('Purchase date is invalid.');
  }
  return purchaseDate;
}

function formatDateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

function decimalToNumber(value: Prisma.Decimal) {
  return value.toNumber();
}

function getBatchDatePart(purchaseDate: Date) {
  return purchaseDate.toISOString().slice(0, 10).replace(/\D/g, '');
}

function getStableFourDigitCode(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return String(1000 + (hash % 9000)).padStart(4, '0');
}

function assertRecordIsEditable(status: string) {
  if (isPurchaseOrderDraft(status)) {
    throw new Error('Purchase orders must be submitted before receiving or payment.');
  }
  if (isPurchaseOrderLockedClosed(status)) {
    throw new Error('This PO is closed.');
  }
}

async function requirePurchaseRecordWriteAccess() {
  const session = await requireAdminPermission(PURCHASE_ORDERS_PERMISSION_PATH, 'products.write');
  await requireAdminRole(PURCHASE_ORDERS_PERMISSION_PATH, ['admin']);
  return session;
}

function parseReceiveQuantities(formData: FormData) {
  const lineIds = getStringList(formData, 'lineId');
  const quantities = getStringList(formData, 'receiveQuantity');
  const requested = new Map<string, number>();

  for (const [index, lineId] of lineIds.entries()) {
    if (!lineId) continue;

    const rawQuantity = quantities[index] ?? '';
    const quantity = rawQuantity ? Number(rawQuantity) : 0;
    if (!Number.isInteger(quantity) || quantity < 0) {
      throw new Error(`Line ${index + 1}: received quantity must be a whole number.`);
    }
    if (quantity > 0) requested.set(lineId, quantity);
  }

  if ([...requested.values()].reduce((sum, quantity) => sum + quantity, 0) <= 0) {
    throw new Error('Enter at least one received quantity.');
  }

  return requested;
}

async function createUniqueBatchNumber(
  tx: Prisma.TransactionClient,
  purchaseDate: Date,
  lineId: string,
  lineIndex: number,
) {
  const datePart = getBatchDatePart(purchaseDate);
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const batchNumber = `${datePart}-${getStableFourDigitCode(
      attempt === 0 ? `${lineId}-${lineIndex}` : `${lineId}-${lineIndex}-${attempt}`,
    )}`;
    const existingBatch = await tx.inventoryBatch.findUnique({
      select: { id: true },
      where: { batchNumber },
    });
    if (existingBatch) continue;

    const existingLine = await tx.purchaseOrderLine.findUnique({
      select: { id: true },
      where: { batchNumber },
    });
    if (!existingLine || existingLine.id === lineId) return batchNumber;
  }

  return `${datePart}-${String(Date.now()).slice(-4)}`;
}

export async function updatePurchaseRecordDetails(
  formData: FormData,
): Promise<PurchaseRecordActionState> {
  const adminSession = await requirePurchaseRecordWriteAccess();

  try {
    const recordId = getString(formData, 'recordId');
    const supplierName = getString(formData, 'supplierName') || null;
    const referenceNo = getString(formData, 'referenceNo') || null;
    const purchaseDate = parsePurchaseDate(getString(formData, 'purchaseDate'));
    const notes = getString(formData, 'notes') || null;

    const record = await prisma.purchaseOrder.findUnique({
      select: {
        id: true,
        status: true,
      },
      where: { id: recordId },
    });

    if (!record) throw new Error('PO not found.');
    assertRecordIsEditable(record.status);

    await prisma.$transaction(async (tx) => {
      await tx.purchaseOrder.update({
        data: {
          notes,
          purchaseDate,
          referenceNo,
          supplierName,
        },
        where: { id: record.id },
      });
      await createPurchaseOrderEvent(tx, {
        eventType: 'po_details_updated',
        message: 'updated PO details',
        purchaseOrderId: record.id,
        session: adminSession,
      });
    });

    const timeline = await getPurchaseOrderTimeline(record.id);

    revalidatePath(PURCHASE_ORDERS_PATH);
    revalidatePath(PURCHASE_CLOSED_PATH);
    revalidatePath(`/admin/purchase-order/purchase-orders/${recordId}`);
    return {
      message: 'PO details saved.',
      notes: notes ?? '',
      purchaseDate: formatDateInput(purchaseDate),
      referenceNo: referenceNo ?? '',
      supplierName: supplierName ?? '',
      timeline,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error && error.message
          ? error.message
          : 'Failed to save PO details.',
    };
  }
}

export async function addPurchaseRecordNote(
  formData: FormData,
): Promise<PurchaseRecordActionState> {
  const adminSession = await requirePurchaseRecordWriteAccess();
  return addPurchaseOrderNote(formData, {
    failureMessage: 'Failed to add PO note.',
    mode: 'submitted',
    revalidatePaths: [PURCHASE_ORDERS_PATH, PURCHASE_CLOSED_PATH],
    revalidateRecordPath: (purchaseOrderId) =>
      `/admin/purchase-order/purchase-orders/${purchaseOrderId}`,
    session: adminSession,
    successMessage: 'PO note added.',
  });
}

export async function updatePurchaseRecordNote(
  formData: FormData,
): Promise<PurchaseRecordActionState> {
  const adminSession = await requirePurchaseRecordWriteAccess();
  return updatePurchaseOrderNote(formData, {
    failureMessage: 'Failed to update PO note.',
    mode: 'submitted',
    revalidatePaths: [PURCHASE_ORDERS_PATH, PURCHASE_CLOSED_PATH],
    revalidateRecordPath: (purchaseOrderId) =>
      `/admin/purchase-order/purchase-orders/${purchaseOrderId}`,
    session: adminSession,
    successMessage: 'PO note updated.',
  });
}

export async function deletePurchaseRecordNote(
  formData: FormData,
): Promise<PurchaseRecordActionState> {
  const adminSession = await requirePurchaseRecordWriteAccess();
  return deletePurchaseOrderNote(formData, {
    failureMessage: 'Failed to delete PO note.',
    mode: 'submitted',
    revalidatePaths: [PURCHASE_ORDERS_PATH, PURCHASE_CLOSED_PATH],
    revalidateRecordPath: (purchaseOrderId) =>
      `/admin/purchase-order/purchase-orders/${purchaseOrderId}`,
    session: adminSession,
    successMessage: 'PO note deleted.',
  });
}

export async function cancelPurchaseRecord(
  formData: FormData,
): Promise<PurchaseRecordActionState> {
  const adminSession = await requirePurchaseRecordWriteAccess();

  try {
    const recordId = getString(formData, 'recordId');
    const record = await prisma.purchaseOrder.findUnique({
      select: {
        id: true,
        status: true,
      },
      where: { id: recordId },
    });

    if (!record) throw new Error('PO not found.');
    assertRecordIsEditable(record.status);

    await prisma.$transaction(async (tx) => {
      await tx.purchaseOrder.update({
        data: {
          status: PURCHASE_ORDER_STATUS.CANCELLED,
        },
        where: { id: record.id },
      });
      await createPurchaseOrderEvent(tx, {
        eventType: 'po_cancelled',
        message: 'cancelled the PO',
        purchaseOrderId: record.id,
        session: adminSession,
      });
    });

    revalidatePath(PURCHASE_ORDERS_PATH);
    revalidatePath(PURCHASE_CLOSED_PATH);
    revalidatePath(`/admin/purchase-order/purchase-orders/${recordId}`);
    return {
      message: 'PO cancelled.',
      status: PURCHASE_ORDER_STATUS.CANCELLED,
      timeline: await getPurchaseOrderTimeline(record.id),
    };
  } catch (error) {
    return {
      error:
        error instanceof Error && error.message
          ? error.message
          : 'Failed to cancel PO.',
    };
  }
}

export async function receivePurchaseRecord(
  formData: FormData,
): Promise<PurchaseRecordActionState> {
  const adminSession = await requirePurchaseRecordWriteAccess();

  try {
    const recordId = getString(formData, 'recordId');
    const requested = parseReceiveQuantities(formData);
    const result = await prisma.$transaction(async (tx) => {
      const record = await tx.purchaseOrder.findUnique({
        select: {
          orderNumber: true,
          id: true,
          paymentStatus: true,
          purchaseDate: true,
          receivedAt: true,
          status: true,
          totalQuantity: true,
          lines: {
            orderBy: { createdAt: 'asc' },
            select: {
              batch: {
                select: {
                  batchNumber: true,
                  id: true,
                  receivedQuantity: true,
                },
              },
              batchNumber: true,
              id: true,
              quantity: true,
              unitCost: true,
              variantId: true,
            },
          },
        },
        where: { id: recordId },
      });

      if (!record) throw new Error('PO not found.');
      assertRecordIsEditable(record.status);

      const lineById = new Map(record.lines.map((line) => [line.id, line]));
      const receivedByLine = new Map(
        record.lines.map((line) => [line.id, line.batch?.receivedQuantity ?? 0]),
      );
      const batchNumberByLine = new Map(
        record.lines.map((line) => [
          line.id,
          line.batch?.batchNumber ?? line.batchNumber ?? '-',
        ]),
      );

      for (const [lineId, receiveQuantity] of requested) {
        const line = lineById.get(lineId);
        if (!line) throw new Error('One or more receive lines are invalid.');
        if (!line.variantId || !line.unitCost) {
          throw new Error('Only complete purchase lines can be received.');
        }

        const alreadyReceived = receivedByLine.get(line.id) ?? 0;
        const remainingToReceive = Math.max(0, line.quantity - alreadyReceived);
        if (receiveQuantity > remainingToReceive) {
          throw new Error(
            `Line can only receive ${remainingToReceive} more unit(s).`,
          );
        }

        if (line.batch) {
          await tx.inventoryBatch.update({
            data: {
              receivedQuantity: { increment: receiveQuantity },
              remainingQuantity: { increment: receiveQuantity },
              status: 'available',
            },
            where: { id: line.batch.id },
          });
          batchNumberByLine.set(
            line.id,
            line.batch.batchNumber ?? line.batchNumber ?? '-',
          );
        } else {
          const lineIndex = record.lines.findIndex(
            (candidate) => candidate.id === line.id,
          );
          const batchNumber =
            line.batchNumber ??
            (await createUniqueBatchNumber(
              tx,
              record.purchaseDate,
              line.id,
              lineIndex,
            ));

          if (!line.batchNumber) {
            await tx.purchaseOrderLine.update({
              data: { batchNumber },
              where: { id: line.id },
            });
          }

          await tx.inventoryBatch.create({
            data: {
              batchNumber,
              purchaseOrderLineId: line.id,
              receivedQuantity: receiveQuantity,
              remainingQuantity: receiveQuantity,
              unitCost: line.unitCost,
              variantId: line.variantId,
            },
          });
          batchNumberByLine.set(line.id, batchNumber);
        }

        await tx.productVariant.update({
          data: {
            stockQuantity: { increment: receiveQuantity },
          },
          where: { id: line.variantId },
        });

        receivedByLine.set(line.id, alreadyReceived + receiveQuantity);
      }

      const receivedQuantity = [...receivedByLine.values()].reduce(
        (sum, quantity) => sum + quantity,
        0,
      );
      const status = derivePurchaseOrderStatus({
        paymentStatus: record.paymentStatus,
        receivedQuantity,
        totalQuantity: record.totalQuantity,
      });

      await tx.purchaseOrder.update({
        data: {
          receivedAt:
            receivedQuantity >= record.totalQuantity
              ? record.receivedAt ?? new Date()
              : null,
          status,
        },
        where: { id: record.id },
      });

      const receivedNow = [...requested.values()].reduce(
        (sum, quantity) => sum + quantity,
        0,
      );
      await createPurchaseOrderEvent(tx, {
        eventType: 'goods_received',
        message: `received ${receivedNow} goods`,
        purchaseOrderId: record.id,
        session: adminSession,
      });
      if (status === PURCHASE_ORDER_STATUS.CLOSED && record.status !== PURCHASE_ORDER_STATUS.CLOSED) {
        await createPurchaseOrderEvent(tx, {
          eventType: 'po_closed',
          message: 'closed the PO',
          purchaseOrderId: record.id,
          session: adminSession,
        });
      }

      return {
        batchNumberByLine: [...batchNumberByLine.entries()],
        receivedByLine: [...receivedByLine.entries()],
        status,
      };
    });

    revalidatePath(PURCHASE_ORDERS_PATH);
    revalidatePath(PURCHASE_CLOSED_PATH);
    revalidatePath(`/admin/purchase-order/purchase-orders/${recordId}`);
    return {
      ...result,
      message: 'Received quantities saved.',
      timeline: await getPurchaseOrderTimeline(recordId),
    };
  } catch (error) {
    return {
      error:
        error instanceof Error && error.message
          ? error.message
          : 'Failed to save received quantities.',
    };
  }
}

export async function updatePurchaseRecordPayment(
  formData: FormData,
): Promise<PurchaseRecordActionState> {
  const adminSession = await requirePurchaseRecordWriteAccess();

  try {
    const recordId = getString(formData, 'recordId');
    const requestedPaymentStatus = parsePaymentStatus(
      getString(formData, 'paymentStatus'),
    );
    const requestedPaymentMethod = parsePaymentMethod(
      getString(formData, 'paymentMethod'),
    );
    const requestedPaymentReference =
      getString(formData, 'paymentReference') || null;

    const result = await prisma.$transaction(async (tx) => {
      const record = await tx.purchaseOrder.findUnique({
        select: {
          id: true,
          paidAmount: true,
          paymentStatus: true,
          status: true,
          totalCost: true,
          totalQuantity: true,
          lines: {
            select: {
              batch: {
                select: {
                  receivedQuantity: true,
                },
              },
            },
          },
        },
        where: { id: recordId },
      });

      if (!record) throw new Error('PO not found.');
      assertRecordIsEditable(record.status);

      if (
        requestedPaymentStatus !== PURCHASE_PAYMENT_STATUS.DUE &&
        !requestedPaymentMethod
      ) {
        throw new Error('Payment method is required when payment is paid or partially paid.');
      }

      const totalCostNumber = decimalToNumber(record.totalCost);
      let paidAmount = new Prisma.Decimal(0);
      if (requestedPaymentStatus === PURCHASE_PAYMENT_STATUS.PAID) {
        paidAmount = record.totalCost;
      } else if (requestedPaymentStatus === PURCHASE_PAYMENT_STATUS.PARTIAL_PAID) {
        const paymentAmount = parsePositiveMoney(
          getString(formData, 'paidAmount'),
          'Partial payment',
        );
        const basePaidAmount =
          record.paymentStatus === PURCHASE_PAYMENT_STATUS.PARTIAL_PAID
            ? record.paidAmount
            : new Prisma.Decimal(0);
        paidAmount = basePaidAmount.add(paymentAmount);
        const paidAmountNumber = paidAmount.toNumber();
        if (paidAmountNumber >= totalCostNumber) {
          throw new Error(
            'Partial payment must be greater than 0 and leave payable amount due.',
          );
        }
      }

      const paymentMethod =
        requestedPaymentStatus === PURCHASE_PAYMENT_STATUS.DUE
          ? null
          : requestedPaymentMethod;
      const paymentReference =
        requestedPaymentStatus === PURCHASE_PAYMENT_STATUS.DUE
          ? null
          : requestedPaymentReference;
      const receivedQuantity = record.lines.reduce(
        (sum, line) => sum + (line.batch?.receivedQuantity ?? 0),
        0,
      );
      const status = derivePurchaseOrderStatus({
        paymentStatus: requestedPaymentStatus,
        receivedQuantity,
        totalQuantity: record.totalQuantity,
      });

      await tx.purchaseOrder.update({
        data: {
          paidAmount,
          paymentMethod,
          paymentReference,
          paymentStatus: requestedPaymentStatus,
          status,
        },
        where: { id: record.id },
      });

      await createPurchaseOrderEvent(tx, {
        eventType: 'payment_updated',
        message: 'updated PO payment',
        purchaseOrderId: record.id,
        session: adminSession,
      });
      if (status === PURCHASE_ORDER_STATUS.CLOSED && record.status !== PURCHASE_ORDER_STATUS.CLOSED) {
        await createPurchaseOrderEvent(tx, {
          eventType: 'po_closed',
          message: 'closed the PO',
          purchaseOrderId: record.id,
          session: adminSession,
        });
      }

      return {
        paidAmount: paidAmount.toNumber(),
        paymentMethod: paymentMethod ?? '',
        paymentReference: paymentReference ?? '',
        paymentStatus: requestedPaymentStatus,
        status,
      };
    });

    revalidatePath(PURCHASE_ORDERS_PATH);
    revalidatePath(PURCHASE_CLOSED_PATH);
    revalidatePath(`/admin/purchase-order/purchase-orders/${recordId}`);
    return {
      ...result,
      message: 'Payment saved.',
      timeline: await getPurchaseOrderTimeline(recordId),
    };
  } catch (error) {
    return {
      error:
        error instanceof Error && error.message
          ? error.message
          : 'Failed to save payment.',
    };
  }
}
