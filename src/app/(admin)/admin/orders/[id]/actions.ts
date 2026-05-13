'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminPermission } from '@/lib/admin-session';
import {
  allocateInventoryForOrderProduct,
  isStockHoldingOrderStatus,
  reconcileOrderProductInventoryAllocation,
  releaseInventoryAllocationsForOrderProducts,
} from '@/lib/inventory-allocation';
import { prisma } from '@/lib/prisma';

type EditableOrderItemInput = {
  id: string;
  productId: string;
  variantId: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
};

type EditableOrderInput = {
  expectedUpdatedAt: string;
  orderStatus: string;
  paymentMethod: string;
  paymentStatus: string;
  firstName: string;
  lastName: string;
  phone: string;
  receiverPhone: string;
  email: string;
  division: string;
  district: string;
  thana: string;
  address: string;
  notes: string;
  orderLevelDiscount: number;
  paidAmount: number;
  items: EditableOrderItemInput[];
};

type OrderNoteHistoryItem = {
  id: string;
  note: string;
  createdByName: string;
  createdAt: string;
};

const ORDER_STATUS_VALUES = new Set([
  'pending',
  'confirmed',
  'processing',
  'onHold',
  'cancelled',
  'shipped',
  'delivered',
  'returned',
] as const);

const PAYMENT_METHOD_VALUES = new Set(['COD', 'BKASH'] as const);
const PAYMENT_STATUS_VALUES = new Set(['unpaid', 'paid'] as const);

const UPDATED_ORDER_INCLUDE = {
  customer: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      division: true,
      district: true,
      thana: true,
      address: true,
    },
  },
  products: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
        },
      },
      variant: {
        select: {
          id: true,
          color: true,
          size: true,
          sku: true,
          imagePath: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  },
} as const;

function toMoney(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Number(value.toFixed(2)));
}

function toQuantity(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.floor(value));
}

function toNonNegativeMoney(value: number) {
  return Math.max(0, toMoney(value));
}

function decimalToNumberSafe(value: { toNumber: () => number } | null | undefined) {
  if (!value || typeof value.toNumber !== 'function') return 0;
  return value.toNumber();
}

export async function updateOrderDetailsAction(
  orderId: string,
  payload: EditableOrderInput,
) {
  const adminSession = await requireAdminPermission(`/admin/orders/${orderId}`, 'orders.write');

  const updatedOrder = await prisma.$transaction(async (tx) => {
    const existing = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        status: true,
        updatedAt: true,
        notes: true,
        deliveryCharge: true,
        tags: true,
        products: {
          select: {
            id: true,
            productId: true,
            variantId: true,
            quantity: true,
            unitPrice: true,
            discountAmount: true,
          },
        },
      },
    });

    if (!existing) {
      throw new Error('Order not found.');
    }
    const expectedUpdatedAt = new Date(payload.expectedUpdatedAt);
    if (Number.isNaN(expectedUpdatedAt.getTime())) {
      throw new Error('Invalid update token. Please refresh and try again.');
    }
    if (existing.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
      throw new Error(
        'This order was updated by someone else. Please refresh before saving.',
      );
    }

    const nextOrderStatus = ORDER_STATUS_VALUES.has(payload.orderStatus as never)
      ? payload.orderStatus
      : 'pending';
    const nextPaymentMethod = PAYMENT_METHOD_VALUES.has(payload.paymentMethod as never)
      ? payload.paymentMethod
      : 'COD';
    const nextPaymentStatus = PAYMENT_STATUS_VALUES.has(payload.paymentStatus as never)
      ? payload.paymentStatus
      : 'unpaid';
    const existingHoldsStock = isStockHoldingOrderStatus(existing.status);
    const nextHoldsStock = isStockHoldingOrderStatus(nextOrderStatus);

    if (existing.status === 'shipped' || existing.status === 'delivered') {
      if (nextOrderStatus !== 'returned') {
        throw new Error('Shipped or delivered orders can only be marked returned.');
      }
      if (existingHoldsStock && !nextHoldsStock) {
        await releaseInventoryAllocationsForOrderProducts(tx, {
          orderProductIds: existing.products.map((item) => item.id),
          reason: 'order-status-returned',
        });
      }

      const nextNote = payload.notes.trim();
      if (nextNote) {
        const createdByAdminId = adminSession.id === 'dev-admin' ? null : adminSession.id;
        await tx.$executeRaw`
          INSERT INTO "OrderNote" ("id", "orderId", "note", "createdByAdminId", "createdByName", "createdAt")
          VALUES (md5(random()::text || clock_timestamp()::text), ${orderId}, ${nextNote}, ${createdByAdminId}, ${adminSession.name}, now())
        `;
      }

      const updateResult = await tx.order.updateMany({
        where: { id: orderId, updatedAt: expectedUpdatedAt },
        data: {
          notes: nextNote || existing.notes || null,
          status: 'returned',
        },
      });
      if (updateResult.count !== 1) {
        throw new Error(
          'This order was updated by someone else. Please refresh before saving.',
        );
      }

      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: UPDATED_ORDER_INCLUDE,
      });
    }

    const existingIds = new Set(existing.products.map((item) => item.id));
    const incomingExistingIds = new Set(
      payload.items
        .map((item) => item.id)
        .filter((id) => existingIds.has(id)),
    );
    if (
      incomingExistingIds.size !== existingIds.size &&
      incomingExistingIds.size !== payload.items.length
    ) {
      // Allowed now: user may remove existing items and/or add new items.
      // We only require that all submitted existing IDs are valid.
      const invalidExistingId = payload.items.some(
        (item) => item.id && !item.id.startsWith('new:') && !existingIds.has(item.id),
      );
      if (invalidExistingId) {
        throw new Error(
          'Order items changed in another session. Please refresh and try again.',
        );
      }
    }
    const sanitizedPhone = payload.phone.trim();
    const sanitizedReceiverPhone = payload.receiverPhone.trim() || sanitizedPhone;
    const submittedExistingItems = payload.items.filter((item) => existingIds.has(item.id));
    const newItemsInput = payload.items.filter((item) => !existingIds.has(item.id));

    const sanitizedItems = submittedExistingItems.map((item) => {
        const quantity = toQuantity(item.quantity);
        const unitPrice = toNonNegativeMoney(item.unitPrice);
        const maxItemDiscount = quantity * unitPrice;
        const discountAmount = Math.min(
          toNonNegativeMoney(item.discountAmount),
          maxItemDiscount,
        );
        const lineTotal = toNonNegativeMoney(quantity * unitPrice - discountAmount);
        return {
          id: item.id,
          quantity,
          unitPrice,
          discountAmount,
          lineTotal,
        };
      });

    const currentById = new Map(
      existing.products.map((item) => [
        item.id,
        {
          quantity: item.quantity,
          variantId: item.variantId,
          unitPrice: decimalToNumberSafe(item.unitPrice),
          discountAmount: decimalToNumberSafe(item.discountAmount),
        },
      ]),
    );

    const existingIdsToKeep = new Set(sanitizedItems.map((item) => item.id));
    const existingIdsToRemove = existing.products
      .map((item) => item.id)
      .filter((id) => !existingIdsToKeep.has(id));
    if (existingHoldsStock && !nextHoldsStock) {
      await releaseInventoryAllocationsForOrderProducts(tx, {
        orderProductIds: existing.products.map((item) => item.id),
        reason: `order-status-${nextOrderStatus}`,
      });
    } else if (existingHoldsStock && existingIdsToRemove.length > 0) {
      await releaseInventoryAllocationsForOrderProducts(tx, {
        orderProductIds: existingIdsToRemove,
        reason: 'order-line-removed',
      });
    }
    if (existingIdsToRemove.length > 0) {
      await tx.orderProduct.deleteMany({
        where: {
          id: { in: existingIdsToRemove },
          orderId,
        },
      });
    }

    for (const item of sanitizedItems) {
      const current = currentById.get(item.id);
      if (!current) {
        throw new Error('Order item integrity check failed. Please refresh and retry.');
      }
      const maxUnitPrice = Math.max(current.unitPrice * 3, 1);
      const cappedUnitPrice = Math.min(item.unitPrice, maxUnitPrice);
      const maxItemDiscount = item.quantity * cappedUnitPrice;
      const cappedDiscount = Math.min(item.discountAmount, maxItemDiscount);
      const cappedLineTotal = toNonNegativeMoney(item.quantity * cappedUnitPrice - cappedDiscount);
      await tx.orderProduct.update({
        where: { id: item.id },
        data: {
          quantity: item.quantity,
          unitPrice: cappedUnitPrice,
          discountAmount: cappedDiscount,
          lineTotal: cappedLineTotal,
        },
      });
      if (existingHoldsStock && nextHoldsStock) {
        await reconcileOrderProductInventoryAllocation(tx, {
          orderProductId: item.id,
          quantity: item.quantity,
          reason: 'order-line-quantity-updated',
          variantId: current.variantId,
        });
      }
    }

    const requestedNewVariantIds = [...new Set(newItemsInput.map((item) => item.variantId))];
    const variantCatalog = requestedNewVariantIds.length
      ? await tx.productVariant.findMany({
          where: {
            id: { in: requestedNewVariantIds },
            isActive: true,
            product: { status: 'active' },
          },
          include: {
            product: {
              select: { id: true, name: true },
            },
          },
        })
      : [];
    const variantById = new Map(variantCatalog.map((variant) => [variant.id, variant]));

    const createdItems: Array<{
      discountAmount: number;
      orderProductId: string;
      quantity: number;
      unitPrice: number;
      variantId: string;
    }> = [];
    for (const item of newItemsInput) {
      const variant = variantById.get(item.variantId);
      if (!variant) {
        throw new Error('One or more selected variants are unavailable. Please refresh and retry.');
      }
      const quantity = toQuantity(item.quantity);
      const basePrice = decimalToNumberSafe(variant.price);
      const maxUnitPrice = Math.max(basePrice * 3, 1);
      const unitPrice = Math.min(toNonNegativeMoney(item.unitPrice || basePrice), maxUnitPrice);
      const maxItemDiscount = quantity * unitPrice;
      const discountAmount = Math.min(toNonNegativeMoney(item.discountAmount), maxItemDiscount);
      const lineTotal = toNonNegativeMoney(quantity * unitPrice - discountAmount);
      const variantLabel = [variant.color, variant.size].filter(Boolean).join(' / ');
      const createdItem = await tx.orderProduct.create({
        data: {
          orderId,
          productId: variant.productId,
          variantId: variant.id,
          productName: variant.product.name,
          variantLabel: variantLabel || null,
          imagePath: variant.imagePath ?? null,
          sku: variant.sku,
          quantity,
          unitPrice,
          discountAmount,
          lineTotal,
        },
        select: {
          id: true,
        },
      });
      if (nextHoldsStock) {
        await allocateInventoryForOrderProduct(tx, {
          orderProductId: createdItem.id,
          quantity,
          variantId: variant.id,
        });
      }
      createdItems.push({
        discountAmount,
        orderProductId: createdItem.id,
        quantity,
        unitPrice,
        variantId: variant.id,
      });
    }

    if (!existingHoldsStock && nextHoldsStock) {
      for (const item of sanitizedItems) {
        const current = currentById.get(item.id);
        if (!current) continue;
        await reconcileOrderProductInventoryAllocation(tx, {
          orderProductId: item.id,
          quantity: item.quantity,
          reason: `order-status-${nextOrderStatus}`,
          variantId: current.variantId,
        });
      }
    }

    const persistedExistingItems = sanitizedItems.map((item) => {
      const current = currentById.get(item.id)!;
      const maxUnitPrice = Math.max(current.unitPrice * 3, 1);
      const unitPrice = Math.min(item.unitPrice, maxUnitPrice);
      const maxItemDiscount = item.quantity * unitPrice;
      const discountAmount = Math.min(item.discountAmount, maxItemDiscount);
      return {
        ...item,
        unitPrice,
        discountAmount,
      };
    });
    const persistedItems = [
      ...persistedExistingItems.map((item) => ({
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountAmount: item.discountAmount,
      })),
      ...createdItems,
    ];

    const subtotal = persistedItems.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );
    const discountTotal = persistedItems.reduce(
      (sum, item) => sum + item.discountAmount,
      0,
    );
    const orderLevelDiscount = toNonNegativeMoney(payload.orderLevelDiscount);
    const totalDiscount = discountTotal + orderLevelDiscount;
    const total = toNonNegativeMoney(
      subtotal - totalDiscount + existing.deliveryCharge.toNumber(),
    );
    const paidAmount = Math.min(toNonNegativeMoney(payload.paidAmount), total);

    const nextTags = new Set(existing.tags);
    if (nextPaymentStatus === 'paid') {
      nextTags.add('PREPAID_ORDER');
    } else {
      nextTags.delete('PREPAID_ORDER');
    }

    const nextNote = payload.notes.trim();
    if (nextNote) {
      const createdByAdminId = adminSession.id === 'dev-admin' ? null : adminSession.id;
      await tx.$executeRaw`
        INSERT INTO "OrderNote" ("id", "orderId", "note", "createdByAdminId", "createdByName", "createdAt")
        VALUES (md5(random()::text || clock_timestamp()::text), ${orderId}, ${nextNote}, ${createdByAdminId}, ${adminSession.name}, now())
      `;
    }

    const updateResult = await tx.order.updateMany({
      where: { id: orderId, updatedAt: expectedUpdatedAt },
      data: {
        firstName: payload.firstName.trim(),
        lastName: payload.lastName.trim() || null,
        phone: sanitizedPhone,
        receiverPhone: sanitizedReceiverPhone,
        email: payload.email.trim() || null,
        division: payload.division.trim(),
        district: payload.district.trim(),
        thana: payload.thana.trim(),
        address: payload.address.trim(),
        notes: nextNote || existing.notes || null,
        status: nextOrderStatus as never,
        paymentMethod: nextPaymentMethod as never,
        tags: [...nextTags],
        subtotalAmount: toMoney(subtotal),
        discountAmount: toMoney(totalDiscount),
        totalAmount: toMoney(total),
        paidAmount: toMoney(paidAmount),
      },
    });
    if (updateResult.count !== 1) {
      throw new Error(
        'This order was updated by someone else. Please refresh before saving.',
      );
    }

    return tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: UPDATED_ORDER_INCLUDE,
    });
  });
  const noteHistory = await prisma.$queryRaw<
    Array<{ id: string; note: string; createdByName: string; createdAt: Date }>
  >`SELECT id, note, "createdByName", "createdAt" FROM "OrderNote" WHERE "orderId" = ${orderId} ORDER BY "createdAt" DESC`;

  revalidatePath(`/admin/orders/${orderId}`);

  return {
    id: updatedOrder.id,
    updatedAt: updatedOrder.updatedAt.toISOString(),
    orderStatus: updatedOrder.status,
    paymentMethod: updatedOrder.paymentMethod,
    paymentStatus: updatedOrder.tags.includes('PREPAID_ORDER') ? 'paid' : 'unpaid',
    firstName:
      updatedOrder.status === 'delivered'
        ? updatedOrder.firstName
        : updatedOrder.customer.firstName || updatedOrder.firstName,
    lastName:
      updatedOrder.status === 'delivered'
        ? updatedOrder.lastName ?? ''
        : updatedOrder.customer.lastName ?? updatedOrder.lastName ?? '',
    phone:
      updatedOrder.status === 'delivered'
        ? updatedOrder.phone
        : updatedOrder.customer.phone || updatedOrder.phone,
    receiverPhone: updatedOrder.receiverPhone,
    email:
      updatedOrder.status === 'delivered'
        ? updatedOrder.email ?? ''
        : updatedOrder.customer.email ?? updatedOrder.email ?? '',
    division:
      updatedOrder.status === 'delivered'
        ? updatedOrder.division
        : updatedOrder.customer.division ?? updatedOrder.division,
    district:
      updatedOrder.status === 'delivered'
        ? updatedOrder.district
        : updatedOrder.customer.district ?? updatedOrder.district,
    thana:
      updatedOrder.status === 'delivered'
        ? updatedOrder.thana
        : updatedOrder.customer.thana ?? updatedOrder.thana,
    address:
      updatedOrder.status === 'delivered'
        ? updatedOrder.address
        : updatedOrder.customer.address ?? updatedOrder.address,
    notes: '',
    noteHistory: noteHistory.map(
      (entry): OrderNoteHistoryItem => ({
        id: entry.id,
        note: entry.note,
        createdByName: entry.createdByName,
        createdAt: entry.createdAt.toISOString(),
      }),
    ),
    subtotalAmount: updatedOrder.subtotalAmount.toNumber(),
    discountAmount: decimalToNumberSafe(updatedOrder.discountAmount),
    deliveryCharge: decimalToNumberSafe(updatedOrder.deliveryCharge),
    totalAmount: decimalToNumberSafe(updatedOrder.totalAmount),
    paidAmount: decimalToNumberSafe(updatedOrder.paidAmount),
    orderLevelDiscount: Math.max(
      0,
      decimalToNumberSafe(updatedOrder.discountAmount) -
        updatedOrder.products.reduce(
          (sum, item) => sum + decimalToNumberSafe(item.discountAmount),
          0,
        ),
    ),
    items: updatedOrder.products.map((item) => ({
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      productName: item.productName,
      variantLabel:
        item.variantLabel ??
        `${item.variant.color || 'Standard'} / ${item.variant.size || 'Standard'}`,
      imagePath: item.imagePath ?? item.variant.imagePath ?? '',
      bundleRule: item.bundleRule,
      appliedBundleTitle: item.bundleTitle ?? undefined,
      quantity: item.quantity,
      unitPrice: decimalToNumberSafe(item.unitPrice),
      discountAmount: decimalToNumberSafe(item.discountAmount),
      lineTotal: decimalToNumberSafe(item.lineTotal),
    })),
  };
}
