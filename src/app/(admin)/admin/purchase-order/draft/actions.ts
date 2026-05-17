'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Prisma } from '@prisma/client';
import { requireAdminPermission, requireAdminRole } from '@/lib/admin-session';
import { prisma } from '@/lib/prisma';
import {
  PURCHASE_ORDER_STATUS,
  PURCHASE_PAYMENT_STATUS,
  isPurchaseOrderDraft,
} from '@/lib/purchase-order-status';
import {
  addPurchaseOrderNote,
  createPurchaseOrderEvent,
  deletePurchaseOrderNote,
  getPurchaseOrderTimeline,
  updatePurchaseOrderNote,
} from '../_lib/purchase-order-timeline';

type PurchaseOrderState = {
  draftId?: string;
  error?: string;
  message?: string;
  timeline?: Array<{
    createdAt: string;
    createdByName: string;
    id: string;
    kind: 'event' | 'note';
    note: string;
  }>;
};

type PurchaseOrderLineInput = {
  lineTotal: Prisma.Decimal | null;
  productId: string;
  quantity: number;
  unitCost: Prisma.Decimal | null;
  variantId: string | null;
};

type RecordedPurchaseOrderLine = {
  lineTotal: Prisma.Decimal;
  productId: string;
  quantity: number;
  unitCost: Prisma.Decimal;
  variantId: string;
};

const PURCHASE_ORDER_DRAFT_PATH = '/admin/purchase-order/draft';
const PURCHASE_ORDERS_PATH = '/admin/purchase-order';
const ZERO_MONEY = new Prisma.Decimal(0);

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

function parsePositiveInt(value: string, label: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive whole number.`);
  }
  return parsed;
}

function parsePositiveMoney(value: string, label: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be greater than 0.`);
  }
  return new Prisma.Decimal(parsed.toFixed(2));
}

function parseOptionalPositiveMoney(value: string, label: string) {
  return value ? parsePositiveMoney(value, label) : null;
}

function parsePurchaseDate(raw: string) {
  const purchaseDate = raw ? new Date(raw) : new Date();
  if (Number.isNaN(purchaseDate.getTime())) {
    throw new Error('Purchase date is invalid.');
  }
  return purchaseDate;
}

function createOrderNumber() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const nonce = Math.floor(Math.random() * 9000 + 1000);
  return `PO-${datePart}-${nonce}`;
}

function calculateTotals(lines: PurchaseOrderLineInput[]) {
  return {
    totalCost: lines.reduce(
      (sum, line) => sum.add(line.lineTotal ?? new Prisma.Decimal(0)),
      new Prisma.Decimal(0),
    ),
    totalQuantity: lines.reduce((sum, line) => sum + line.quantity, 0),
  };
}

async function createUniqueOrderNumber(tx: Prisma.TransactionClient) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const orderNumber = createOrderNumber();
    const existing = await tx.purchaseOrder.findUnique({
      select: { id: true },
      where: { orderNumber },
    });
    if (!existing) return orderNumber;
  }
  return createOrderNumber();
}

async function createUniqueDraftNumber(tx: Prisma.TransactionClient) {
  return createUniqueOrderNumber(tx);
}

function normalizeOrderNumber(orderNumber: string) {
  return orderNumber.replace(/^PE-/, 'PO-');
}

async function parsePurchaseOrderLines(formData: FormData) {
  const productIds = getStringList(formData, 'productId');
  const variantIds = getStringList(formData, 'variantId');
  const quantities = getStringList(formData, 'quantity');
  const unitCosts = getStringList(formData, 'unitCost');
  const rowCount = Math.max(
    productIds.length,
    variantIds.length,
    quantities.length,
    unitCosts.length,
  );

  const lines = Array.from({ length: rowCount }, (_, index) => {
    const productId = productIds[index] ?? '';
    const variantId = variantIds[index] ?? '';
    const quantityRaw = quantities[index] ?? '';
    const unitCostRaw = unitCosts[index] ?? '';

    if (!productId && !variantId && !quantityRaw && !unitCostRaw) return null;
    if (!productId && !variantId) {
      throw new Error(`Line ${index + 1}: product or variant is required.`);
    }

    const quantity = parsePositiveInt(
      quantityRaw,
      `Line ${index + 1}: quantity`,
    );
    const unitCost = parseOptionalPositiveMoney(
      unitCostRaw,
      `Line ${index + 1}: unit cost`,
    );

    return {
      lineTotal: unitCost ? unitCost.mul(quantity) : null,
      productId,
      quantity,
      unitCost,
      variantId: variantId || null,
    };
  }).filter((line): line is PurchaseOrderLineInput => line !== null);

  const variantIdsToValidate = lines
    .map((line) => line.variantId)
    .filter((variantId): variantId is string => Boolean(variantId));
  const variants = variantIdsToValidate.length
    ? await prisma.productVariant.findMany({
        select: {
          id: true,
          productId: true,
        },
        where: {
          id: { in: variantIdsToValidate },
          isActive: true,
          product: {
            status: { not: 'archived' },
          },
        },
      })
    : [];
  const variantById = new Map(variants.map((variant) => [variant.id, variant]));

  if (variantById.size !== new Set(variantIdsToValidate).size) {
    throw new Error('One or more selected variants are unavailable.');
  }

  const normalizedLines = lines.map((line, index) => {
    const variant = line.variantId ? variantById.get(line.variantId) : null;
    const productId = variant?.productId ?? line.productId;
    if (!productId) {
      throw new Error(`Line ${index + 1}: product is required.`);
    }
    return {
      ...line,
      productId,
    };
  });

  const productIdsToValidate = normalizedLines.map((line) => line.productId);
  if (productIdsToValidate.length) {
    const validProductCount = await prisma.product.count({
      where: {
        id: { in: productIdsToValidate },
        status: { not: 'archived' },
      },
    });
    if (validProductCount !== new Set(productIdsToValidate).size) {
      throw new Error('One or more selected products are unavailable.');
    }
  }

  return normalizedLines;
}

function requireDraftLines(lines: PurchaseOrderLineInput[]) {
  if (lines.length === 0) {
    throw new Error(
      'Select at least one variant with quantity before saving a PO Draft.',
    );
  }

  return lines.map((line, index) => {
    if (!line.variantId) {
      throw new Error(`Line ${index + 1}: variant is required.`);
    }
    return line;
  });
}

function requireRecordedLines(lines: PurchaseOrderLineInput[]) {
  if (lines.length === 0) {
    throw new Error('Add at least one purchase line.');
  }

  return lines.map((line, index): RecordedPurchaseOrderLine => {
    if (!line.variantId) {
      throw new Error(`Line ${index + 1}: variant is required.`);
    }
    if (!line.unitCost || !line.lineTotal) {
      throw new Error(`Line ${index + 1}: unit cost is required.`);
    }
    return {
      lineTotal: line.lineTotal,
      productId: line.productId,
      quantity: line.quantity,
      unitCost: line.unitCost,
      variantId: line.variantId,
    };
  });
}

async function requirePurchaseDraftWriteAccess() {
  return requireAdminPermission(PURCHASE_ORDER_DRAFT_PATH, 'products.write');
}

async function requirePurchaseOwnerAccess() {
  const session = await requirePurchaseDraftWriteAccess();
  await requireAdminRole(PURCHASE_ORDER_DRAFT_PATH, ['admin']);
  return session;
}

export async function addPurchaseOrderDraftNote(
  formData: FormData,
): Promise<PurchaseOrderState> {
  const adminSession = await requirePurchaseOwnerAccess();
  return addPurchaseOrderNote(formData, {
    failureMessage: 'Failed to add PO Draft note.',
    mode: 'draft',
    revalidatePaths: [PURCHASE_ORDER_DRAFT_PATH],
    session: adminSession,
    successMessage: 'PO Draft note added.',
  });
}

export async function updatePurchaseOrderDraftNote(
  formData: FormData,
): Promise<PurchaseOrderState> {
  const adminSession = await requirePurchaseOwnerAccess();
  return updatePurchaseOrderNote(formData, {
    failureMessage: 'Failed to update PO Draft note.',
    mode: 'draft',
    revalidatePaths: [PURCHASE_ORDER_DRAFT_PATH],
    session: adminSession,
    successMessage: 'PO Draft note updated.',
  });
}

export async function deletePurchaseOrderDraftNote(
  formData: FormData,
): Promise<PurchaseOrderState> {
  const adminSession = await requirePurchaseOwnerAccess();
  return deletePurchaseOrderNote(formData, {
    failureMessage: 'Failed to delete PO Draft note.',
    mode: 'draft',
    revalidatePaths: [PURCHASE_ORDER_DRAFT_PATH],
    session: adminSession,
    successMessage: 'PO Draft note deleted.',
  });
}

export async function savePurchaseOrderDraft(
  formData: FormData,
): Promise<PurchaseOrderState> {
  const adminSession = await requirePurchaseDraftWriteAccess();

  try {
    const purchaseOrderId = getString(formData, 'purchaseOrderId');
    const supplierName = getString(formData, 'supplierName') || null;
    const referenceNo = getString(formData, 'referenceNo') || null;
    const purchaseDate = parsePurchaseDate(getString(formData, 'purchaseDate'));
    const notes = formData.has('notes') ? getString(formData, 'notes') || null : undefined;
    const lines = requireDraftLines(await parsePurchaseOrderLines(formData));
    const totals = calculateTotals(lines);

    let orderNumber = '';
    const draftId = await prisma.$transaction(async (tx) => {
      let savedDraftId = purchaseOrderId;
      const isNewDraft = !purchaseOrderId;
      if (purchaseOrderId) {
        const existing = await tx.purchaseOrder.findUnique({
          select: { id: true, status: true },
          where: { id: purchaseOrderId },
        });
        if (!existing || !isPurchaseOrderDraft(existing.status)) {
          throw new Error('This PO Draft is no longer available.');
        }

        await tx.purchaseOrderLine.deleteMany({
          where: { purchaseOrderId },
        });
        await tx.purchaseOrder.update({
          data: {
            ...(notes !== undefined ? { notes } : {}),
            paidAmount: ZERO_MONEY,
            paymentMethod: null,
            paymentReference: null,
            paymentStatus: PURCHASE_PAYMENT_STATUS.DUE,
            purchaseDate,
            receivedAt: null,
            referenceNo,
            status: PURCHASE_ORDER_STATUS.DRAFT,
            supplierName,
            totalCost: totals.totalCost,
            totalQuantity: totals.totalQuantity,
          },
          where: { id: purchaseOrderId },
        });
      } else {
        orderNumber = await createUniqueDraftNumber(tx);
        const order = await tx.purchaseOrder.create({
          data: {
            orderNumber,
            notes: notes ?? null,
            paidAmount: ZERO_MONEY,
            paymentMethod: null,
            paymentReference: null,
            paymentStatus: PURCHASE_PAYMENT_STATUS.DUE,
            purchaseDate,
            referenceNo,
            status: PURCHASE_ORDER_STATUS.DRAFT,
            supplierName,
            totalCost: totals.totalCost,
            totalQuantity: totals.totalQuantity,
          },
          select: { id: true },
        });
        savedDraftId = order.id;
        await createPurchaseOrderEvent(tx, {
          eventType: 'draft_created',
          message: 'created the PO Draft',
          purchaseOrderId: savedDraftId,
          session: adminSession,
        });
      }

      if (!savedDraftId) {
        throw new Error('Failed to save PO Draft.');
      }

      if (lines.length > 0) {
        await tx.purchaseOrderLine.createMany({
          data: lines.map((line) => ({
            lineTotal: line.lineTotal,
            productId: line.productId,
            purchaseOrderId: savedDraftId,
            quantity: line.quantity,
            unitCost: line.unitCost,
            variantId: line.variantId,
          })),
        });
      }

      if (!isNewDraft) {
        await createPurchaseOrderEvent(tx, {
          eventType: 'draft_updated',
          message: 'updated the PO Draft',
          purchaseOrderId: savedDraftId,
          session: adminSession,
        });
      }

      return savedDraftId;
    });

    revalidatePath(PURCHASE_ORDER_DRAFT_PATH);
    return {
      draftId,
      message: orderNumber
        ? `PO Draft ${orderNumber} saved.`
        : 'PO Draft updated.',
      timeline: await getPurchaseOrderTimeline(draftId),
    };
  } catch (error) {
    return {
      error:
        error instanceof Error && error.message
          ? error.message
          : 'Failed to save PO Draft.',
    };
  }
}

export async function deletePurchaseOrderDraft(
  formData: FormData,
): Promise<PurchaseOrderState> {
  await requirePurchaseOwnerAccess();

  try {
    const purchaseOrderId = getString(formData, 'purchaseOrderId');
    if (!purchaseOrderId) throw new Error('PO Draft is required.');

    const existing = await prisma.purchaseOrder.findUnique({
      select: { id: true, status: true },
      where: { id: purchaseOrderId },
    });
    if (!existing || !isPurchaseOrderDraft(existing.status)) {
      throw new Error('This PO Draft is no longer available.');
    }

    await prisma.purchaseOrder.delete({
      where: { id: existing.id },
    });

    revalidatePath(PURCHASE_ORDER_DRAFT_PATH);
    return {
      message: 'PO Draft deleted.',
    };
  } catch (error) {
    return {
      error:
        error instanceof Error && error.message
          ? error.message
          : 'Failed to delete PO Draft.',
    };
  }
}

export async function submitPurchaseOrder(
  _previousState: PurchaseOrderState,
  formData: FormData,
): Promise<PurchaseOrderState> {
  const adminSession = await requirePurchaseOwnerAccess();

  let submittedPurchaseOrderId = '';
  try {
    const purchaseOrderId = getString(formData, 'purchaseOrderId');
    const supplierName = getString(formData, 'supplierName') || null;
    const referenceNo = getString(formData, 'referenceNo') || null;
    const purchaseDate = parsePurchaseDate(getString(formData, 'purchaseDate'));
    const notes = formData.has('notes') ? getString(formData, 'notes') || null : undefined;
    const lines = requireRecordedLines(await parsePurchaseOrderLines(formData));
    const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0);
    const totalCost = lines.reduce(
      (sum, line) => sum.add(line.lineTotal),
      new Prisma.Decimal(0),
    );

    submittedPurchaseOrderId = await prisma.$transaction(async (tx) => {
      let orderId = purchaseOrderId;
      if (orderId) {
        const existing = await tx.purchaseOrder.findUnique({
          select: { orderNumber: true, id: true, status: true },
          where: { id: orderId },
        });
        if (!existing || !isPurchaseOrderDraft(existing.status)) {
          throw new Error('Only saved PO drafts can be submitted as purchase orders.');
        }

        const orderNumber = normalizeOrderNumber(existing.orderNumber);
        await tx.purchaseOrderLine.deleteMany({
          where: { purchaseOrderId: orderId },
        });
        await tx.purchaseOrder.update({
          data: {
            orderNumber: orderNumber,
            ...(notes !== undefined ? { notes } : {}),
            paidAmount: ZERO_MONEY,
            paymentMethod: null,
            paymentReference: null,
            paymentStatus: PURCHASE_PAYMENT_STATUS.DUE,
            purchaseDate,
            receivedAt: null,
            referenceNo,
            status: PURCHASE_ORDER_STATUS.OPEN,
            supplierName,
            totalCost,
            totalQuantity,
          },
          where: { id: orderId },
        });
        await createPurchaseOrderEvent(tx, {
          eventType: 'po_submitted',
          message: 'submitted the PO Draft to PO',
          purchaseOrderId: orderId,
          session: adminSession,
        });
      } else {
        const orderNumber = await createUniqueOrderNumber(tx);
        const order = await tx.purchaseOrder.create({
          data: {
            orderNumber: orderNumber,
            notes: notes ?? null,
            paidAmount: ZERO_MONEY,
            paymentMethod: null,
            paymentReference: null,
            paymentStatus: PURCHASE_PAYMENT_STATUS.DUE,
            purchaseDate,
            receivedAt: null,
            referenceNo,
            status: PURCHASE_ORDER_STATUS.OPEN,
            supplierName,
            totalCost,
            totalQuantity,
          },
          select: { id: true },
        });
        orderId = order.id;
        await createPurchaseOrderEvent(tx, {
          eventType: 'draft_created',
          message: 'created the PO Draft',
          purchaseOrderId: orderId,
          session: adminSession,
        });
        await createPurchaseOrderEvent(tx, {
          eventType: 'po_submitted',
          message: 'submitted the PO Draft to PO',
          purchaseOrderId: orderId,
          session: adminSession,
        });
      }

      for (const line of lines) {
        await tx.purchaseOrderLine.create({
          data: {
            lineTotal: line.lineTotal,
            productId: line.productId,
            purchaseOrderId: orderId,
            quantity: line.quantity,
            unitCost: line.unitCost,
            variantId: line.variantId,
          },
        });
      }

      return orderId;
    });

    revalidatePath(PURCHASE_ORDER_DRAFT_PATH);
    revalidatePath(PURCHASE_ORDERS_PATH);
  } catch (error) {
    return {
      error:
        error instanceof Error && error.message
              ? error.message
              : 'Failed to submit purchase order.',
    };
  }

  redirect(`/admin/purchase-order/purchase-orders/${submittedPurchaseOrderId}`);
}
