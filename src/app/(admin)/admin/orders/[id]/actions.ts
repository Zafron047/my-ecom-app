'use server';

import type { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { requireAdminPermission } from '@/lib/admin-session';
import {
  allocateInventoryForOrderProduct,
  reconcileOrderProductInventoryAllocation,
  releaseInventoryAllocationsForOrderProducts,
  releaseInventoryQuantityForOrderProduct,
} from '@/lib/inventory-allocation';
import { prisma } from '@/lib/prisma';
import { createMetaCapiEventId, sendMetaServerEvent } from '@/lib/meta-capi';
import {
  SALES_ORDER_STATUS,
  assertSalesOrderStatusTransition,
  formatSalesOrderStatusLabel,
  getSalesOrderTimestampUpdate,
  isStockHoldingOrderStatus,
  parseSalesOrderStatus,
} from '@/lib/sales-order-status';
import { getDeliveryDivisionForDistrict } from '@/lib/delivery-locations';
import {
  createSalesOrderEvent,
  getSalesOrderEventMessages,
  getSalesOrderTimeline,
} from './order-timeline';

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
  kind: 'event' | 'note';
  note: string;
  createdByName: string;
  createdAt: string;
};

type OrderReturnLineInput = {
  orderProductId: string;
  quantity: number;
  restock: boolean;
  restockOnly?: boolean;
};

type OrderReturnInput = {
  expectedUpdatedAt: string;
  lines: OrderReturnLineInput[];
  reason: string;
  refundAmount: number;
};

type OrderRefundPaymentInput = {
  expectedUpdatedAt: string;
  orderReturnId: string;
  refundMethod: string;
  referenceNote: string;
};

const PAYMENT_METHOD_VALUES = new Set(['COD', 'BKASH'] as const);
const PAYMENT_STATUS_VALUES = new Set(['unpaid', 'paid'] as const);
const REFUND_METHOD_LABELS = {
  NAGAD: 'Nagad',
  BKASH: 'bKash',
  BANK: 'Bank',
} as const;
const REFUND_METHOD_VALUES = new Set(Object.keys(REFUND_METHOD_LABELS));

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
  orderReturns: {
    include: {
      lines: {
        select: {
          id: true,
          orderProductId: true,
          quantity: true,
          restocked: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  },
} as const;

type UpdatedOrderPayload = Prisma.OrderGetPayload<{
  include: typeof UPDATED_ORDER_INCLUDE;
}>;

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

function formatTimelineMoney(value: number) {
  return `Tk ${toMoney(value).toLocaleString('en-BD', { maximumFractionDigits: 0 })}`;
}

function normalizeOptionalText(value: string | null | undefined) {
  return (value ?? '').trim();
}

function getLineLabel(item: {
  productName?: string | null;
  variantLabel?: string | null;
  sku?: string | null;
}) {
  const variantLabel = normalizeOptionalText(item.variantLabel);
  const sku = normalizeOptionalText(item.sku);
  return [
    normalizeOptionalText(item.productName) || 'order item',
    variantLabel || sku,
  ]
    .filter(Boolean)
    .join(' / ');
}

function formatRefundMethod(value: string | null | undefined) {
  if (!value) return '';
  return REFUND_METHOD_LABELS[value as keyof typeof REFUND_METHOD_LABELS] ?? value;
}

async function createMetaRequestForServerAction() {
  const headerStore = await headers();
  const requestHeaders = new Headers();
  headerStore.forEach((value, key) => requestHeaders.set(key, value));
  return new Request(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000', {
    headers: requestHeaders,
  });
}

function serializeUpdatedOrder(
  updatedOrder: UpdatedOrderPayload,
  timeline: Awaited<ReturnType<typeof getSalesOrderTimeline>>,
) {
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
    noteHistory: timeline.map(
      (entry): OrderNoteHistoryItem => ({
        id: entry.id,
        kind: entry.kind,
        note: entry.note,
        createdByName: entry.createdByName,
        createdAt: entry.createdAt,
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
    returns: updatedOrder.orderReturns.map((orderReturn) => ({
      id: orderReturn.id,
      reason: orderReturn.reason ?? '',
      refundAmount: decimalToNumberSafe(orderReturn.refundAmount),
      refundMethod: orderReturn.refundMethod ?? '',
      refundReferenceNote: orderReturn.refundReferenceNote ?? '',
      createdByName: orderReturn.createdByName,
      createdAt: orderReturn.createdAt.toISOString(),
      lines: orderReturn.lines.map((line) => ({
        id: line.id,
        orderProductId: line.orderProductId,
        quantity: line.quantity,
        restocked: line.restocked,
      })),
    })),
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

export async function updateOrderDetailsAction(
  orderId: string,
  payload: EditableOrderInput,
) {
  const adminSession = await requireAdminPermission(`/admin/orders/${orderId}`, 'orders.write');
  const resolvedDivision =
    payload.division.trim() ||
    (payload.district.trim()
      ? await getDeliveryDivisionForDistrict(payload.district.trim())
      : '');

  const updatedOrder = await prisma.$transaction(async (tx) => {
    const existing = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        address: true,
        discountAmount: true,
        district: true,
        division: true,
        email: true,
        firstName: true,
        lastName: true,
        paidAmount: true,
        phone: true,
        receiverPhone: true,
        status: true,
        thana: true,
        totalAmount: true,
        updatedAt: true,
        notes: true,
        deliveryCharge: true,
        paymentMethod: true,
        tags: true,
        products: {
          select: {
            id: true,
            productId: true,
            productName: true,
            variantId: true,
            variantLabel: true,
            sku: true,
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

    const nextOrderStatus = parseSalesOrderStatus(payload.orderStatus);
    assertSalesOrderStatusTransition(existing.status, nextOrderStatus);
    const nextPaymentMethod = PAYMENT_METHOD_VALUES.has(payload.paymentMethod as never)
      ? payload.paymentMethod
      : 'COD';
    const nextPaymentStatus = PAYMENT_STATUS_VALUES.has(payload.paymentStatus as never)
      ? payload.paymentStatus
      : 'unpaid';
    const existingHoldsStock = isStockHoldingOrderStatus(existing.status);
    const nextHoldsStock = isStockHoldingOrderStatus(nextOrderStatus);

    if (
      existing.status === SALES_ORDER_STATUS.SHIPPED ||
      existing.status === SALES_ORDER_STATUS.DELIVERED
    ) {
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
          status: nextOrderStatus,
          ...getSalesOrderTimestampUpdate({
            currentStatus: existing.status,
            nextStatus: nextOrderStatus,
          }),
        },
      });
      if (updateResult.count !== 1) {
        throw new Error(
          'This order was updated by someone else. Please refresh before saving.',
        );
      }
      await createSalesOrderEvent(tx, {
        eventType: 'order_status_updated',
        message: getSalesOrderEventMessages({
          currentPaymentMethod: existing.paymentMethod,
          currentPaymentStatus: existing.tags.includes('PREPAID_ORDER') ? 'paid' : 'unpaid',
          currentStatus: existing.status,
          nextPaymentMethod: existing.paymentMethod,
          nextPaymentStatus: existing.tags.includes('PREPAID_ORDER') ? 'paid' : 'unpaid',
          nextStatus: nextOrderStatus,
        })[0]?.message ?? 'updated order status',
        orderId,
        session: adminSession,
      });

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
      label: string;
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
        label: getLineLabel({
          productName: variant.product.name,
          variantLabel,
          sku: variant.sku,
        }),
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
    const paidAmount = toNonNegativeMoney(payload.paidAmount);
    if (paidAmount > total) {
      throw new Error('Paid amount cannot exceed the current order total.');
    }

    const nextTags = new Set(existing.tags);
    if (nextPaymentStatus === 'paid') {
      nextTags.add('PREPAID_ORDER');
    } else {
      nextTags.delete('PREPAID_ORDER');
    }
    const currentPaymentStatus = existing.tags.includes('PREPAID_ORDER')
      ? 'paid'
      : 'unpaid';
    const eventMessages = getSalesOrderEventMessages({
      currentPaymentMethod: existing.paymentMethod,
      currentPaymentStatus,
      currentStatus: existing.status,
      nextPaymentMethod,
      nextPaymentStatus,
      nextStatus: nextOrderStatus,
    });

    const customerChanged =
      normalizeOptionalText(existing.firstName) !== payload.firstName.trim() ||
      normalizeOptionalText(existing.lastName) !== payload.lastName.trim() ||
      normalizeOptionalText(existing.phone) !== sanitizedPhone ||
      normalizeOptionalText(existing.receiverPhone) !== sanitizedReceiverPhone ||
      normalizeOptionalText(existing.email) !== payload.email.trim() ||
      normalizeOptionalText(existing.division) !== resolvedDivision ||
      normalizeOptionalText(existing.district) !== payload.district.trim() ||
      normalizeOptionalText(existing.thana) !== payload.thana.trim() ||
      normalizeOptionalText(existing.address) !== payload.address.trim();

    if (customerChanged) {
      eventMessages.push({
        eventType: 'customer_details_updated',
        message: 'updated customer details',
      });
    }

    for (const removedId of existingIdsToRemove) {
      const removedItem = existing.products.find((item) => item.id === removedId);
      eventMessages.push({
        eventType: 'order_item_removed',
        message: `removed ${getLineLabel(removedItem ?? {})}`,
      });
    }

    for (const item of persistedExistingItems) {
      const current = existing.products.find((entry) => entry.id === item.id);
      if (!current) continue;

      const label = getLineLabel(current);
      if (current.quantity !== item.quantity) {
        eventMessages.push({
          eventType: 'order_item_quantity_updated',
          message: `updated quantity for ${label} from ${current.quantity} to ${item.quantity}`,
        });
      }

      const currentUnitPrice = decimalToNumberSafe(current.unitPrice);
      if (currentUnitPrice !== item.unitPrice) {
        eventMessages.push({
          eventType: 'order_item_price_updated',
          message: `updated unit price for ${label} from ${formatTimelineMoney(
            currentUnitPrice,
          )} to ${formatTimelineMoney(item.unitPrice)}`,
        });
      }

      const currentDiscount = decimalToNumberSafe(current.discountAmount);
      if (currentDiscount !== item.discountAmount) {
        eventMessages.push({
          eventType: 'order_line_discount_updated',
          message: `updated line discount for ${label} from ${formatTimelineMoney(
            currentDiscount,
          )} to ${formatTimelineMoney(item.discountAmount)}`,
        });
      }
    }

    for (const item of createdItems) {
      eventMessages.push({
        eventType: 'order_item_added',
        message: `added ${item.label} x ${item.quantity}`,
      });
      if (item.discountAmount > 0) {
        eventMessages.push({
          eventType: 'order_line_discount_updated',
          message: `set line discount for ${item.label} to ${formatTimelineMoney(
            item.discountAmount,
          )}`,
        });
      }
    }

    const currentOrderLevelDiscount = Math.max(
      0,
      decimalToNumberSafe(existing.discountAmount) -
        existing.products.reduce(
          (sum, item) => sum + decimalToNumberSafe(item.discountAmount),
          0,
        ),
    );
    if (currentOrderLevelDiscount !== orderLevelDiscount) {
      eventMessages.push({
        eventType: 'order_discount_updated',
        message: `updated order discount from ${formatTimelineMoney(
          currentOrderLevelDiscount,
        )} to ${formatTimelineMoney(orderLevelDiscount)}`,
      });
    }

    const currentPaidAmount = decimalToNumberSafe(existing.paidAmount);
    if (currentPaidAmount !== paidAmount) {
      eventMessages.push({
        eventType: 'paid_amount_updated',
        message: `updated paid amount from ${formatTimelineMoney(
          currentPaidAmount,
        )} to ${formatTimelineMoney(paidAmount)}`,
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
        firstName: payload.firstName.trim(),
        lastName: payload.lastName.trim() || null,
        phone: sanitizedPhone,
        receiverPhone: sanitizedReceiverPhone,
        email: payload.email.trim() || null,
        division: resolvedDivision,
        district: payload.district.trim(),
        thana: payload.thana.trim(),
        address: payload.address.trim(),
        notes: nextNote || existing.notes || null,
        status: nextOrderStatus,
        paymentMethod: nextPaymentMethod as never,
        tags: [...nextTags],
        subtotalAmount: toMoney(subtotal),
        discountAmount: toMoney(totalDiscount),
        totalAmount: toMoney(total),
        paidAmount: toMoney(paidAmount),
        ...getSalesOrderTimestampUpdate({
          currentStatus: existing.status,
          nextStatus: nextOrderStatus,
        }),
      },
    });
    if (updateResult.count !== 1) {
      throw new Error(
        'This order was updated by someone else. Please refresh before saving.',
      );
    }
    if (eventMessages.length === 0 && !nextNote) {
      eventMessages.push({
        eventType: 'order_details_updated',
        message: 'updated order details',
      });
    }
    for (const eventMessage of eventMessages) {
      await createSalesOrderEvent(tx, {
        ...eventMessage,
        orderId,
        session: adminSession,
      });
    }

    return tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: UPDATED_ORDER_INCLUDE,
    });
  });
  const timeline = await getSalesOrderTimeline(orderId);

  revalidatePath(`/admin/orders/${orderId}`);

  if (updatedOrder.status === SALES_ORDER_STATUS.CANCELLED) {
    const eventId = createMetaCapiEventId('cancel-order', updatedOrder.orderNumber);
    await sendMetaServerEvent({
      eventId,
      eventName: 'CancelOrder',
      eventSourceUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/admin/orders/${orderId}`,
      request: await createMetaRequestForServerAction(),
      user: {
        city: updatedOrder.district,
        email: updatedOrder.email,
        externalId: updatedOrder.customerId,
        firstName: updatedOrder.firstName,
        lastName: updatedOrder.lastName,
        phone: updatedOrder.phone,
      },
      customData: {
        content_ids: updatedOrder.products.map((product) => product.variantId),
        content_type: 'product',
        currency: 'BDT',
        order_id: updatedOrder.orderNumber,
        value: decimalToNumberSafe(updatedOrder.totalAmount),
      },
    }).catch((error) => {
      console.error('Meta CAPI CancelOrder event failed', error);
    });
  }

  return serializeUpdatedOrder(updatedOrder, timeline);
}

export async function processOrderReturnAction(
  orderId: string,
  payload: OrderReturnInput,
) {
  const adminSession = await requireAdminPermission(`/admin/orders/${orderId}`, 'orders.write');

  const updatedOrder = await prisma.$transaction(async (tx) => {
    const existing = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        paidAmount: true,
        status: true,
        updatedAt: true,
        products: {
          select: {
            id: true,
            productName: true,
            quantity: true,
            sku: true,
            unitPrice: true,
            lineTotal: true,
            variantLabel: true,
          },
        },
        orderReturns: {
          select: {
            refundAmount: true,
            lines: {
              select: {
                orderProductId: true,
                quantity: true,
                restocked: true,
              },
            },
          },
        },
      },
    });

    if (!existing) {
      throw new Error('Order not found.');
    }
    if (
      existing.status !== SALES_ORDER_STATUS.SHIPPED &&
      existing.status !== SALES_ORDER_STATUS.DELIVERED &&
      existing.status !== SALES_ORDER_STATUS.RETURNED
    ) {
      throw new Error('Only shipped, delivered, or returned orders can be returned.');
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

    const productById = new Map(existing.products.map((item) => [item.id, item]));
    const alreadyReturnedByProductId = new Map<string, number>();
    for (const orderReturn of existing.orderReturns) {
      for (const line of orderReturn.lines) {
        alreadyReturnedByProductId.set(
          line.orderProductId,
          (alreadyReturnedByProductId.get(line.orderProductId) ?? 0) + line.quantity,
        );
      }
    }

    const sanitizedLines = payload.lines
      .map((line) => ({
        orderProductId: line.orderProductId,
        quantity: Math.max(0, Math.floor(line.quantity)),
        restock: line.restock,
        restockOnly: Boolean(line.restockOnly),
      }))
      .filter((line) => line.quantity > 0);

    if (sanitizedLines.length === 0) {
      throw new Error('Add at least one returned item.');
    }

    const newReturnLines = sanitizedLines.filter((line) => !line.restockOnly);
    const restockOnlyLines = sanitizedLines.filter((line) => line.restockOnly);
    const pendingRestockByProductId = new Map<string, number>();
    for (const orderReturn of existing.orderReturns) {
      for (const line of orderReturn.lines) {
        if (line.restocked) continue;
        pendingRestockByProductId.set(
          line.orderProductId,
          (pendingRestockByProductId.get(line.orderProductId) ?? 0) + line.quantity,
        );
      }
    }

    for (const line of newReturnLines) {
      const product = productById.get(line.orderProductId);
      if (!product) {
        throw new Error('One or more returned items no longer exist on this order.');
      }
      const alreadyReturned = alreadyReturnedByProductId.get(line.orderProductId) ?? 0;
      if (alreadyReturned + line.quantity > product.quantity) {
        throw new Error(
          `Return quantity for ${getLineLabel(product)} exceeds the ordered quantity.`,
        );
      }
    }

    for (const line of restockOnlyLines) {
      const product = productById.get(line.orderProductId);
      if (!product) {
        throw new Error('One or more restock items no longer exist on this order.');
      }
      if (!line.restock) {
        throw new Error('Received return stock must be marked for restock.');
      }
      const pendingRestockQuantity = pendingRestockByProductId.get(line.orderProductId) ?? 0;
      if (line.quantity !== pendingRestockQuantity) {
        throw new Error(
          `Restock quantity for ${getLineLabel(product)} must match the pending returned quantity.`,
        );
      }
    }

    const calculatedRefundAmount = newReturnLines.reduce((sum, line) => {
      const product = productById.get(line.orderProductId);
      if (!product) return sum;
      const refundableUnitPrice =
        product.quantity > 0
          ? decimalToNumberSafe(product.lineTotal) / product.quantity
          : decimalToNumberSafe(product.unitPrice);
      return sum + refundableUnitPrice * line.quantity;
    }, 0);
    const refundAmount = toNonNegativeMoney(calculatedRefundAmount);
    const createdByAdminId = adminSession.id === 'dev-admin' ? null : adminSession.id;
    const orderReturn =
      newReturnLines.length > 0
        ? await tx.orderReturn.create({
            data: {
              orderId,
              reason: payload.reason.trim() || null,
              refundAmount,
              createdByAdminId,
              createdByName: adminSession.name,
              lines: {
                create: newReturnLines.map((line) => ({
                  orderProductId: line.orderProductId,
                  quantity: line.quantity,
                  restocked: line.restock,
                })),
              },
            },
            select: {
              id: true,
            },
          })
        : null;

    for (const line of restockOnlyLines) {
      await tx.orderReturnLine.updateMany({
        where: {
          orderProductId: line.orderProductId,
          restocked: false,
          orderReturn: {
            orderId,
          },
        },
        data: {
          restocked: true,
        },
      });
      await releaseInventoryQuantityForOrderProduct(tx, {
        orderProductId: line.orderProductId,
        quantity: line.quantity,
        reason: `order-return-restock-${orderId}`,
      });
    }

    for (const line of newReturnLines) {
      if (!line.restock) continue;
      await releaseInventoryQuantityForOrderProduct(tx, {
        orderProductId: line.orderProductId,
        quantity: line.quantity,
        reason: `order-return-${orderReturn?.id ?? orderId}`,
      });
    }

    const returnedAfterThis = new Map(alreadyReturnedByProductId);
    for (const line of newReturnLines) {
      returnedAfterThis.set(
        line.orderProductId,
        (returnedAfterThis.get(line.orderProductId) ?? 0) + line.quantity,
      );
    }
    const isFullReturn = existing.products.every(
      (item) => (returnedAfterThis.get(item.id) ?? 0) >= item.quantity,
    );
    const nextStatus = isFullReturn ? SALES_ORDER_STATUS.RETURNED : existing.status;

    const updateResult = await tx.order.updateMany({
      where: { id: orderId, updatedAt: expectedUpdatedAt },
      data: {
        status: nextStatus,
      },
    });
    if (updateResult.count !== 1) {
      throw new Error(
        'This order was updated by someone else. Please refresh before saving.',
      );
    }

    for (const line of newReturnLines) {
      const product = productById.get(line.orderProductId);
      await createSalesOrderEvent(tx, {
        eventType: 'order_return_line_processed',
        message: `processed return for ${getLineLabel(product ?? {})} x ${line.quantity}${
          line.restock ? ' and restocked it' : ''
        }`,
        orderId,
        session: adminSession,
      });
    }
    for (const line of restockOnlyLines) {
      const product = productById.get(line.orderProductId);
      await createSalesOrderEvent(tx, {
        eventType: 'order_return_line_restocked',
        message: `restocked received return for ${getLineLabel(product ?? {})} x ${line.quantity}`,
        orderId,
        session: adminSession,
      });
    }
    if (refundAmount > 0) {
      await createSalesOrderEvent(tx, {
        eventType: 'order_return_refund_due_recorded',
        message: `recorded refund due of ${formatTimelineMoney(refundAmount)}`,
        orderId,
        session: adminSession,
      });
    }
    if (isFullReturn && existing.status !== SALES_ORDER_STATUS.RETURNED) {
      await createSalesOrderEvent(tx, {
        eventType: 'order_status_updated',
        message: `updated order status from ${formatSalesOrderStatusLabel(
          existing.status,
        )} to ${formatSalesOrderStatusLabel(SALES_ORDER_STATUS.RETURNED)}`,
        orderId,
        session: adminSession,
      });
    }
    if (payload.reason.trim()) {
      await tx.$executeRaw`
        INSERT INTO "OrderNote" ("id", "orderId", "note", "createdByAdminId", "createdByName", "createdAt")
        VALUES (md5(random()::text || clock_timestamp()::text), ${orderId}, ${payload.reason.trim()}, ${createdByAdminId}, ${adminSession.name}, now())
      `;
    }

    return tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: UPDATED_ORDER_INCLUDE,
    });
  });
  const timeline = await getSalesOrderTimeline(orderId);

  revalidatePath(`/admin/orders/${orderId}`);

  const returnedValue = payload.lines.reduce((sum, line) => {
    const product = updatedOrder.products.find((item) => item.id === line.orderProductId);
    if (!product || product.quantity <= 0) return sum;
    return sum + (decimalToNumberSafe(product.lineTotal) / product.quantity) * line.quantity;
  }, 0);
  const eventId = createMetaCapiEventId('return-order', updatedOrder.orderNumber);
  await sendMetaServerEvent({
    eventId,
    eventName: 'ReturnOrder',
    eventSourceUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/admin/orders/${orderId}`,
    request: await createMetaRequestForServerAction(),
    user: {
      city: updatedOrder.district,
      email: updatedOrder.email,
      externalId: updatedOrder.customerId,
      firstName: updatedOrder.firstName,
      lastName: updatedOrder.lastName,
      phone: updatedOrder.phone,
    },
    customData: {
      content_ids: payload.lines.map((line) => line.orderProductId),
      content_type: 'product',
      currency: 'BDT',
      order_id: updatedOrder.orderNumber,
      value: toMoney(returnedValue),
    },
  }).catch((error) => {
    console.error('Meta CAPI ReturnOrder event failed', error);
  });

  return serializeUpdatedOrder(updatedOrder, timeline);
}

export async function processOrderRefundAction(
  orderId: string,
  payload: OrderRefundPaymentInput,
) {
  const adminSession = await requireAdminPermission(`/admin/orders/${orderId}`, 'orders.write');

  const updatedOrder = await prisma.$transaction(async (tx) => {
    const existing = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        paidAmount: true,
        updatedAt: true,
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

    const orderReturns = await tx.$queryRaw<
      Array<{
        id: string;
        refundAmount: { toNumber: () => number } | number | string;
        refundMethod: string | null;
      }>
    >`
      SELECT id, "refundAmount", "refundMethod"
      FROM "OrderReturn"
      WHERE id = ${payload.orderReturnId} AND "orderId" = ${orderId}
      LIMIT 1
    `;
    const orderReturn = orderReturns[0];
    if (!orderReturn) {
      throw new Error('Refund record not found.');
    }
    if (orderReturn.refundMethod) {
      throw new Error('This refund has already been paid.');
    }

    const refundAmount =
      typeof orderReturn.refundAmount === 'object' &&
      orderReturn.refundAmount !== null &&
      'toNumber' in orderReturn.refundAmount
        ? orderReturn.refundAmount.toNumber()
        : toMoney(Number(orderReturn.refundAmount));
    if (refundAmount <= 0) {
      throw new Error('This refund does not have an amount to pay.');
    }
    const refundMethod = REFUND_METHOD_VALUES.has(payload.refundMethod)
      ? payload.refundMethod
      : '';
    if (!refundMethod) {
      throw new Error('Choose a refund payment method.');
    }
    const referenceNote = payload.referenceNote.trim();

    await tx.$executeRaw`
      UPDATE "OrderReturn"
      SET "refundMethod" = ${refundMethod}, "refundReferenceNote" = ${referenceNote || null}
      WHERE id = ${orderReturn.id}
    `;

    const updateResult = await tx.order.updateMany({
      where: { id: orderId, updatedAt: expectedUpdatedAt },
      data: {
        paidAmount: toMoney(decimalToNumberSafe(existing.paidAmount) - refundAmount),
      },
    });
    if (updateResult.count !== 1) {
      throw new Error(
        'This order was updated by someone else. Please refresh before saving.',
      );
    }

    await createSalesOrderEvent(tx, {
      eventType: 'order_return_refund_paid',
      message: `paid refund of ${formatTimelineMoney(refundAmount)} via ${formatRefundMethod(
        refundMethod,
      )}`,
      orderId,
      session: adminSession,
    });
    if (referenceNote) {
      const createdByAdminId = adminSession.id === 'dev-admin' ? null : adminSession.id;
      await tx.$executeRaw`
        INSERT INTO "OrderNote" ("id", "orderId", "note", "createdByAdminId", "createdByName", "createdAt")
        VALUES (md5(random()::text || clock_timestamp()::text), ${orderId}, ${referenceNote}, ${createdByAdminId}, ${adminSession.name}, now())
      `;
    }

    return tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: UPDATED_ORDER_INCLUDE,
    });
  });
  const timeline = await getSalesOrderTimeline(orderId);

  revalidatePath(`/admin/orders/${orderId}`);

  return serializeUpdatedOrder(updatedOrder, timeline);
}
