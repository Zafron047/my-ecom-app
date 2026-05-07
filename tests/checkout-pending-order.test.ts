import { describe, expect, it } from 'vitest';
import {
  CHECKOUT_PENDING_ORDER_KEY,
  clearPendingOrderId,
  readPendingOrderId,
  shouldClearSelectedItems,
} from '../src/lib/checkoutPendingOrder.mjs';

describe('checkoutPendingOrder', () => {
  it('uses the expected storage key', () => {
    expect(CHECKOUT_PENDING_ORDER_KEY).toBe('shop-easy-pending-order-id');
  });

  it('checks selected-item clear conditions correctly', () => {
    expect(shouldClearSelectedItems('ORD-1001', 'ORD-1001')).toBe(true);
    expect(shouldClearSelectedItems('ORD-1001', 'ORD-2002')).toBe(false);
    expect(shouldClearSelectedItems(null, 'ORD-1001')).toBe(false);
    expect(shouldClearSelectedItems('', 'ORD-1001')).toBe(false);
    expect(shouldClearSelectedItems('ORD-1001', null)).toBe(false);
    expect(shouldClearSelectedItems('ORD-1001', '')).toBe(false);
  });

  it('reads and clears pending order id from storage', () => {
    const storage = new Map<string, string>();
    const mockStorage = {
      getItem(key: string) {
        return storage.has(key) ? storage.get(key)! : null;
      },
      setItem(key: string, value: string) {
        storage.set(key, value);
      },
      removeItem(key: string) {
        storage.delete(key);
      },
    };

    mockStorage.setItem('shop-easy-pending-order-id', 'ORD-CURRENT');
    expect(readPendingOrderId(mockStorage)).toBe('ORD-CURRENT');

    clearPendingOrderId(mockStorage);
    expect(readPendingOrderId(mockStorage)).toBeNull();
  });
});
