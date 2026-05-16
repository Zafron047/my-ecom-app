import { describe, expect, it } from 'vitest';
import {
  PURCHASE_ENTRY_STATUS,
  PURCHASE_PAYMENT_STATUS,
  derivePurchaseEntryStatus,
  getPurchaseEntryLifecycleLabel,
  shouldShowInClosedPurchaseOrderList,
  shouldShowInOpenPurchaseOrderList,
} from '@/lib/purchase-order-status';

describe('purchase order lifecycle status', () => {
  it('keeps closed paid fully received POs out of the open PO list', () => {
    const reportedClosedPo = {
      paymentStatus: PURCHASE_PAYMENT_STATUS.PAID,
      receivedQuantity: 100,
      status: PURCHASE_ENTRY_STATUS.CLOSED,
      totalQuantity: 100,
    };

    expect(shouldShowInOpenPurchaseOrderList(reportedClosedPo)).toBe(false);
    expect(shouldShowInClosedPurchaseOrderList(reportedClosedPo)).toBe(true);
    expect(getPurchaseEntryLifecycleLabel(reportedClosedPo)).toBe('Closed');
  });

  it('treats legacy paid and fully received records as closed', () => {
    const legacyClosedPo = {
      paymentStatus: PURCHASE_PAYMENT_STATUS.PAID,
      receivedQuantity: 12,
      status: PURCHASE_ENTRY_STATUS.LEGACY_RECEIVED,
      totalQuantity: 12,
    };

    expect(shouldShowInOpenPurchaseOrderList(legacyClosedPo)).toBe(false);
    expect(shouldShowInClosedPurchaseOrderList(legacyClosedPo)).toBe(true);
  });

  it('keeps not fully settled submitted POs in the open list', () => {
    expect(
      shouldShowInOpenPurchaseOrderList({
        paymentStatus: PURCHASE_PAYMENT_STATUS.PAID,
        receivedQuantity: 99,
        status: PURCHASE_ENTRY_STATUS.OPEN,
        totalQuantity: 100,
      }),
    ).toBe(true);
    expect(
      shouldShowInOpenPurchaseOrderList({
        paymentStatus: PURCHASE_PAYMENT_STATUS.PARTIAL_PAID,
        receivedQuantity: 100,
        status: PURCHASE_ENTRY_STATUS.OPEN,
        totalQuantity: 100,
      }),
    ).toBe(true);
  });

  it('does not show purchase entries in PO lists until submitted', () => {
    const draftEntry = {
      paymentStatus: PURCHASE_PAYMENT_STATUS.DUE,
      receivedQuantity: 0,
      status: PURCHASE_ENTRY_STATUS.DRAFT,
      totalQuantity: 10,
    };

    expect(shouldShowInOpenPurchaseOrderList(draftEntry)).toBe(false);
    expect(shouldShowInClosedPurchaseOrderList(draftEntry)).toBe(false);
  });

  it('derives stored PO status from payment and receiving state', () => {
    expect(
      derivePurchaseEntryStatus({
        paymentStatus: PURCHASE_PAYMENT_STATUS.PAID,
        receivedQuantity: 5,
        totalQuantity: 5,
      }),
    ).toBe(PURCHASE_ENTRY_STATUS.CLOSED);
    expect(
      derivePurchaseEntryStatus({
        paymentStatus: PURCHASE_PAYMENT_STATUS.PAID,
        receivedQuantity: 4,
        totalQuantity: 5,
      }),
    ).toBe(PURCHASE_ENTRY_STATUS.OPEN);
  });
});
