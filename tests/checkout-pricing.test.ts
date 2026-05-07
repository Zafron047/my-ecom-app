import { describe, expect, it } from 'vitest';
import { buildCheckoutPricing, type CheckoutProduct } from '../src/lib/checkout-pricing';

function money(value: number) {
  return { toNumber: () => value };
}

function makeProduct(overrides?: Partial<CheckoutProduct>): CheckoutProduct {
  return {
    id: 'p1',
    name: 'Product 1',
    variants: [
      { id: 'v1', sku: 'SKU-1', color: 'Red', size: 'M', price: money(100) },
    ],
    bundleOffers: [
      {
        id: 'o10',
        title: 'Buy 3 get 10%',
        minTotalQty: 3,
        discountPercent: money(10),
        isActive: true,
        variants: [{ variantId: 'v1' }],
      },
    ],
    ...overrides,
  };
}

describe('buildCheckoutPricing', () => {
  it('recomputes totals server-side and applies bundle discount', () => {
    const result = buildCheckoutPricing({
      items: [
        {
          id: 'line-1',
          detailId: 'p1',
          variantId: 'v1',
          name: 'Product 1',
          price: 9999,
          quantity: 3,
        },
      ],
      products: [makeProduct()],
      shipping: {
        division: 'Dhaka',
        district: 'Dhaka',
        thana: 'Dhanmondi',
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.subtotalBeforeDiscount).toBe(300);
    expect(result.discountAmount).toBe(30);
    expect(result.subtotal).toBe(270);
    expect(result.deliveryCharge).toBe(80);
    expect(result.totalAmount).toBe(350);
    expect(result.lines[0]?.unitPrice).toBe(100);
    expect(result.lines[0]?.discountAmount).toBe(30);
    expect(result.lines[0]?.lineTotal).toBe(270);
  });

  it('returns error when selected variant is missing for multi-variant product', () => {
    const product = makeProduct({
      variants: [
        { id: 'v1', sku: 'SKU-1', color: 'Red', size: 'M', price: money(100) },
        { id: 'v2', sku: 'SKU-2', color: 'Blue', size: 'L', price: money(120) },
      ],
    });

    const result = buildCheckoutPricing({
      items: [
        {
          id: 'line-1',
          detailId: 'p1',
          variantId: undefined,
          name: 'Product 1',
          price: 100,
          quantity: 1,
        },
      ],
      products: [product],
      shipping: {
        division: 'Dhaka',
        district: 'Dhaka',
        thana: 'Dhanmondi',
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('Product variant not found');
  });

  it('discounts only eligible variants across mixed lines for the same product', () => {
    const product = makeProduct({
      variants: [
        { id: 'v1', sku: 'SKU-1', color: 'Red', size: 'M', price: money(100) },
        { id: 'v2', sku: 'SKU-2', color: 'Blue', size: 'L', price: money(120) },
      ],
      bundleOffers: [
        {
          id: 'o10',
          title: 'Buy 3 get 10%',
          minTotalQty: 3,
          discountPercent: money(10),
          isActive: true,
          variants: [{ variantId: 'v1' }],
        },
      ],
    });

    const result = buildCheckoutPricing({
      items: [
        {
          id: 'line-v1',
          detailId: 'p1',
          variantId: 'v1',
          name: 'Product 1 Red',
          price: 999,
          quantity: 3,
        },
        {
          id: 'line-v2',
          detailId: 'p1',
          variantId: 'v2',
          name: 'Product 1 Blue',
          price: 1,
          quantity: 2,
        },
      ],
      products: [product],
      shipping: {
        division: 'Dhaka',
        district: 'Dhaka',
        thana: 'Dhanmondi',
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const lineV1 = result.lines.find((line) => line.lineId === 'line-v1');
    const lineV2 = result.lines.find((line) => line.lineId === 'line-v2');

    expect(lineV1?.unitPrice).toBe(100);
    expect(lineV1?.discountAmount).toBe(30);
    expect(lineV1?.lineTotal).toBe(270);

    expect(lineV2?.unitPrice).toBe(120);
    expect(lineV2?.discountAmount).toBe(0);
    expect(lineV2?.lineTotal).toBe(240);

    expect(result.subtotalBeforeDiscount).toBe(540);
    expect(result.discountAmount).toBe(30);
    expect(result.subtotal).toBe(510);
    expect(result.totalAmount).toBe(590);
  });
});
