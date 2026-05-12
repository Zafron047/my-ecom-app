import { describe, expect, it } from 'vitest';
import { computeCartPricing, type CartLineInput } from '../src/lib/cart-bundle-pricing';
import type { BundleOfferLite } from '../src/lib/bundle-types';

function getOffersByProduct(offers: BundleOfferLite[]) {
  return () => offers;
}

describe('computeCartPricing bundle tiers', () => {
  it('applies 10% for qty 3 tier', () => {
    const lines: CartLineInput[] = [
      { id: 'l1', productId: 'p1', variantId: 'v1', quantity: 3, unitPrice: 100 },
    ];
    const offers: BundleOfferLite[] = [
      { id: 'o10', title: 'Buy 3 get 10%', minTotalQty: 3, discountPercent: 10, variantIds: ['v1'], isActive: true },
      { id: 'o35', title: 'Buy 6 get 35%', minTotalQty: 6, discountPercent: 35, variantIds: ['v1'], isActive: true },
    ];

    const pricing = computeCartPricing(lines, getOffersByProduct(offers));
    expect(pricing.linePricingById.l1.bundleDiscountPercent).toBe(10);
    expect(pricing.discountTotal).toBe(30);
    expect(pricing.subtotal).toBe(270);
  });

  it('upgrades to 35% for qty 6 tier', () => {
    const lines: CartLineInput[] = [
      { id: 'l1', productId: 'p1', variantId: 'v1', quantity: 6, unitPrice: 100 },
    ];
    const offers: BundleOfferLite[] = [
      { id: 'o10', title: 'Buy 3 get 10%', minTotalQty: 3, discountPercent: 10, variantIds: ['v1'], isActive: true },
      { id: 'o35', title: 'Buy 6 get 35%', minTotalQty: 6, discountPercent: 35, variantIds: ['v1'], isActive: true },
    ];

    const pricing = computeCartPricing(lines, getOffersByProduct(offers));
    expect(pricing.linePricingById.l1.bundleDiscountPercent).toBe(35);
    expect(pricing.discountTotal).toBe(210);
    expect(pricing.subtotal).toBe(390);
  });

  it('does not apply offer for non-eligible variant', () => {
    const lines: CartLineInput[] = [
      { id: 'l1', productId: 'p1', variantId: 'v2', quantity: 3, unitPrice: 100 },
    ];
    const offers: BundleOfferLite[] = [
      { id: 'o10', title: 'Buy 3 get 10%', minTotalQty: 3, discountPercent: 10, variantIds: ['v1'], isActive: true },
    ];

    const pricing = computeCartPricing(lines, getOffersByProduct(offers));
    expect(pricing.linePricingById.l1.bundleDiscountPercent).toBeUndefined();
    expect(pricing.discountTotal).toBe(0);
    expect(pricing.subtotal).toBe(300);
  });

  it('does not apply offer when variantId is missing', () => {
    const lines: CartLineInput[] = [
      { id: 'l1', productId: 'p1', variantId: undefined, quantity: 3, unitPrice: 100 },
    ];
    const offers: BundleOfferLite[] = [
      { id: 'o10', title: 'Buy 3 get 10%', minTotalQty: 3, discountPercent: 10, variantIds: ['v1'], isActive: true },
    ];

    const pricing = computeCartPricing(lines, getOffersByProduct(offers));
    expect(pricing.linePricingById.l1.bundleDiscountPercent).toBeUndefined();
    expect(pricing.discountTotal).toBe(0);
    expect(pricing.subtotal).toBe(300);
  });

  it('counts only eligible variants for tier and discounts only eligible lines', () => {
    const lines: CartLineInput[] = [
      { id: 'leopard', productId: 'p1', variantId: 'v-leopard', quantity: 5, unitPrice: 100 },
      { id: 'black', productId: 'p1', variantId: 'v-black', quantity: 5, unitPrice: 100 },
    ];
    const offers: BundleOfferLite[] = [
      {
        id: 'o15',
        title: 'Buy 5 Leopard get 15%',
        minTotalQty: 5,
        discountPercent: 15,
        variantIds: ['v-leopard'],
        isActive: true,
      },
    ];

    const pricing = computeCartPricing(lines, getOffersByProduct(offers));
    expect(pricing.linePricingById.leopard.bundleDiscountPercent).toBe(15);
    expect(pricing.linePricingById.black.bundleDiscountPercent).toBeUndefined();
    expect(pricing.linePricingById.leopard.lineDiscount).toBe(75);
    expect(pricing.linePricingById.black.lineDiscount).toBe(0);
    expect(pricing.discountTotal).toBe(75);
  });

  it('does not apply active offers without explicitly eligible variants', () => {
    const lines: CartLineInput[] = [
      { id: 'l1', productId: 'p1', variantId: 'v-a', quantity: 3, unitPrice: 100 },
      { id: 'l2', productId: 'p1', variantId: 'v-b', quantity: 2, unitPrice: 100 },
    ];
    const offers: BundleOfferLite[] = [
      { id: 'o30', title: 'Buy 10 get 30%', minTotalQty: 10, discountPercent: 30, variantIds: [], isActive: true },
      { id: 'o20', title: 'Buy 5 get 20%', minTotalQty: 5, discountPercent: 20, variantIds: [], isActive: true },
      { id: 'o10', title: 'Buy 3 get 10%', minTotalQty: 3, discountPercent: 10, variantIds: [], isActive: true },
    ];

    const pricing = computeCartPricing(lines, getOffersByProduct(offers));
    expect(pricing.linePricingById.l1.bundleDiscountPercent).toBeUndefined();
    expect(pricing.linePricingById.l2.bundleDiscountPercent).toBeUndefined();
    expect(pricing.discountTotal).toBe(0);
  });

  it('applies next best offer on remaining variants after a variant-specific winner', () => {
    const lines: CartLineInput[] = [
      { id: 'leopard', productId: 'p1', variantId: 'v-leopard', quantity: 5, unitPrice: 8000 },
      { id: 'black', productId: 'p1', variantId: 'v-black', quantity: 5, unitPrice: 2300 },
    ];
    const offers: BundleOfferLite[] = [
      { id: 'o30', title: 'Buy 10 Bags get 30% OFF', minTotalQty: 10, discountPercent: 30, variantIds: ['v-leopard', 'v-black'], isActive: true },
      { id: 'o20', title: 'Buy 5 Bags get 20% OFF', minTotalQty: 5, discountPercent: 20, variantIds: ['v-leopard', 'v-black'], isActive: true },
      { id: 'o10', title: 'Buy 3 Bags get 10% OFF', minTotalQty: 3, discountPercent: 10, variantIds: ['v-leopard', 'v-black'], isActive: true },
      { id: 'o50', title: 'Clearance - Buy 5 Leopard Bags get 50% OFF', minTotalQty: 5, discountPercent: 50, variantIds: ['v-leopard'], isActive: true },
    ];

    const pricing = computeCartPricing(lines, getOffersByProduct(offers));
    expect(pricing.linePricingById.leopard.bundleTitle).toBe('Clearance - Buy 5 Leopard Bags get 50% OFF');
    expect(pricing.linePricingById.black.bundleTitle).toBe('Buy 5 Bags get 20% OFF');
    expect(pricing.linePricingById.leopard.lineDiscount).toBe(20000);
    expect(pricing.linePricingById.black.lineDiscount).toBe(2300);
    expect(pricing.discountTotal).toBe(22300);
  });

  it('chooses global max discount over greedy local winner', () => {
    const lines: CartLineInput[] = [
      { id: 'red', productId: 'p1', variantId: 'v-red', quantity: 3, unitPrice: 1200 },
      { id: 'gray', productId: 'p1', variantId: 'v-gray', quantity: 7, unitPrice: 1900 },
    ];
    const offers: BundleOfferLite[] = [
      { id: 'red60', title: 'Red 60%', minTotalQty: 3, discountPercent: 60, variantIds: ['v-red'], isActive: true },
      { id: 'all35', title: 'All 35%', minTotalQty: 10, discountPercent: 35, variantIds: ['v-red', 'v-gray'], isActive: true },
    ];

    const pricing = computeCartPricing(lines, getOffersByProduct(offers));
    expect(pricing.linePricingById.red.bundleTitle).toBe('All 35%');
    expect(pricing.linePricingById.gray.bundleTitle).toBe('All 35%');
    expect(pricing.discountTotal).toBe(5915);
  });

  it('applies a global offer across eligible variants from different products', () => {
    const lines: CartLineInput[] = [
      { id: 'shirt', productId: 'p-shirt', variantId: 'v-shirt-red', quantity: 1, unitPrice: 1000 },
      { id: 'pant', productId: 'p-pant', variantId: 'v-pant-black', quantity: 1, unitPrice: 2000 },
    ];
    const globalOffers: BundleOfferLite[] = [
      {
        id: 'outfit',
        title: 'Outfit bundle',
        minTotalQty: 2,
        discountPercent: 10,
        variantIds: ['v-shirt-red', 'v-pant-black'],
        isActive: true,
      },
    ];

    const pricing = computeCartPricing(lines, () => [], globalOffers);
    expect(pricing.linePricingById.shirt.bundleTitle).toBe('Outfit bundle');
    expect(pricing.linePricingById.pant.bundleTitle).toBe('Outfit bundle');
    expect(pricing.discountTotal).toBe(300);
    expect(pricing.subtotal).toBe(2700);
  });
});
