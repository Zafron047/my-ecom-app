import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { createOpeningStockBatches } from '@/lib/opening-stock-batches';

function createTx() {
  return {
    inventoryBatch: {
      create: vi.fn(async () => ({})),
      findUnique: vi.fn(async () => null),
    },
    productVariant: {
      update: vi.fn(async () => ({})),
    },
    purchaseOrder: {
      create: vi.fn(async () => ({ id: 'po-1' })),
      findUnique: vi.fn(async () => null),
    },
    purchaseOrderLine: {
      create: vi.fn(async () => ({ id: 'line-1' })),
      findUnique: vi.fn(async () => null),
    },
  };
}

describe('createOpeningStockBatches', () => {
  it('creates a received PO line and inventory batch for opening stock', async () => {
    const tx = createTx();

    const result = await createOpeningStockBatches(tx as never, {
      note: 'restore stock',
      orderNumberPrefix: 'PO-RESTORE',
      variants: [
        {
          productId: 'product-1',
          quantity: 12,
          sku: 'SKU-1',
          unitCost: new Prisma.Decimal('5.50'),
          variantId: 'variant-1',
        },
      ],
    });

    expect(result.batchCount).toBe(1);
    expect(result.totalQuantity).toBe(12);
    expect(result.orderNumber).toMatch(/^PO-RESTORE-\d{8}/);
    expect(tx.purchaseOrder.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        notes: 'restore stock',
        receivedAt: expect.any(Date),
        status: 'received',
        supplierName: 'Opening stock',
        totalCost: new Prisma.Decimal('66.00'),
        totalQuantity: 12,
      }),
      select: { id: true },
    });
    expect(tx.purchaseOrderLine.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        lineTotal: new Prisma.Decimal('66.00'),
        productId: 'product-1',
        purchaseOrderId: 'po-1',
        quantity: 12,
        unitCost: new Prisma.Decimal('5.50'),
        variantId: 'variant-1',
      }),
      select: { id: true },
    });
    expect(tx.inventoryBatch.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        purchaseOrderLineId: 'line-1',
        receivedQuantity: 12,
        remainingQuantity: 12,
        status: 'available',
        unitCost: new Prisma.Decimal('5.50'),
        variantId: 'variant-1',
      }),
    });
    expect(tx.productVariant.update).toHaveBeenCalledWith({
      data: {
        stockQuantity: 12,
      },
      where: { id: 'variant-1' },
    });
  });

  it('does not create a PO when there is no positive stock', async () => {
    const tx = createTx();

    const result = await createOpeningStockBatches(tx as never, {
      note: 'empty',
      orderNumberPrefix: 'PO-RESTORE',
      variants: [
        {
          productId: 'product-1',
          quantity: 0,
          sku: 'SKU-1',
          unitCost: null,
          variantId: 'variant-1',
        },
      ],
    });

    expect(result).toEqual({
      batchCount: 0,
      orderNumber: null,
      totalQuantity: 0,
    });
    expect(tx.purchaseOrder.create).not.toHaveBeenCalled();
    expect(tx.inventoryBatch.create).not.toHaveBeenCalled();
  });
});
