import { describe, expect, it } from 'vitest';
import {
  SALES_ORDER_STATUS,
  assertSalesOrderStatusTransition,
  getAllowedNextSalesOrderStatuses,
  getSalesOrderTimestampUpdate,
  isStockHoldingOrderStatus,
  parseSalesOrderStatus,
} from '@/lib/sales-order-status';

describe('sales order lifecycle status', () => {
  it('parses known statuses and defaults unknown values to pending', () => {
    expect(parseSalesOrderStatus('processing')).toBe(SALES_ORDER_STATUS.PROCESSING);
    expect(parseSalesOrderStatus('not-a-real-status')).toBe(SALES_ORDER_STATUS.PENDING);
  });

  it('treats pending through delivered as stock-holding statuses', () => {
    expect(isStockHoldingOrderStatus(SALES_ORDER_STATUS.PENDING)).toBe(true);
    expect(isStockHoldingOrderStatus(SALES_ORDER_STATUS.CONFIRMED)).toBe(true);
    expect(isStockHoldingOrderStatus(SALES_ORDER_STATUS.PROCESSING)).toBe(true);
    expect(isStockHoldingOrderStatus(SALES_ORDER_STATUS.ON_HOLD)).toBe(true);
    expect(isStockHoldingOrderStatus(SALES_ORDER_STATUS.SHIPPED)).toBe(true);
    expect(isStockHoldingOrderStatus(SALES_ORDER_STATUS.DELIVERED)).toBe(true);
    expect(isStockHoldingOrderStatus(SALES_ORDER_STATUS.CANCELLED)).toBe(false);
    expect(isStockHoldingOrderStatus(SALES_ORDER_STATUS.RETURNED)).toBe(false);
  });

  it('returns only the next allowed statuses for each lifecycle state', () => {
    expect(getAllowedNextSalesOrderStatuses(SALES_ORDER_STATUS.PENDING)).toEqual([
      SALES_ORDER_STATUS.CONFIRMED,
      SALES_ORDER_STATUS.ON_HOLD,
      SALES_ORDER_STATUS.CANCELLED,
    ]);
    expect(getAllowedNextSalesOrderStatuses(SALES_ORDER_STATUS.CONFIRMED)).toEqual([
      SALES_ORDER_STATUS.PROCESSING,
      SALES_ORDER_STATUS.ON_HOLD,
      SALES_ORDER_STATUS.SHIPPED,
    ]);
    expect(getAllowedNextSalesOrderStatuses(SALES_ORDER_STATUS.PROCESSING)).toEqual([
      SALES_ORDER_STATUS.SHIPPED,
      SALES_ORDER_STATUS.ON_HOLD,
    ]);
    expect(getAllowedNextSalesOrderStatuses(SALES_ORDER_STATUS.ON_HOLD)).toEqual([
      SALES_ORDER_STATUS.CANCELLED,
      SALES_ORDER_STATUS.PROCESSING,
    ]);
    expect(getAllowedNextSalesOrderStatuses(SALES_ORDER_STATUS.SHIPPED)).toEqual([
      SALES_ORDER_STATUS.DELIVERED,
      SALES_ORDER_STATUS.RETURNED,
    ]);
    expect(getAllowedNextSalesOrderStatuses(SALES_ORDER_STATUS.DELIVERED)).toEqual([
      SALES_ORDER_STATUS.RETURNED,
    ]);
    expect(getAllowedNextSalesOrderStatuses(SALES_ORDER_STATUS.CANCELLED)).toEqual([]);
    expect(getAllowedNextSalesOrderStatuses(SALES_ORDER_STATUS.RETURNED)).toEqual([]);
  });

  it('allows configured forward status movement', () => {
    expect(() =>
      assertSalesOrderStatusTransition(
        SALES_ORDER_STATUS.PENDING,
        SALES_ORDER_STATUS.CONFIRMED,
      ),
    ).not.toThrow();
    expect(() =>
      assertSalesOrderStatusTransition(
        SALES_ORDER_STATUS.PROCESSING,
        SALES_ORDER_STATUS.ON_HOLD,
      ),
    ).not.toThrow();
    expect(() =>
      assertSalesOrderStatusTransition(
        SALES_ORDER_STATUS.ON_HOLD,
        SALES_ORDER_STATUS.CANCELLED,
      ),
    ).not.toThrow();
    expect(() =>
      assertSalesOrderStatusTransition(
        SALES_ORDER_STATUS.SHIPPED,
        SALES_ORDER_STATUS.DELIVERED,
      ),
    ).not.toThrow();
    expect(() =>
      assertSalesOrderStatusTransition(
        SALES_ORDER_STATUS.DELIVERED,
        SALES_ORDER_STATUS.RETURNED,
      ),
    ).not.toThrow();
  });

  it('prevents backward or skipped status movement', () => {
    expect(() =>
      assertSalesOrderStatusTransition(
        SALES_ORDER_STATUS.CONFIRMED,
        SALES_ORDER_STATUS.PENDING,
      ),
    ).toThrow('Confirmed orders can only move to Processing, On Hold, Shipped.');
    expect(() =>
      assertSalesOrderStatusTransition(
        SALES_ORDER_STATUS.PENDING,
        SALES_ORDER_STATUS.PROCESSING,
      ),
    ).toThrow('Unfulfilled orders can only move to Confirmed, On Hold, Cancelled.');
    expect(() =>
      assertSalesOrderStatusTransition(
        SALES_ORDER_STATUS.DELIVERED,
        SALES_ORDER_STATUS.CONFIRMED,
      ),
    ).toThrow('Delivered orders can only move to Return.');
  });

  it('keeps returned and cancelled orders terminal', () => {
    expect(() =>
      assertSalesOrderStatusTransition(
        SALES_ORDER_STATUS.CANCELLED,
        SALES_ORDER_STATUS.PENDING,
      ),
    ).toThrow('Cancelled or returned orders cannot be reopened.');
    expect(() =>
      assertSalesOrderStatusTransition(
        SALES_ORDER_STATUS.RETURNED,
        SALES_ORDER_STATUS.PENDING,
      ),
    ).toThrow('Cancelled or returned orders cannot be reopened.');
  });

  it('sets lifecycle timestamps when delivered or cancelled', () => {
    const now = new Date('2026-05-19T10:00:00.000Z');

    expect(
      getSalesOrderTimestampUpdate({
        currentStatus: SALES_ORDER_STATUS.SHIPPED,
        nextStatus: SALES_ORDER_STATUS.DELIVERED,
        now,
      }),
    ).toEqual({ deliveredAt: now, cancelledAt: undefined });

    expect(
      getSalesOrderTimestampUpdate({
        currentStatus: SALES_ORDER_STATUS.PENDING,
        nextStatus: SALES_ORDER_STATUS.CANCELLED,
        now,
      }),
    ).toEqual({ deliveredAt: undefined, cancelledAt: now });
  });
});
