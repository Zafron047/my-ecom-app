'use server';

import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { requireAdminPermission, requireAdminRole } from '@/lib/admin-session';
import { prisma } from '@/lib/prisma';
import {
  PURCHASE_PAYMENT_STATUS,
  derivePurchaseEntryStatus,
  isPurchaseEntryDraft,
  isPurchaseEntryLockedClosed,
  isPurchasePaymentMethod,
  isPurchasePaymentStatus,
} from '@/lib/purchase-order-status';

type PurchaseRecordActionState = {
  error?: string;
  message?: string;
  paidAmount?: number;
  paymentMethod?: string;
  paymentReference?: string;
  paymentStatus?: string;
  receivedByLine?: Array<[string, number]>;
  status?: string;
};

const PURCHASE_ORDERS_PATH = '/admin/purchase-order';
const PURCHASE_CLOSED_PATH = '/admin/purchase-order/closed';
const RECORDS_PERMISSION_PATH = '/admin/purchase-order/records';

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

function decimalToNumber(value: Prisma.Decimal) {
  return value.toNumber();
}

function assertRecordIsEditable(status: string) {
  if (isPurchaseEntryDraft(status)) {
    throw new Error('Purchase entries must be submitted to PO before receiving or payment.');
  }
  if (isPurchaseEntryLockedClosed(status)) {
    throw new Error('This PO is closed.');
  }
}

async function requirePurchaseRecordWriteAccess() {
  await requireAdminPermission(RECORDS_PERMISSION_PATH, 'products.write');
  await requireAdminRole(RECORDS_PERMISSION_PATH, ['admin']);
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
  entryNumber: string,
  lineIndex: number,
) {
  const base = `${entryNumber}-B${String(lineIndex + 1).padStart(2, '0')}`;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const batchNumber = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const existing = await tx.inventoryBatch.findUnique({
      select: { id: true },
      where: { batchNumber },
    });
    if (!existing) return batchNumber;
  }

  return `${base}-${Date.now()}`;
}

export async function receivePurchaseRecord(
  formData: FormData,
): Promise<PurchaseRecordActionState> {
  await requirePurchaseRecordWriteAccess();

  try {
    const recordId = getString(formData, 'recordId');
    const requested = parseReceiveQuantities(formData);
    const result = await prisma.$transaction(async (tx) => {
      const record = await tx.purchaseEntry.findUnique({
        select: {
          entryNumber: true,
          id: true,
          paymentStatus: true,
          receivedAt: true,
          status: true,
          totalQuantity: true,
          lines: {
            orderBy: { createdAt: 'asc' },
            select: {
              batch: {
                select: {
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
        } else {
          const lineIndex = record.lines.findIndex(
            (candidate) => candidate.id === line.id,
          );
          const batchNumber =
            line.batchNumber ??
            (await createUniqueBatchNumber(tx, record.entryNumber, lineIndex));

          if (!line.batchNumber) {
            await tx.purchaseEntryLine.update({
              data: { batchNumber },
              where: { id: line.id },
            });
          }

          await tx.inventoryBatch.create({
            data: {
              batchNumber,
              purchaseEntryLineId: line.id,
              receivedQuantity: receiveQuantity,
              remainingQuantity: receiveQuantity,
              unitCost: line.unitCost,
              variantId: line.variantId,
            },
          });
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
      const status = derivePurchaseEntryStatus({
        paymentStatus: record.paymentStatus,
        receivedQuantity,
        totalQuantity: record.totalQuantity,
      });

      await tx.purchaseEntry.update({
        data: {
          receivedAt:
            receivedQuantity >= record.totalQuantity
              ? record.receivedAt ?? new Date()
              : null,
          status,
        },
        where: { id: record.id },
      });

      return {
        receivedByLine: [...receivedByLine.entries()],
        status,
      };
    });

    revalidatePath(PURCHASE_ORDERS_PATH);
    revalidatePath(PURCHASE_CLOSED_PATH);
    revalidatePath(`/admin/purchase-order/records/${recordId}`);
    return {
      ...result,
      message: 'Received quantities saved.',
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
  await requirePurchaseRecordWriteAccess();

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
      const record = await tx.purchaseEntry.findUnique({
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
      const status = derivePurchaseEntryStatus({
        paymentStatus: requestedPaymentStatus,
        receivedQuantity,
        totalQuantity: record.totalQuantity,
      });

      await tx.purchaseEntry.update({
        data: {
          paidAmount,
          paymentMethod,
          paymentReference,
          paymentStatus: requestedPaymentStatus,
          status,
        },
        where: { id: record.id },
      });

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
    revalidatePath(`/admin/purchase-order/records/${recordId}`);
    return {
      ...result,
      message: 'Payment saved.',
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
