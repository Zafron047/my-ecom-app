import { describe, expect, it, vi } from 'vitest';
import { releaseInventoryAllocationsForOrderProducts } from '@/lib/inventory-allocation';

type Allocation = {
  id: string;
  inventoryBatchId: string;
  orderProductId: string;
  quantity: number;
  unitCost: unknown;
  variantId: string;
};

function createInventoryTx(
  allocations: Allocation[],
  updateCounts?: number[],
  batchUpdateCounts?: number[],
) {
  const remainingUpdateCounts = [...(updateCounts ?? allocations.map(() => 1))];
  const remainingBatchUpdateCounts = [
    ...(batchUpdateCounts ?? allocations.map(() => 1)),
  ];

  return {
    inventoryAllocation: {
      findMany: vi.fn(async () => allocations),
      updateMany: vi.fn(async () => ({
        count: remainingUpdateCounts.shift() ?? 1,
      })),
    },
    inventoryBatch: {
      updateMany: vi.fn(async () => ({
        count: remainingBatchUpdateCounts.shift() ?? 1,
      })),
    },
    productVariant: {
      update: vi.fn(async () => ({})),
    },
  };
}

describe('releaseInventoryAllocationsForOrderProducts', () => {
  it('restores each released allocation to the same inventory batch', async () => {
    const allocations: Allocation[] = [
      {
        id: 'alloc-a',
        inventoryBatchId: 'batch-a',
        orderProductId: 'line-1',
        quantity: 3,
        unitCost: null,
        variantId: 'variant-1',
      },
      {
        id: 'alloc-b',
        inventoryBatchId: 'batch-b',
        orderProductId: 'line-1',
        quantity: 2,
        unitCost: null,
        variantId: 'variant-1',
      },
    ];
    const tx = createInventoryTx(allocations);

    await releaseInventoryAllocationsForOrderProducts(tx as never, {
      orderProductIds: ['line-1'],
      reason: 'order-status-returned',
    });

    expect(tx.inventoryAllocation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          orderProductId: { in: ['line-1'] },
          releasedAt: null,
        },
      }),
    );
    expect(tx.inventoryAllocation.updateMany).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        releaseReason: 'order-status-returned',
      }),
      where: {
        id: 'alloc-a',
        releasedAt: null,
      },
    });
    expect(tx.inventoryAllocation.updateMany).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        releaseReason: 'order-status-returned',
      }),
      where: {
        id: 'alloc-b',
        releasedAt: null,
      },
    });
    expect(tx.inventoryBatch.updateMany).toHaveBeenNthCalledWith(1, {
      data: {
        remainingQuantity: {
          increment: 3,
        },
        status: 'available',
      },
      where: { id: 'batch-a', variantId: 'variant-1' },
    });
    expect(tx.inventoryBatch.updateMany).toHaveBeenNthCalledWith(2, {
      data: {
        remainingQuantity: {
          increment: 2,
        },
        status: 'available',
      },
      where: { id: 'batch-b', variantId: 'variant-1' },
    });
    expect(tx.productVariant.update).toHaveBeenNthCalledWith(1, {
      data: {
        stockQuantity: {
          increment: 3,
        },
      },
      where: { id: 'variant-1' },
    });
    expect(tx.productVariant.update).toHaveBeenNthCalledWith(2, {
      data: {
        stockQuantity: {
          increment: 2,
        },
      },
      where: { id: 'variant-1' },
    });
  });

  it('does not restore stock when the allocation was already released', async () => {
    const allocations: Allocation[] = [
      {
        id: 'alloc-a',
        inventoryBatchId: 'batch-a',
        orderProductId: 'line-1',
        quantity: 3,
        unitCost: null,
        variantId: 'variant-1',
      },
      {
        id: 'alloc-b',
        inventoryBatchId: 'batch-b',
        orderProductId: 'line-1',
        quantity: 2,
        unitCost: null,
        variantId: 'variant-1',
      },
    ];
    const tx = createInventoryTx(allocations, [1, 0]);

    await releaseInventoryAllocationsForOrderProducts(tx as never, {
      orderProductIds: ['line-1'],
      reason: 'order-status-returned',
    });

    expect(tx.inventoryAllocation.updateMany).toHaveBeenCalledTimes(2);
    expect(tx.inventoryBatch.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.inventoryBatch.updateMany).toHaveBeenCalledWith({
      data: {
        remainingQuantity: {
          increment: 3,
        },
        status: 'available',
      },
      where: { id: 'batch-a', variantId: 'variant-1' },
    });
    expect(tx.productVariant.update).toHaveBeenCalledTimes(1);
  });

  it('fails instead of restoring when the allocation batch and variant do not match', async () => {
    const allocations: Allocation[] = [
      {
        id: 'alloc-a',
        inventoryBatchId: 'batch-a',
        orderProductId: 'line-1',
        quantity: 3,
        unitCost: null,
        variantId: 'variant-1',
      },
    ];
    const tx = createInventoryTx(allocations, [1], [0]);

    await expect(
      releaseInventoryAllocationsForOrderProducts(tx as never, {
        orderProductIds: ['line-1'],
        reason: 'order-status-returned',
      }),
    ).rejects.toThrow('Inventory batch did not match the released allocation.');

    expect(tx.productVariant.update).not.toHaveBeenCalled();
  });
});
