import { NextResponse } from 'next/server';
import { requireAdminApiPermission } from '@/lib/admin-api-auth';
import { prisma } from '@/lib/prisma';

function escapeCsvValue(value: string) {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsvLine(values: Array<string | number | null>) {
  return values
    .map((value) => {
      if (value === null) return '';
      return escapeCsvValue(String(value));
    })
    .join(',');
}

export async function GET() {
  const auth = await requireAdminApiPermission('products.export');
  if (auth.response) return auth.response;

  const batches = await prisma.inventoryBatch.findMany({
    orderBy: [{ receivedAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    select: {
      batchNumber: true,
      createdAt: true,
      receivedAt: true,
      receivedQuantity: true,
      remainingQuantity: true,
      status: true,
      unitCost: true,
      variant: {
        select: {
          sku: true,
          product: {
            select: {
              name: true,
              slug: true,
            },
          },
        },
      },
      purchaseOrderLine: {
        select: {
          purchaseOrder: {
            select: {
              orderNumber: true,
              purchaseDate: true,
            },
          },
        },
      },
    },
  });

  const headers = [
    'purchase_order_number',
    'purchase_date',
    'variant_sku',
    'product_slug',
    'product_title',
    'batch_number',
    'received_quantity',
    'remaining_quantity',
    'unit_cost',
    'received_at',
    'batch_status',
    'created_at',
  ];

  const rows = batches.map((batch) =>
    toCsvLine([
      batch.purchaseOrderLine.purchaseOrder.orderNumber,
      batch.purchaseOrderLine.purchaseOrder.purchaseDate.toISOString(),
      batch.variant.sku,
      batch.variant.product.slug,
      batch.variant.product.name,
      batch.batchNumber,
      batch.receivedQuantity,
      batch.remainingQuantity,
      batch.unitCost.toString(),
      batch.receivedAt.toISOString(),
      batch.status,
      batch.createdAt.toISOString(),
    ]),
  );

  const csvContent = [toCsvLine(headers), ...rows].join('\n');
  const now = new Date();
  const pad2 = (value: number) => String(value).padStart(2, '0');
  const dateTag = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const timeTag = `${pad2(now.getHours())}-${pad2(now.getMinutes())}`;

  return new NextResponse(csvContent, {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Disposition': `attachment; filename="inventory-batches-${dateTag}-${timeTag}.csv"`,
      'Content-Type': 'text/csv; charset=utf-8',
    },
  });
}
