import { Prisma, type OrderStatus } from '@prisma/client';

type InventoryTx = Prisma.TransactionClient;

export const STOCK_HOLDING_ORDER_STATUSES = new Set<OrderStatus>([
  'pending',
  'confirmed',
  'processing',
  'onHold',
  'shipped',
  'delivered',
]);

export function isStockHoldingOrderStatus(status: OrderStatus | string) {
  return STOCK_HOLDING_ORDER_STATUSES.has(status as OrderStatus);
}

export async function allocateInventoryForOrderProduct(
  tx: InventoryTx,
  input: {
    orderProductId: string;
    quantity: number;
    variantId: string;
  },
) {
  let remainingToAllocate = input.quantity;
  if (remainingToAllocate <= 0) return;

  const batches = await tx.inventoryBatch.findMany({
    orderBy: [{ receivedAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      remainingQuantity: true,
      unitCost: true,
    },
    where: {
      remainingQuantity: { gt: 0 },
      status: 'available',
      variantId: input.variantId,
    },
  });

  const availableQuantity = batches.reduce(
    (sum, batch) => sum + batch.remainingQuantity,
    0,
  );
  if (availableQuantity < remainingToAllocate) {
    throw new Error(
      `Insufficient stock for selected variant. Available ${availableQuantity}, requested ${input.quantity}.`,
    );
  }

  for (const batch of batches) {
    if (remainingToAllocate <= 0) break;

    const quantityFromBatch = Math.min(batch.remainingQuantity, remainingToAllocate);
    const updateResult = await tx.inventoryBatch.updateMany({
      data: {
        remainingQuantity: {
          decrement: quantityFromBatch,
        },
        status:
          batch.remainingQuantity - quantityFromBatch <= 0
            ? 'depleted'
            : 'available',
      },
      where: {
        id: batch.id,
        remainingQuantity: { gte: quantityFromBatch },
      },
    });

    if (updateResult.count !== 1) {
      throw new Error('Stock changed while saving order. Please retry.');
    }

    await tx.inventoryAllocation.create({
      data: {
        orderProductId: input.orderProductId,
        inventoryBatchId: batch.id,
        variantId: input.variantId,
        quantity: quantityFromBatch,
        unitCost: batch.unitCost,
      },
    });

    remainingToAllocate -= quantityFromBatch;
  }

  await tx.productVariant.update({
    data: {
      stockQuantity: {
        decrement: input.quantity,
      },
    },
    where: { id: input.variantId },
  });
}

export async function releaseInventoryAllocationsForOrderProducts(
  tx: InventoryTx,
  input: {
    orderProductIds: string[];
    reason: string;
  },
) {
  if (input.orderProductIds.length === 0) return;

  const allocations = await tx.inventoryAllocation.findMany({
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      inventoryBatchId: true,
      orderProductId: true,
      quantity: true,
      unitCost: true,
      variantId: true,
    },
    where: {
      orderProductId: { in: input.orderProductIds },
      releasedAt: null,
    },
  });

  await releaseInventoryAllocations(tx, {
    allocations,
    reason: input.reason,
  });
}

export async function reconcileOrderProductInventoryAllocation(
  tx: InventoryTx,
  input: {
    orderProductId: string;
    quantity: number;
    reason: string;
    variantId: string;
  },
) {
  const allocations = await tx.inventoryAllocation.findMany({
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      inventoryBatchId: true,
      orderProductId: true,
      quantity: true,
      unitCost: true,
      variantId: true,
    },
    where: {
      orderProductId: input.orderProductId,
      releasedAt: null,
    },
  });
  const allocatedQuantity = allocations.reduce(
    (sum, allocation) => sum + allocation.quantity,
    0,
  );

  if (allocatedQuantity < input.quantity) {
    await allocateInventoryForOrderProduct(tx, {
      orderProductId: input.orderProductId,
      quantity: input.quantity - allocatedQuantity,
      variantId: input.variantId,
    });
    return;
  }

  if (allocatedQuantity > input.quantity) {
    await releaseInventoryQuantity(tx, {
      allocations,
      quantity: allocatedQuantity - input.quantity,
      reason: input.reason,
    });
  }
}

async function releaseInventoryQuantity(
  tx: InventoryTx,
  input: {
    allocations: Array<{
      id: string;
      inventoryBatchId: string;
      orderProductId: string;
      quantity: number;
      unitCost: Prisma.Decimal;
      variantId: string;
    }>;
    quantity: number;
    reason: string;
  },
) {
  let remainingToRelease = input.quantity;

  for (const allocation of input.allocations) {
    if (remainingToRelease <= 0) break;

    const releasedQuantity = Math.min(allocation.quantity, remainingToRelease);
    if (releasedQuantity === allocation.quantity) {
      await releaseInventoryAllocations(tx, {
        allocations: [allocation],
        reason: input.reason,
      });
    } else {
      const updateResult = await tx.inventoryAllocation.updateMany({
        data: {
          quantity: {
            decrement: releasedQuantity,
          },
        },
        where: {
          id: allocation.id,
          quantity: { gte: releasedQuantity },
          releasedAt: null,
        },
      });
      if (updateResult.count !== 1) {
        continue;
      }
      await tx.inventoryAllocation.create({
        data: {
          orderProductId: allocation.orderProductId,
          inventoryBatchId: allocation.inventoryBatchId,
          variantId: allocation.variantId,
          quantity: releasedQuantity,
          unitCost: allocation.unitCost,
          releasedAt: new Date(),
          releaseReason: input.reason,
        },
      });
      await restoreBatchQuantity(tx, {
        inventoryBatchId: allocation.inventoryBatchId,
        quantity: releasedQuantity,
        variantId: allocation.variantId,
      });
    }

    remainingToRelease -= releasedQuantity;
  }
}

async function releaseInventoryAllocations(
  tx: InventoryTx,
  input: {
    allocations: Array<{
      id: string;
      inventoryBatchId: string;
      orderProductId?: string;
      quantity: number;
      unitCost?: Prisma.Decimal;
      variantId: string;
    }>;
    reason: string;
  },
) {
  const releasedAt = new Date();

  for (const allocation of input.allocations) {
    const updateResult = await tx.inventoryAllocation.updateMany({
      data: {
        releasedAt,
        releaseReason: input.reason,
      },
      where: {
        id: allocation.id,
        releasedAt: null,
      },
    });
    if (updateResult.count !== 1) {
      continue;
    }
    await restoreBatchQuantity(tx, {
      inventoryBatchId: allocation.inventoryBatchId,
      quantity: allocation.quantity,
      variantId: allocation.variantId,
    });
  }
}

async function restoreBatchQuantity(
  tx: InventoryTx,
  input: {
    inventoryBatchId: string;
    quantity: number;
    variantId: string;
  },
) {
  const batchUpdateResult = await tx.inventoryBatch.updateMany({
    data: {
      remainingQuantity: {
        increment: input.quantity,
      },
      status: 'available',
    },
    where: {
      id: input.inventoryBatchId,
      variantId: input.variantId,
    },
  });
  if (batchUpdateResult.count !== 1) {
    throw new Error('Inventory batch did not match the released allocation.');
  }

  await tx.productVariant.update({
    data: {
      stockQuantity: {
        increment: input.quantity,
      },
    },
    where: { id: input.variantId },
  });
}
