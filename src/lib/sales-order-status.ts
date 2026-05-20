import type { OrderStatus } from '@prisma/client';

export const SALES_ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PROCESSING: 'processing',
  ON_HOLD: 'onHold',
  CANCELLED: 'cancelled',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  RETURNED: 'returned',
} as const satisfies Record<string, OrderStatus>;

export const SALES_ORDER_STATUS_VALUES = Object.values(SALES_ORDER_STATUS);

export const STOCK_HOLDING_ORDER_STATUSES = new Set<OrderStatus>([
  SALES_ORDER_STATUS.PENDING,
  SALES_ORDER_STATUS.CONFIRMED,
  SALES_ORDER_STATUS.PROCESSING,
  SALES_ORDER_STATUS.ON_HOLD,
  SALES_ORDER_STATUS.SHIPPED,
  SALES_ORDER_STATUS.DELIVERED,
]);

const TERMINAL_ORDER_STATUSES = new Set<OrderStatus>([
  SALES_ORDER_STATUS.CANCELLED,
  SALES_ORDER_STATUS.RETURNED,
]);

export const SALES_ORDER_ALLOWED_NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  pending: [
    SALES_ORDER_STATUS.CONFIRMED,
    SALES_ORDER_STATUS.ON_HOLD,
    SALES_ORDER_STATUS.CANCELLED,
  ],
  confirmed: [
    SALES_ORDER_STATUS.PROCESSING,
    SALES_ORDER_STATUS.ON_HOLD,
    SALES_ORDER_STATUS.SHIPPED,
  ],
  processing: [SALES_ORDER_STATUS.SHIPPED, SALES_ORDER_STATUS.ON_HOLD],
  onHold: [SALES_ORDER_STATUS.CANCELLED, SALES_ORDER_STATUS.PROCESSING],
  shipped: [SALES_ORDER_STATUS.DELIVERED, SALES_ORDER_STATUS.RETURNED],
  delivered: [SALES_ORDER_STATUS.RETURNED],
  cancelled: [],
  returned: [],
};

export function parseSalesOrderStatus(value: string): OrderStatus {
  return SALES_ORDER_STATUS_VALUES.includes(value as OrderStatus)
    ? (value as OrderStatus)
    : SALES_ORDER_STATUS.PENDING;
}

export function isStockHoldingOrderStatus(status: OrderStatus | string) {
  return STOCK_HOLDING_ORDER_STATUSES.has(status as OrderStatus);
}

export function getAllowedNextSalesOrderStatuses(status: OrderStatus | string) {
  return SALES_ORDER_ALLOWED_NEXT_STATUSES[status as OrderStatus] ?? [];
}

export function assertSalesOrderStatusTransition(
  currentStatus: OrderStatus,
  nextStatus: OrderStatus,
) {
  if (currentStatus === nextStatus) return;

  if (TERMINAL_ORDER_STATUSES.has(currentStatus)) {
    throw new Error('Cancelled or returned orders cannot be reopened.');
  }

  const allowedStatuses = getAllowedNextSalesOrderStatuses(currentStatus);
  if (!allowedStatuses.includes(nextStatus)) {
    throw new Error(
      `${formatSalesOrderStatusLabel(currentStatus)} orders can only move to ${allowedStatuses
        .map(formatSalesOrderStatusLabel)
        .join(', ') || 'no further statuses'}.`,
    );
  }
}

export function getSalesOrderTimestampUpdate(input: {
  currentStatus: OrderStatus;
  nextStatus: OrderStatus;
  now?: Date;
}) {
  const now = input.now ?? new Date();

  return {
    deliveredAt:
      input.currentStatus !== SALES_ORDER_STATUS.DELIVERED &&
      input.nextStatus === SALES_ORDER_STATUS.DELIVERED
        ? now
        : undefined,
    cancelledAt:
      input.currentStatus !== SALES_ORDER_STATUS.CANCELLED &&
      input.nextStatus === SALES_ORDER_STATUS.CANCELLED
        ? now
        : undefined,
  };
}

export function formatSalesOrderStatusLabel(status: OrderStatus | string) {
  const labels: Record<OrderStatus, string> = {
    pending: 'Unfulfilled',
    confirmed: 'Confirmed',
    processing: 'Processing',
    onHold: 'On Hold',
    cancelled: 'Cancelled',
    shipped: 'Shipped',
    delivered: 'Delivered',
    returned: 'Return',
  };
  return labels[status as OrderStatus] ?? status.replace(/([a-z])([A-Z])/g, '$1 $2');
}
