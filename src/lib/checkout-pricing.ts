import { computeCartPricing } from '@/lib/cart-bundle-pricing';
import type { BundleOfferLite } from '@/lib/bundle-types';
import { getShippingCharge } from '@/lib/shipping-charge';

export type CheckoutItemInput = {
  id: string;
  detailId?: string;
  variantId?: string;
  name: string;
  price: number;
  salePrice?: number;
  quantity: number;
};

export type CheckoutProduct = {
  id: string;
  name: string;
  variants: Array<{
    id: string;
    sku: string;
    color: string | null;
    size: string | null;
    price: { toNumber(): number };
  }>;
  bundleOffers: Array<{
    id: string;
    title: string | null;
    minTotalQty: number;
    discountPercent: { toNumber(): number };
    isActive: boolean;
    variants: Array<{ variantId: string }>;
  }>;
};

export type BuildCheckoutPricingInput = {
  items: CheckoutItemInput[];
  products: CheckoutProduct[];
  shipping: {
    division: string;
    district: string;
    thana: string;
  };
};

export type PreparedOrderLine = {
  lineId: string;
  productId: string;
  variantId: string;
  productName: string;
  variantLabel: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  discountAmount: number;
};

export type BuildCheckoutPricingResult =
  | {
      ok: true;
      subtotalBeforeDiscount: number;
      subtotal: number;
      discountAmount: number;
      deliveryCharge: number;
      totalAmount: number;
      lines: PreparedOrderLine[];
    }
  | {
      ok: false;
      error: string;
    };

function toMoney(value: number) {
  return Number(value.toFixed(2));
}

export function buildCheckoutPricing(
  input: BuildCheckoutPricingInput,
): BuildCheckoutPricingResult {
  const productById = new Map(input.products.map((product) => [product.id, product]));

  const offersByProductId = new Map<string, BundleOfferLite[]>();
  for (const product of input.products) {
    offersByProductId.set(
      product.id,
      product.bundleOffers.map((offer) => ({
        id: offer.id,
        title: offer.title?.trim() || 'Bundle Offer',
        minTotalQty: offer.minTotalQty,
        discountPercent: offer.discountPercent.toNumber(),
        variantIds: offer.variants.map((item) => item.variantId),
        isActive: offer.isActive,
      })),
    );
  }

  const rawLines: Array<{
    lineId: string;
    productId: string;
    variantId: string;
    productName: string;
    variantLabel: string;
    sku: string;
    quantity: number;
    unitPrice: number;
  }> = [];

  for (const item of input.items) {
    const productId = item.detailId ?? item.id;
    const product = productById.get(productId);
    const variant =
      product?.variants.find((candidate) => candidate.id === item.variantId) ??
      (product?.variants.length === 1 ? product.variants[0] : undefined);

    if (!product || !variant) {
      return {
        ok: false,
        error: `Product variant not found for item ${item.name}. Please refresh and add the item again.`,
      };
    }

    const quantity = Math.max(1, Math.floor(item.quantity || 1));
    const unitPrice = toMoney(variant.price.toNumber());
    const variantLabel = [variant.color, variant.size].filter(Boolean).join(' / ');

    rawLines.push({
      lineId: item.id,
      productId: product.id,
      variantId: variant.id,
      productName: product.name,
      variantLabel,
      sku: variant.sku,
      quantity,
      unitPrice,
    });
  }

  const pricing = computeCartPricing(
    rawLines.map((line) => ({
      id: line.lineId,
      productId: line.productId,
      variantId: line.variantId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    })),
    (productId) => offersByProductId.get(productId) ?? [],
  );

  const deliveryCharge = toMoney(
    getShippingCharge({
      division: input.shipping.division,
      district: input.shipping.district,
      area: input.shipping.thana,
    }),
  );

  const subtotalBeforeDiscount = toMoney(pricing.subtotalBeforeDiscount);
  const discountAmount = toMoney(pricing.discountTotal);
  const subtotal = toMoney(pricing.subtotal);
  const totalAmount = toMoney(subtotal + deliveryCharge);

  const lines: PreparedOrderLine[] = rawLines.map((line) => {
    const pricedLine = pricing.linePricingById[line.lineId];
    return {
      lineId: line.lineId,
      productId: line.productId,
      variantId: line.variantId,
      productName: line.productName,
      variantLabel: line.variantLabel,
      sku: line.sku,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineTotal: toMoney(pricedLine?.lineTotal ?? line.unitPrice * line.quantity),
      discountAmount: toMoney(pricedLine?.lineDiscount ?? 0),
    };
  });

  return {
    ok: true,
    subtotalBeforeDiscount,
    subtotal,
    discountAmount,
    deliveryCharge,
    totalAmount,
    lines,
  };
}

