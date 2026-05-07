import { createSelector } from '@reduxjs/toolkit';
import { computeCartPricing } from '@/lib/cart-bundle-pricing';
import type { BundleOfferLite } from '@/lib/bundle-types';
import type { RootState } from '@/store/store';

const selectCartState = (state: RootState) => state.cart;

export const selectCartItems = createSelector(
  [selectCartState],
  (cart) => cart.cartItems,
);

export const selectIsCartOpen = createSelector(
  [selectCartState],
  (cart) => cart.isCartOpen,
);

export const selectCartNotices = createSelector(
  [selectCartState],
  (cart) => cart.cartNotices,
);

export const selectShippingOption = createSelector(
  [selectCartState],
  (cart) => cart.shippingOption,
);

export const selectCatalogBundleOffersByProductId = createSelector(
  [selectCartState],
  (cart) => cart.catalogBundleOffersByProductId,
);

export const selectLastBundleSyncSnapshot = createSelector(
  [selectCartState],
  (cart) => cart.lastBundleSyncSnapshot,
);

export const selectItemCount = createSelector([selectCartItems], (cartItems) =>
  cartItems.reduce((sum, item) => sum + item.quantity, 0),
);

export const selectSelectedCartItems = createSelector([selectCartItems], (cartItems) =>
  cartItems.filter((item) => item.selected),
);

export const selectSelectedItemCount = createSelector(
  [selectSelectedCartItems],
  (selectedCartItems) =>
    selectedCartItems.reduce((sum, item) => sum + item.quantity, 0),
);

function resolveOffersForProduct(
  productId: string,
  selectedCartItems: ReturnType<typeof selectSelectedCartItems>,
  catalogBundleOffersByProductId: ReturnType<typeof selectCatalogBundleOffersByProductId>,
): BundleOfferLite[] {
  const catalogOffers = catalogBundleOffersByProductId[productId];
  if (catalogOffers && catalogOffers.length > 0) return catalogOffers;

  const fallbackItems = selectedCartItems.filter(
    (item) => (item.detailId ?? item.id) === productId,
  );
  const fallbackItem = fallbackItems[0];
  if (!fallbackItem) return [];

  const fallbackOffers = (fallbackItem.bundleOffers ?? []).map((offer) => ({
    id: offer.id,
    title: offer.title,
    minTotalQty: offer.minTotalQty,
    discountPercent: offer.discountPercent,
    variantIds: offer.variantIds,
    isActive: offer.isActive,
  }));

  if (fallbackOffers.length > 0) return fallbackOffers;
  if (
    fallbackItem.hasActiveBundleOffer &&
    typeof fallbackItem.bundleMinTotalQty === 'number' &&
    typeof fallbackItem.bundleDiscountPercent === 'number'
  ) {
    const variantIds = [
      ...new Set(
        fallbackItems
          .map((item) => item.variantId)
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    return [
      {
        id: `product-summary:${productId}`,
        title:
          fallbackItem.bundleDisplayText ||
          `Buy Min ${fallbackItem.bundleMinTotalQty} get ${fallbackItem.bundleDiscountPercent}% OFF`,
        minTotalQty: fallbackItem.bundleMinTotalQty,
        discountPercent: fallbackItem.bundleDiscountPercent,
        variantIds,
        isActive: true,
      },
    ];
  }

  return [];
}

export const selectPricing = createSelector(
  [selectSelectedCartItems, selectCatalogBundleOffersByProductId],
  (selectedCartItems, catalogBundleOffersByProductId) =>
    computeCartPricing(
      selectedCartItems.map((item) => ({
        id: item.id,
        productId: item.detailId ?? item.id,
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice: item.salePrice ?? item.price,
      })),
      (productId) =>
        resolveOffersForProduct(
          productId,
          selectedCartItems,
          catalogBundleOffersByProductId,
        ),
    ),
);
