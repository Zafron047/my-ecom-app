import type { BundleOfferLite } from '@/lib/bundle-types';

export type CartLineInput = {
  id: string;
  productId: string;
  variantId?: string;
  quantity: number;
  unitPrice: number;
};

export type CartLinePricing = {
  lineSubtotal: number;
  lineDiscount: number;
  lineTotal: number;
  bundleTitle?: string;
  bundleMinTotalQty?: number;
  bundleDiscountPercent?: number;
};

export type CartPricingResult = {
  linePricingById: Record<string, CartLinePricing>;
  subtotalBeforeDiscount: number;
  discountTotal: number;
  subtotal: number;
};

function isLineEligibleForOffer(
  line: Pick<CartLineInput, 'variantId'>,
  offer: Pick<BundleOfferLite, 'variantIds'>,
) {
  if (offer.variantIds.length === 0) return false;
  if (!line.variantId) return false;
  return offer.variantIds.includes(line.variantId);
}

type OfferApplication = {
  offer: BundleOfferLite;
  affectedLineIndexes: number[];
  gain: number;
};

function solveBestOfferPlan(
  cartLines: CartLineInput[],
  activeOffers: BundleOfferLite[],
) {
  if (cartLines.length === 0 || activeOffers.length === 0) {
    return {
      lineOfferById: new Map<string, BundleOfferLite>(),
    };
  }

  const quantities = cartLines.map((line) => line.quantity);
  const subtotals = cartLines.map((line) => line.unitPrice * line.quantity);

  const eligibleLineIndexesByOffer = activeOffers.map((offer) =>
    cartLines
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => isLineEligibleForOffer(line, offer))
      .map(({ index }) => index),
  );

  const fullState = '1'.repeat(cartLines.length);
  const memo = new Map<string, { gain: number; applications: OfferApplication[] }>();

  function solve(state: string): { gain: number; applications: OfferApplication[] } {
    const cached = memo.get(state);
    if (cached) return cached;
    if (!state.includes('1')) {
      const empty = { gain: 0, applications: [] as OfferApplication[] };
      memo.set(state, empty);
      return empty;
    }

    let best = { gain: 0, applications: [] as OfferApplication[] };

    for (let offerIndex = 0; offerIndex < activeOffers.length; offerIndex += 1) {
      const offer = activeOffers[offerIndex];
      const candidateIndexes = eligibleLineIndexesByOffer[offerIndex].filter(
        (lineIndex) => state[lineIndex] === '1',
      );
      if (candidateIndexes.length === 0) continue;

      let eligibleQty = 0;
      let gain = 0;
      for (const lineIndex of candidateIndexes) {
        eligibleQty += quantities[lineIndex];
        gain += subtotals[lineIndex] * (offer.discountPercent / 100);
      }
      if (eligibleQty < offer.minTotalQty) continue;

      const nextStateChars = state.split('');
      for (const lineIndex of candidateIndexes) {
        nextStateChars[lineIndex] = '0';
      }
      const next = solve(nextStateChars.join(''));
      const totalGain = gain + next.gain;

      if (totalGain > best.gain) {
        best = {
          gain: totalGain,
          applications: [{ offer, affectedLineIndexes: candidateIndexes, gain }, ...next.applications],
        };
      }
    }

    memo.set(state, best);
    return best;
  }

  const bestPlan = solve(fullState);
  const lineOfferById = new Map<string, BundleOfferLite>();
  for (const application of bestPlan.applications) {
    for (const lineIndex of application.affectedLineIndexes) {
      lineOfferById.set(cartLines[lineIndex].id, application.offer);
    }
  }

  return { lineOfferById };
}

export function computeCartPricing(
  lines: CartLineInput[],
  getOffersForProduct: (productId: string) => BundleOfferLite[],
  globalOffers: BundleOfferLite[] = [],
): CartPricingResult {
  const seenLineIds = new Set<string>();
  for (const line of lines) {
    if (seenLineIds.has(line.id)) {
      throw new Error(`Duplicate cart line id detected: ${line.id}`);
    }
    seenLineIds.add(line.id);
  }

  const offersById = new Map<string, BundleOfferLite>();
  for (const offer of globalOffers) {
    if (offer.isActive) {
      offersById.set(offer.id, offer);
    }
  }
  for (const productId of new Set(lines.map((line) => line.productId))) {
    for (const offer of getOffersForProduct(productId)) {
      if (offer.isActive) {
        offersById.set(offer.id, offer);
      }
    }
  }

  const { lineOfferById: assignedOfferByLineId } = solveBestOfferPlan(
    lines,
    [...offersById.values()],
  );
  const linePricingById: Record<string, CartLinePricing> = {};

  for (const line of lines) {
    const lineSubtotal = line.unitPrice * line.quantity;
    const appliedOffer = assignedOfferByLineId.get(line.id);
    const bundleDiscountPercent = appliedOffer?.discountPercent ?? 0;
    const lineDiscount = lineSubtotal * (bundleDiscountPercent / 100);
    const lineTotal = lineSubtotal - lineDiscount;

    linePricingById[line.id] = {
      lineSubtotal,
      lineDiscount,
      lineTotal,
      ...(appliedOffer
        ? {
            bundleTitle: appliedOffer.title,
            bundleMinTotalQty: appliedOffer.minTotalQty,
            bundleDiscountPercent: appliedOffer.discountPercent,
          }
        : {}),
    };
  }

  const subtotalBeforeDiscount = Object.values(linePricingById).reduce(
    (sum, line) => sum + line.lineSubtotal,
    0,
  );
  const discountTotal = Object.values(linePricingById).reduce(
    (sum, line) => sum + line.lineDiscount,
    0,
  );

  return {
    linePricingById,
    subtotalBeforeDiscount,
    discountTotal,
    subtotal: subtotalBeforeDiscount - discountTotal,
  };
}
