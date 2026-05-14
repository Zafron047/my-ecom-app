'use server';

import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { requireAdminPermission, requireAdminRole } from '@/lib/admin-session';
import { prisma } from '@/lib/prisma';

type PurchaseEntryState = {
  draftId?: string;
  error?: string;
  message?: string;
};

type PurchaseEntryLineInput = {
  lineTotal: Prisma.Decimal | null;
  productId: string;
  quantity: number;
  unitCost: Prisma.Decimal | null;
  variantId: string | null;
};

type RecordedPurchaseEntryLine = {
  lineTotal: Prisma.Decimal;
  productId: string;
  quantity: number;
  unitCost: Prisma.Decimal;
  variantId: string;
};

const PURCHASE_ENTRY_PATH = '/admin/purchase-order/purchase-entry';
const PAYMENT_METHODS = new Set(['bank', 'bkash', 'cash']);
const PAYMENT_STATUSES = new Set(['due', 'partial_paid', 'paid']);
const PURCHASE_DRAFTS_PATH = '/admin/purchase-order/drafts';
const PURCHASE_ORDERS_PATH = '/admin/purchase-order';

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

function parseOptionalPositiveInt(value: string, label: string) {
  return value ? parsePositiveInt(value, label) : null;
}

function parsePositiveMoney(value: string, label: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive amount.`);
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

function parsePaymentStatus(raw: string) {
  const paymentStatus = raw || 'due';
  if (!PAYMENT_STATUSES.has(paymentStatus)) {
    throw new Error('Payment status is invalid.');
  }
  return paymentStatus;
}

function parsePaymentMethod(raw: string) {
  if (!raw) return null;
  if (!PAYMENT_METHODS.has(raw)) {
    throw new Error('Payment method is invalid.');
  }
  return raw;
}

function createEntryNumber() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const nonce = Math.floor(Math.random() * 9000 + 1000);
  return `PE-${datePart}-${nonce}`;
}

function calculateTotals(lines: PurchaseEntryLineInput[]) {
  return {
    totalCost: lines.reduce(
      (sum, line) => sum.add(line.lineTotal ?? new Prisma.Decimal(0)),
      new Prisma.Decimal(0),
    ),
    totalQuantity: lines.reduce((sum, line) => sum + line.quantity, 0),
  };
}

async function createUniqueEntryNumber(tx: Prisma.TransactionClient) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const entryNumber = createEntryNumber();
    const existing = await tx.purchaseEntry.findUnique({
      select: { id: true },
      where: { entryNumber },
    });
    if (!existing) return entryNumber;
  }
  return createEntryNumber();
}

async function parsePurchaseEntryLines(formData: FormData) {
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

    const quantity =
      parseOptionalPositiveInt(quantityRaw, `Line ${index + 1}: quantity`) ?? 1;
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
  }).filter((line): line is PurchaseEntryLineInput => line !== null);

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

function requireRecordedLines(lines: PurchaseEntryLineInput[]) {
  if (lines.length === 0) {
    throw new Error('Add at least one purchase line.');
  }

  return lines.map((line, index): RecordedPurchaseEntryLine => {
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
  await requireAdminPermission(PURCHASE_ENTRY_PATH, 'products.write');
}

async function requirePurchaseOwnerAccess() {
  await requirePurchaseDraftWriteAccess();
  await requireAdminRole(PURCHASE_ENTRY_PATH, ['admin']);
}

export async function savePurchaseEntryDraft(
  formData: FormData,
): Promise<PurchaseEntryState> {
  await requirePurchaseDraftWriteAccess();

  try {
    const purchaseEntryId = getString(formData, 'purchaseEntryId');
    const supplierName = getString(formData, 'supplierName') || null;
    const referenceNo = getString(formData, 'referenceNo') || null;
    const purchaseDate = parsePurchaseDate(getString(formData, 'purchaseDate'));
    const notes = getString(formData, 'notes') || null;
    const paymentStatus = parsePaymentStatus(getString(formData, 'paymentStatus'));
    const paymentMethod = parsePaymentMethod(getString(formData, 'paymentMethod'));
    const paymentReference = getString(formData, 'paymentReference') || null;
    const lines = await parsePurchaseEntryLines(formData);
    const totals = calculateTotals(lines);

    let entryNumber = '';
    const draftId = await prisma.$transaction(async (tx) => {
      let savedDraftId = purchaseEntryId;
      if (purchaseEntryId) {
        const existing = await tx.purchaseEntry.findUnique({
          select: { id: true, status: true },
          where: { id: purchaseEntryId },
        });
        if (!existing || existing.status !== 'draft') {
          throw new Error('This draft is no longer available.');
        }

        await tx.purchaseEntryLine.deleteMany({
          where: { purchaseEntryId },
        });
        await tx.purchaseEntry.update({
          data: {
            notes,
            paymentMethod,
            paymentReference,
            paymentStatus,
            purchaseDate,
            receivedAt: null,
            referenceNo,
            status: 'draft',
            supplierName,
            totalCost: totals.totalCost,
            totalQuantity: totals.totalQuantity,
          },
          where: { id: purchaseEntryId },
        });
      } else {
        entryNumber = await createUniqueEntryNumber(tx);
        const entry = await tx.purchaseEntry.create({
          data: {
            entryNumber,
            notes,
            paymentMethod,
            paymentReference,
            paymentStatus,
            purchaseDate,
            referenceNo,
            status: 'draft',
            supplierName,
            totalCost: totals.totalCost,
            totalQuantity: totals.totalQuantity,
          },
          select: { id: true },
        });
        savedDraftId = entry.id;
      }

      if (!savedDraftId) {
        throw new Error('Failed to save draft.');
      }

      if (lines.length > 0) {
        await tx.purchaseEntryLine.createMany({
          data: lines.map((line) => ({
            lineTotal: line.lineTotal,
            productId: line.productId,
            purchaseEntryId: savedDraftId,
            quantity: line.quantity,
            unitCost: line.unitCost,
            variantId: line.variantId,
          })),
        });
      }

      return savedDraftId;
    });

    revalidatePath(PURCHASE_ENTRY_PATH);
    revalidatePath(PURCHASE_DRAFTS_PATH);
    return {
      draftId,
      message: entryNumber
        ? `Draft ${entryNumber} saved.`
        : 'Draft saved.',
    };
  } catch (error) {
    return {
      error:
        error instanceof Error && error.message
          ? error.message
          : 'Failed to save draft.',
    };
  }
}

export async function discardPurchaseEntryDraft(
  formData: FormData,
): Promise<PurchaseEntryState> {
  await requirePurchaseDraftWriteAccess();

  try {
    const purchaseEntryId = getString(formData, 'purchaseEntryId');
    if (!purchaseEntryId) return { message: 'Draft discarded.' };

    const draft = await prisma.purchaseEntry.findUnique({
      select: { id: true, status: true },
      where: { id: purchaseEntryId },
    });
    if (!draft || draft.status !== 'draft') {
      throw new Error('This draft is no longer available.');
    }

    await prisma.purchaseEntry.delete({
      where: { id: purchaseEntryId },
    });

    revalidatePath(PURCHASE_ENTRY_PATH);
    revalidatePath(PURCHASE_DRAFTS_PATH);
    return { message: 'Draft discarded.' };
  } catch (error) {
    return {
      error:
        error instanceof Error && error.message
          ? error.message
          : 'Failed to discard draft.',
    };
  }
}

export async function recordPurchaseEntry(
  _previousState: PurchaseEntryState,
  formData: FormData,
): Promise<PurchaseEntryState> {
  await requirePurchaseOwnerAccess();

  try {
    const purchaseEntryId = getString(formData, 'purchaseEntryId');
    const supplierName = getString(formData, 'supplierName') || null;
    const referenceNo = getString(formData, 'referenceNo') || null;
    const purchaseDate = parsePurchaseDate(getString(formData, 'purchaseDate'));
    const notes = getString(formData, 'notes') || null;
    const paymentStatus = parsePaymentStatus(getString(formData, 'paymentStatus'));
    const paymentMethod = parsePaymentMethod(getString(formData, 'paymentMethod'));
    const paymentReference = getString(formData, 'paymentReference') || null;
    if (paymentStatus !== 'due' && !paymentMethod) {
      throw new Error('Payment method is required when payment is paid or partially paid.');
    }

    const lines = requireRecordedLines(await parsePurchaseEntryLines(formData));
    const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0);
    const totalCost = lines.reduce(
      (sum, line) => sum.add(line.lineTotal),
      new Prisma.Decimal(0),
    );

    let entryNumber = '';
    await prisma.$transaction(async (tx) => {
      let entryId = purchaseEntryId;
      if (entryId) {
        const existing = await tx.purchaseEntry.findUnique({
          select: { entryNumber: true, id: true, status: true },
          where: { id: entryId },
        });
        if (!existing || existing.status !== 'draft') {
          throw new Error('Only draft purchase entries can be recorded.');
        }
        entryNumber = existing.entryNumber;

        await tx.purchaseEntryLine.deleteMany({
          where: { purchaseEntryId: entryId },
        });
        await tx.purchaseEntry.update({
          data: {
            notes,
            paymentMethod,
            paymentReference,
            paymentStatus,
            purchaseDate,
            receivedAt: null,
            referenceNo,
            status: 'recorded',
            supplierName,
            totalCost,
            totalQuantity,
          },
          where: { id: entryId },
        });
      } else {
        entryNumber = await createUniqueEntryNumber(tx);
        const entry = await tx.purchaseEntry.create({
          data: {
            entryNumber,
            notes,
            paymentMethod,
            paymentReference,
            paymentStatus,
            purchaseDate,
            receivedAt: null,
            referenceNo,
            status: 'recorded',
            supplierName,
            totalCost,
            totalQuantity,
          },
          select: { id: true },
        });
        entryId = entry.id;
      }

      for (const line of lines) {
        await tx.purchaseEntryLine.create({
          data: {
            lineTotal: line.lineTotal,
            productId: line.productId,
            purchaseEntryId: entryId,
            quantity: line.quantity,
            unitCost: line.unitCost,
            variantId: line.variantId,
          },
        });
      }
    });

    revalidatePath(PURCHASE_ENTRY_PATH);
    revalidatePath(PURCHASE_DRAFTS_PATH);
    revalidatePath(PURCHASE_ORDERS_PATH);
    return {
      message: `Purchase entry ${entryNumber} recorded. ${totalQuantity} unit(s) locked for receiving.`,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error && error.message
          ? error.message
          : 'Failed to record purchase entry.',
    };
  }
}
