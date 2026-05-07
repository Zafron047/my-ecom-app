import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { BundleOfferLite } from '@/lib/bundle-types';

export type CartProduct = {
  id: string;
  detailId?: string;
  variantId?: string;
  variantLabel?: string;
  name: string;
  price: number;
  salePrice?: number;
  image: string;
  hasActiveBundleOffer?: boolean;
  bundleMinTotalQty?: number;
  bundleDiscountPercent?: number;
  bundleDisplayText?: string;
  bundleOffers?: BundleOfferLite[];
};

export type CartItem = CartProduct & {
  quantity: number;
  selected: boolean;
};

export type CartNotice = {
  id: string;
  name: string;
  image: string;
};

export type ShippingOption =
  | 'dhaka-city'
  | 'dhaka-division'
  | 'outside-dhaka-division';

export type CartState = {
  cartItems: CartItem[];
  isCartOpen: boolean;
  cartNotices: CartNotice[];
  shippingOption: ShippingOption;
  hasHydrated: boolean;
  catalogBundleOffersByProductId: Record<string, BundleOfferLite[]>;
  lastBundleSyncSnapshot: {
    syncedAtIso: string;
    productCount: number;
    bundleProductCount: number;
    bundlesByProductId: Record<
      string,
      { id: string; minTotalQty: number; discountPercent: number; isActive: boolean }[]
    >;
  } | null;
};

const initialState: CartState = {
  cartItems: [],
  isCartOpen: false,
  cartNotices: [],
  shippingOption: 'dhaka-city',
  hasHydrated: false,
  catalogBundleOffersByProductId: {},
  lastBundleSyncSnapshot: null,
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    setCartItems(state, action: PayloadAction<CartItem[]>) {
      state.cartItems = action.payload;
    },
    setHasHydrated(state, action: PayloadAction<boolean>) {
      state.hasHydrated = action.payload;
    },
    setShippingOption(state, action: PayloadAction<ShippingOption>) {
      state.shippingOption = action.payload;
    },
    setCatalogBundleOffersByProductId(
      state,
      action: PayloadAction<Record<string, BundleOfferLite[]>>,
    ) {
      state.catalogBundleOffersByProductId = action.payload;
    },
    setLastBundleSyncSnapshot(
      state,
      action: PayloadAction<CartState['lastBundleSyncSnapshot']>,
    ) {
      state.lastBundleSyncSnapshot = action.payload;
    },
    setCartOpen(state, action: PayloadAction<boolean>) {
      state.isCartOpen = action.payload;
    },
    toggleCart(state) {
      state.isCartOpen = !state.isCartOpen;
    },
    pushCartNotice(state, action: PayloadAction<CartNotice>) {
      state.cartNotices.push(action.payload);
    },
    removeCartNoticeById(state, action: PayloadAction<string>) {
      state.cartNotices = state.cartNotices.filter(
        (notice) => notice.id !== action.payload,
      );
    },
  },
});

export const cartActions = cartSlice.actions;
export const cartReducer = cartSlice.reducer;
