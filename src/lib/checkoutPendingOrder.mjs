export const CHECKOUT_PENDING_ORDER_KEY = 'shop-easy-pending-order-id';
const LEGACY_CHECKOUT_PENDING_ORDER_KEYS = [];

export function readPendingOrderId(storage) {
  const currentPendingOrderId = storage.getItem(CHECKOUT_PENDING_ORDER_KEY);
  if (currentPendingOrderId) return currentPendingOrderId;

  for (const legacyKey of LEGACY_CHECKOUT_PENDING_ORDER_KEYS) {
    const legacyPendingOrderId = storage.getItem(legacyKey);
    if (legacyPendingOrderId) return legacyPendingOrderId;
  }

  return null;
}

export function clearPendingOrderId(storage) {
  storage.removeItem(CHECKOUT_PENDING_ORDER_KEY);

  for (const legacyKey of LEGACY_CHECKOUT_PENDING_ORDER_KEYS) {
    storage.removeItem(legacyKey);
  }
}

export function shouldClearSelectedItems(pendingOrderId, currentOrderId) {
  if (!pendingOrderId || !currentOrderId) return false;
  return pendingOrderId === currentOrderId;
}
