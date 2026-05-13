import { notFound } from 'next/navigation';
import PurchaseRecordForm from '../../_components/PurchaseRecordForm';
import { requireAdminPermission } from '@/lib/admin-session';
import { prisma } from '@/lib/prisma';

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

export default async function AdminPurchaseOrderRecordPage({
  params,
}: PurchaseRecordPageProps) {
  await requireAdminPermission('/admin/purchase-order/records', 'products.read');

  const { id } = await params;
  const record = await prisma.purchaseEntry.findFirst({
    select: {
      entryNumber: true,
      lines: {
        orderBy: {
          createdAt: 'asc',
        },
        select: {
          batch: {
            select: {
              receivedQuantity: true,
            },
          },
          id: true,
          lineTotal: true,
          product: {
            select: {
              name: true,
            },
          },
          quantity: true,
          unitCost: true,
          variant: {
            select: {
              color: true,
              size: true,
              sku: true,
              product: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
      notes: true,
      paymentMethod: true,
      paymentReference: true,
      paymentStatus: true,
      purchaseDate: true,
      referenceNo: true,
      status: true,
      supplierName: true,
      totalCost: true,
      totalQuantity: true,
    },
    where: {
      id,
      status: {
        not: 'draft',
      },
    },
  });

  if (!record) notFound();

  return (
    <PurchaseRecordForm
      record={{
        entryNumber: record.entryNumber,
        lines: record.lines.map((line) => ({
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
