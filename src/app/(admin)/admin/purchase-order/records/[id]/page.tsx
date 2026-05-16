import { notFound } from 'next/navigation';
import PurchaseRecordForm from '../../_components/PurchaseRecordForm';
import { requireAdminPermission } from '@/lib/admin-session';
import { prisma } from '@/lib/prisma';
import { PURCHASE_ORDER_STATUS } from '@/lib/purchase-order-status';
import {
  cancelPurchaseRecord,
  receivePurchaseRecord,
  updatePurchaseRecordDetails,
  updatePurchaseRecordPayment,
} from './actions';

type PurchaseRecordPageProps = {
  params: Promise<{ id: string }>;
};

function formatDateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatVariantLabel(variant: {
  color: string | null;
  size: string | null;
}) {
  return [variant.color, variant.size].filter(Boolean).join(' / ') || 'Standard';
}

function decimalToNumber(value: { toNumber: () => number } | null | undefined) {
  return value?.toNumber() ?? 0;
}

function getPurchaseOrderNumber(orderNumber: string) {
  return orderNumber.replace(/^PE-/, 'PO-');
}

export default async function AdminPurchaseOrderRecordPage({
  params,
}: PurchaseRecordPageProps) {
  await requireAdminPermission('/admin/purchase-order/records', 'products.read');

  const { id } = await params;
  const record = await prisma.purchaseOrder.findFirst({
    select: {
      orderNumber: true,
      id: true,
      lines: {
        orderBy: {
          createdAt: 'asc',
        },
        select: {
          batch: {
            select: {
              batchNumber: true,
              receivedQuantity: true,
            },
          },
          batchNumber: true,
          id: true,
          lineTotal: true,
          product: {
            select: {
              images: {
                orderBy: [
                  { isPrimary: 'desc' },
                  { sortOrder: 'asc' },
                ],
                select: {
                  storagePath: true,
                },
                take: 1,
              },
              name: true,
            },
          },
          quantity: true,
          unitCost: true,
          variant: {
            select: {
              color: true,
              imagePath: true,
              size: true,
              sku: true,
              product: {
                select: {
                  images: {
                    orderBy: [
                      { isPrimary: 'desc' },
                      { sortOrder: 'asc' },
                    ],
                    select: {
                      storagePath: true,
                    },
                    take: 1,
                  },
                  name: true,
                },
              },
            },
          },
        },
      },
      notes: true,
      paidAmount: true,
      paymentMethod: true,
      paymentReference: true,
      paymentStatus: true,
      purchaseDate: true,
      referenceNo: true,
      status: true,
      supplierName: true,
      totalCost: true,
      totalQuantity: true,
      updatedAt: true,
    },
    where: {
      id,
      status: {
        not: PURCHASE_ORDER_STATUS.DRAFT,
      },
    },
  });

  if (!record) notFound();

  return (
    <PurchaseRecordForm
      key={record.updatedAt.toISOString()}
      cancelAction={cancelPurchaseRecord}
      payAction={updatePurchaseRecordPayment}
      receiveAction={receivePurchaseRecord}
      updateDetailsAction={updatePurchaseRecordDetails}
      record={{
        id: record.id,
        lines: record.lines.map((line) => ({
          imagePath:
            line.variant?.imagePath ??
            line.variant?.product.images[0]?.storagePath ??
            line.product?.images[0]?.storagePath ??
            null,
          batchNumber: line.batch?.batchNumber ?? line.batchNumber ?? '-',
          id: line.id,
          lineTotal: decimalToNumber(line.lineTotal),
          orderedQuantity: line.quantity,
          productName: line.variant?.product.name ?? line.product?.name ?? '-',
          receivedQuantity: line.batch?.receivedQuantity ?? 0,
          sku: line.variant?.sku ?? '-',
          unitCost: decimalToNumber(line.unitCost),
          variantLabel: line.variant ? formatVariantLabel(line.variant) : 'Select variant',
        })),
        notes: record.notes ?? '',
        orderNumber: getPurchaseOrderNumber(record.orderNumber),
        paidAmount: decimalToNumber(record.paidAmount),
        paymentMethod: record.paymentMethod ?? '',
        paymentReference: record.paymentReference ?? '',
        paymentStatus: record.paymentStatus,
        purchaseDate: formatDateInput(record.purchaseDate),
        referenceNo: record.referenceNo ?? '',
        status: record.status,
        supplierName: record.supplierName ?? '',
        totalCost: decimalToNumber(record.totalCost),
        totalQuantity: record.totalQuantity,
      }}
    />
  );
}
