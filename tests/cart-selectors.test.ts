import { describe, expect, it } from 'vitest';
import {
  selectCartItems,
  selectItemCount,
  selectSelectedCartItems,
  selectSelectedItemCount,
  selectPricing,
} from '../src/store/cartSelectors';
import type { RootState } from '../src/store/store';

function createState(): RootState {
  return {
    cart: {
      cartItems: [
        {
          id: 'p1::v1',
          detailId: 'p1',
          variantId: 'v1',
          variantLabel: 'Red / M',
          name: 'Product 1',
          price: 100,
          image: '/p1.jpg',
          quantity: 3,
          selected: true,
          bundleOffers: [
            {
              id: 'o10',
              title: 'Buy 3 get 10%',
              minTotalQty: 3,
              discountPercent: 10,
              variantIds: ['v1'],
              isActive: true,
            },
            {
              id: 'o35',
              title: 'Buy 6 get 35%',
              minTotalQty: 6,
              discountPercent: 35,
              variantIds: ['v1'],
              isActive: true,
            },
          ],
        },
        {
          id: 'p2::v2',
          detailId: 'p2',
          variantId: 'v2',
          variantLabel: 'Blue / L',
          name: 'Product 2',
          price: 50,
          image: '/p2.jpg',
          quantity: 2,
          selected: false,
          bundleOffers: [],
        },
      ],
      isCartOpen: false,
      cartNotices: [],
      shippingOption: 'dhaka-city',
      hasHydrated: true,
      catalogBundleOffersByProductId: {},
      lastBundleSyncSnapshot: null,
    },
  } as RootState;
}

describe('cartSelectors', () => {
  it('returns cart items and counts', () => {
    const state = createState();

    expect(selectCartItems(state)).toHaveLength(2);
    expect(selectItemCount(state)).toBe(5);
    expect(selectSelectedCartItems(state)).toHaveLength(1);
    expect(selectSelectedItemCount(state)).toBe(3);
  });

  it('computes pricing using selected items and bundle tiers', () => {
    const state = createState();
    const pricing = selectPricing(state);

    expect(pricing.subtotalBeforeDiscount).toBe(300);
    expect(pricing.discountTotal).toBe(30);
    expect(pricing.subtotal).toBe(270);
    expect(pricing.linePricingById['p1::v1']?.bundleDiscountPercent).toBe(10);
    expect(pricing.linePricingById['p2::v2']).toBeUndefined();
  });
});
