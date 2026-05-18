import { Prisma } from '@prisma/client';

type OpeningStockTx = Prisma.TransactionClient;

export type OpeningStockBatchInput = {
  productId: string;
  quantity: number;
  sku: string;
  unitCost: Prisma.Decimal | string | number | null;
  variantId: string;
};

export type OpeningStockBatchResult = {
  batchCount: number;
  orderNumber: string | null;
  totalQuantity: number;
};

function currentDatePart() {
  return new Date().toISOString().slice(0, 10).replace(/\D/g, '');
}

function toDecimal(value: Prisma.Decimal | string | number | null | undefined) {
  if (value instanceof Prisma.Decimal) return value;
  if (value == null || value === '') return new Prisma.Decimal(0);
  return new Prisma.Decimal(value);
}

function stableCode(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return String(1000 + (hash % 9000)).padStart(4, '0');
}

async function createUniqueOrderNumber(
  tx: OpeningStockTx,
  prefix: string,
) {
  const datePart = currentDatePart();
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const suffix = attempt === 0 ? '' : `-${String(attempt + 1).padStart(2, '0')}`;
    const orderNumber = `${prefix}-${datePart}${suffix}`;
    const existing = await tx.purchaseOrder.findUnique({
      select: { id: true },
      where: { orderNumber },
    });
    if (!existing) return orderNumber;
  }

  return `${prefix}-${datePart}-${Date.now()}`;
}

async function createUniqueBatchNumber(
  tx: OpeningStockTx,
  prefix: string,
  variantId: string,
  index: number,
) {
  const datePart = currentDatePart();
  const normalizedPrefix = prefix.replace(/[^A-Z0-9]/gi, '').slice(0, 8) || 'OPEN';

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const batchNumber = `${normalizedPrefix}-${datePart}-${stableCode(
      `${variantId}-${index}-${attempt}`,
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
    if (!existingLine) return batchNumber;
  }

  return `${normalizedPrefix}-${datePart}-${String(Date.now()).slice(-6)}`;
}

export async function createOpeningStockBatches(
  tx: OpeningStockTx,
  input: {
    note: string;
    orderNumberPrefix: string;
    variants: OpeningStockBatchInput[];
  },
): Promise<OpeningStockBatchResult> {
  const variants = input.variants.filter((variant) => variant.quantity > 0);
  if (variants.length === 0) {
    return {
      batchCount: 0,
      orderNumber: null,
      totalQuantity: 0,
    };
  }

  const totalQuantity = variants.reduce(
    (sum, variant) => sum + variant.quantity,
    0,
  );
  const totalCost = variants.reduce(
    (sum, variant) => sum.add(toDecimal(variant.unitCost).mul(variant.quantity)),
    new Prisma.Decimal(0),
  );
  const orderNumber = await createUniqueOrderNumber(
    tx,
    input.orderNumberPrefix,
  );
  const purchaseDate = new Date();

  const purchaseOrder = await tx.purchaseOrder.create({
    data: {
      notes: input.note,
      orderNumber,
      paidAmount: new Prisma.Decimal(0),
      paymentStatus: 'due',
      purchaseDate,
      receivedAt: purchaseDate,
      status: 'received',
      supplierName: 'Opening stock',
      totalCost,
      totalQuantity,
    },
    select: { id: true },
  });

  for (const [index, variant] of variants.entries()) {
    const unitCost = toDecimal(variant.unitCost);
    const batchNumber = await createUniqueBatchNumber(
      tx,
      input.orderNumberPrefix,
      variant.variantId,
      index,
    );
    const line = await tx.purchaseOrderLine.create({
      data: {
        batchNumber,
        lineTotal: unitCost.mul(variant.quantity),
        productId: variant.productId,
        purchaseOrderId: purchaseOrder.id,
        quantity: variant.quantity,
        unitCost,
        variantId: variant.variantId,
      },
      select: { id: true },
    });

    await tx.inventoryBatch.create({
      data: {
        batchNumber,
        purchaseOrderLineId: line.id,
        receivedAt: purchaseDate,
        receivedQuantity: variant.quantity,
        remainingQuantity: variant.quantity,
        status: 'available',
        unitCost,
        variantId: variant.variantId,
      },
    });

    await tx.productVariant.update({
      data: {
        stockQuantity: variant.quantity,
      },
      where: { id: variant.variantId },
    });
  }

  return {
    batchCount: variants.length,
    orderNumber,
    totalQuantity,
  };
}
