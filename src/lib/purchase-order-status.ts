export const PURCHASE_ENTRY_STATUS = {
  CANCELLED: 'cancelled',
  CLOSED: 'closed',
  CLOSED_SHORT: 'closed_short',
  DRAFT: 'draft',
  LEGACY_FULL_RECEIVED: 'full_received',
  LEGACY_PARTIAL_RECEIVED: 'partial_received',
  LEGACY_RECEIVED: 'received',
  LEGACY_RECORDED: 'recorded',
  OPEN: 'open',
} as const;

export const PURCHASE_PAYMENT_STATUS = {
  DUE: 'due',
  PAID: 'paid',
  PARTIAL_PAID: 'partial_paid',
} as const;

export const PURCHASE_PAYMENT_METHODS = ['bank', 'bkash', 'cash'] as const;
export const PURCHASE_PAYMENT_STATUSES = Object.values(PURCHASE_PAYMENT_STATUS);

export const LOCKED_CLOSED_PURCHASE_ENTRY_STATUSES = [
  PURCHASE_ENTRY_STATUS.CANCELLED,
  PURCHASE_ENTRY_STATUS.CLOSED_SHORT,
] as const;

export const CLOSED_PURCHASE_ENTRY_STATUSES = [
  PURCHASE_ENTRY_STATUS.CLOSED,
  ...LOCKED_CLOSED_PURCHASE_ENTRY_STATUSES,
] as const;

type PurchaseEntryLifecycleInput = {
  paymentStatus: string;
  receivedQuantity: number;
  status: string;
  totalQuantity: number;
};

const CLOSED_PURCHASE_ENTRY_STATUS_SET = new Set<string>(
  CLOSED_PURCHASE_ENTRY_STATUSES,
);
const LOCKED_CLOSED_PURCHASE_ENTRY_STATUS_SET = new Set<string>(
  LOCKED_CLOSED_PURCHASE_ENTRY_STATUSES,
);
const PURCHASE_PAYMENT_METHOD_SET = new Set<string>(PURCHASE_PAYMENT_METHODS);
const PURCHASE_PAYMENT_STATUS_SET = new Set<string>(PURCHASE_PAYMENT_STATUSES);

export function isPurchaseEntryDraft(status: string) {
  return status === PURCHASE_ENTRY_STATUS.DRAFT;
}

export function isPurchaseEntryLockedClosed(status: string) {
  return LOCKED_CLOSED_PURCHASE_ENTRY_STATUS_SET.has(status);
}

export function isPurchasePaymentMethod(method: string) {
  return PURCHASE_PAYMENT_METHOD_SET.has(method);
}

export function isPurchasePaymentStatus(status: string) {
  return PURCHASE_PAYMENT_STATUS_SET.has(status);
}

export function isPurchaseEntryFullySettled(input: {
  paymentStatus: string;
  receivedQuantity: number;
  totalQuantity: number;
}) {
  return (
    input.paymentStatus === PURCHASE_PAYMENT_STATUS.PAID &&
    input.totalQuantity > 0 &&
    input.receivedQuantity >= input.totalQuantity
  );
}

export function isPurchaseEntryLifecycleClosed(
  input: PurchaseEntryLifecycleInput,
) {
  if (CLOSED_PURCHASE_ENTRY_STATUS_SET.has(input.status)) return true;
  return isPurchaseEntryFullySettled(input);
}

export function shouldShowInOpenPurchaseOrderList(
  input: PurchaseEntryLifecycleInput,
) {
  return (
    !isPurchaseEntryDraft(input.status) &&
    !isPurchaseEntryLifecycleClosed(input)
  );
}

export function shouldShowInClosedPurchaseOrderList(
  input: PurchaseEntryLifecycleInput,
) {
  return (
    !isPurchaseEntryDraft(input.status) &&
    isPurchaseEntryLifecycleClosed(input)
  );
}

export function derivePurchaseEntryStatus(input: {
  paymentStatus: string;
  receivedQuantity: number;
  totalQuantity: number;
}) {
  return isPurchaseEntryFullySettled(input)
    ? PURCHASE_ENTRY_STATUS.CLOSED
    : PURCHASE_ENTRY_STATUS.OPEN;
}

export function getPurchaseEntryLifecycleLabel(
  input: PurchaseEntryLifecycleInput,
) {
  if (isPurchaseEntryDraft(input.status)) return 'Purchase Entry';
  if (input.status === PURCHASE_ENTRY_STATUS.CANCELLED) return 'Cancelled';
  if (input.status === PURCHASE_ENTRY_STATUS.CLOSED_SHORT) return 'Closed Short';
  if (isPurchaseEntryLifecycleClosed(input)) return 'Closed';
  return 'Open';
}

export function formatPurchaseEntryStatusLabel(status: string) {
  const labels: Record<string, string> = {
    [PURCHASE_ENTRY_STATUS.CANCELLED]: 'Cancelled',
    [PURCHASE_ENTRY_STATUS.CLOSED]: 'Closed',
    [PURCHASE_ENTRY_STATUS.CLOSED_SHORT]: 'Closed Short',
    [PURCHASE_ENTRY_STATUS.DRAFT]: 'Purchase Entry',
    [PURCHASE_ENTRY_STATUS.LEGACY_FULL_RECEIVED]: 'Full Received',
    [PURCHASE_ENTRY_STATUS.LEGACY_PARTIAL_RECEIVED]: 'Partial Received',
    [PURCHASE_ENTRY_STATUS.LEGACY_RECEIVED]: 'Received',
    [PURCHASE_ENTRY_STATUS.LEGACY_RECORDED]: 'Confirmed',
    [PURCHASE_ENTRY_STATUS.OPEN]: 'Open',
  };
  return labels[status] ?? status.replace(/_/g, ' ');
}

export function getPurchaseEntryReceivingStatus(
  totalQuantity: number,
  receivedQuantity: number,
) {
  if (receivedQuantity <= 0) return 'Not Received';
  if (receivedQuantity >= totalQuantity) return 'Full Received';
  return 'Partial Received';
}

export function formatPurchasePaymentStatus(status: string) {
  const labels: Record<string, string> = {
    [PURCHASE_PAYMENT_STATUS.DUE]: 'Due',
    [PURCHASE_PAYMENT_STATUS.PAID]: 'Paid',
    [PURCHASE_PAYMENT_STATUS.PARTIAL_PAID]: 'Partially Paid',
  };
  return labels[status] ?? status.replace(/_/g, ' ');
}
