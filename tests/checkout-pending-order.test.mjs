import assert from 'node:assert/strict';

import {
  CHECKOUT_PENDING_ORDER_KEY,
  clearPendingOrderId,
  readPendingOrderId,
  shouldClearSelectedItems,
} from '../src/lib/checkoutPendingOrder.js';

assert.equal(CHECKOUT_PENDING_ORDER_KEY, 'shop-easy-pending-order-id');
assert.equal(shouldClearSelectedItems('ORD-1001', 'ORD-1001'), true);
assert.equal(shouldClearSelectedItems('ORD-1001', 'ORD-2002'), false);
assert.equal(shouldClearSelectedItems(null, 'ORD-1001'), false);
assert.equal(shouldClearSelectedItems('', 'ORD-1001'), false);
assert.equal(shouldClearSelectedItems('ORD-1001', null), false);
assert.equal(shouldClearSelectedItems('ORD-1001', ''), false);

const storage = new Map();
const mockStorage = {
  getItem(key) {
    return storage.has(key) ? storage.get(key) : null;
  },
  setItem(key, value) {
    storage.set(key, value);
  },
  removeItem(key) {
    storage.delete(key);
  },
};

mockStorage.setItem('buy-easy-pending-order-id', 'ORD-LEGACY');
assert.equal(readPendingOrderId(mockStorage), 'ORD-LEGACY');

mockStorage.setItem('shop-easy-pending-order-id', 'ORD-CURRENT');
assert.equal(readPendingOrderId(mockStorage), 'ORD-CURRENT');

clearPendingOrderId(mockStorage);
assert.equal(readPendingOrderId(mockStorage), null);

console.log('checkout-pending-order tests passed');
