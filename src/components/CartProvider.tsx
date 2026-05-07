'use client';

import { Provider, useDispatch, useSelector } from 'react-redux';
import { useEffect, useRef, useState } from 'react';
import { type CartLinePricing } from '@/lib/cart-bundle-pricing';
import { cartActions, type CartItem, type CartProduct, type ShippingOption } from '@/store/cartSlice';
import { store, type AppDispatch, type RootState } from '@/store/store';
import {
  selectCartItems,
  selectIsCartOpen,
  selectCartNotices,
  selectItemCount,
  selectSelectedCartItems,
  selectSelectedItemCount,
  selectShippingOption,
  selectLastBundleSyncSnapshot,
} from '@/store/cartSelectors';
import { type CartPricingResult } from '@/lib/cart-bundle-pricing';

export type { CartItem } from '@/store/cartSlice';

export const shippingOptions: Record<
  ShippingOption,
  { label: string; charge: number }
> = {
  'dhaka-city': {
    label: 'Inside Dhaka City',
    charge: 80,
  },
  'dhaka-division': {
    label: 'Inside Dhaka Division',
    charge: 120,
  },
  'outside-dhaka-division': {
    label: 'Outside Dhaka Division',
    charge: 150,
  },
};

type CartContextValue = {
  cartItems: CartItem[];
  selectedCartItems: CartItem[];
  isCartOpen: boolean;
  cartNotices: { id: string; name: string; image: string }[];
  shippingOption: ShippingOption;
  itemCount: number;
  selectedItemCount: number;
  isPricingAuthoritative: boolean;
  subtotalBeforeDiscount: number;
  discountTotal: number;
  subtotal: number;
  linePricingById: Record<string, CartLinePricing>;
  shipping: number;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  addToCart: (product: CartProduct, quantity?: number) => void;
  setShippingOption: (option: ShippingOption) => void;
  toggleItemSelection: (lineId: string) => void;
  setItemSelection: (lineId: string, selected: boolean) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  removeFromCart: (lineId: string) => void;
  clearSelectedItems: () => void;
};

const STORAGE_KEY = 'shop-easy-cart';
const SHIPPING_STORAGE_KEY = 'shop-easy-shipping-option';
const LEGACY_STORAGE_KEYS: string[] = [];
const LEGACY_SHIPPING_STORAGE_KEYS: string[] = [];

function CartStateSync({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch<AppDispatch>();
  const hasSanitizedCartRef = useRef(false);
  const { cartItems, hasHydrated, shippingOption } = useSelector(
    (state: RootState) => state.cart,
  );

  useEffect(() => {
    try {
      const storedCart =
        window.localStorage.getItem(STORAGE_KEY) ??
        LEGACY_STORAGE_KEYS.map((key) => window.localStorage.getItem(key)).find(
          (value) => value !== null,
        ) ??
        null;

      if (storedCart) {
        const parsedCart = JSON.parse(storedCart) as Array<
          CartItem & { selected?: boolean }
        >;

        dispatch(
          cartActions.setCartItems(
            parsedCart.map((item) => ({
              ...item,
              selected: item.selected ?? true,
            })),
          ),
        );

        if (!window.localStorage.getItem(STORAGE_KEY)) {
          window.localStorage.setItem(STORAGE_KEY, storedCart);
        }
      }

      const storedShippingOption =
        (window.localStorage.getItem(SHIPPING_STORAGE_KEY) ??
          LEGACY_SHIPPING_STORAGE_KEYS.map((key) =>
            window.localStorage.getItem(key),
          ).find((value) => value !== null)) as ShippingOption | null;

      if (
        storedShippingOption &&
        Object.hasOwn(shippingOptions, storedShippingOption)
      ) {
        dispatch(cartActions.setShippingOption(storedShippingOption));

        if (!window.localStorage.getItem(SHIPPING_STORAGE_KEY)) {
          window.localStorage.setItem(
            SHIPPING_STORAGE_KEY,
            storedShippingOption,
          );
        }
      }
    } catch {
      // Ignore invalid local cart state and start fresh.
    } finally {
      dispatch(cartActions.setHasHydrated(true));
    }
  }, [dispatch]);

  useEffect(() => {
    if (!hasHydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cartItems));
  }, [cartItems, hasHydrated]);

  useEffect(() => {
    if (!hasHydrated) return;
    window.localStorage.setItem(SHIPPING_STORAGE_KEY, shippingOption);
  }, [hasHydrated, shippingOption]);

  useEffect(() => {
    if (!hasHydrated) return;

    let isMounted = true;

    async function syncCatalogAndCartFromServer() {
      try {
        const response = await fetch('/api/storefront/catalog', { cache: 'no-store' });
        if (!response.ok) return;

        const payload = (await response.json()) as {
          products?: Array<{
            id: string;
            image: string;
            name: string;
            price: number;
            salePrice?: number;
            variants?: Array<{ id: string; price: number; salePrice?: number; color?: string; size?: string }>;
            hasActiveBundleOffer?: boolean;
            bundleMinTotalQty?: number;
            bundleDiscountPercent?: number;
            bundleDisplayText?: string;
            bundleOffers?: CartProduct['bundleOffers'];
          }>;
        };
        if (!isMounted || !payload.products) return;

        const productById = new Map(payload.products.map((product) => [product.id, product]));
        const bundleMap: RootState['cart']['catalogBundleOffersByProductId'] = {};
        payload.products.forEach((product) => {
          bundleMap[product.id] = product.bundleOffers ?? [];
        });
        dispatch(cartActions.setCatalogBundleOffersByProductId(bundleMap));
        dispatch(
          cartActions.setLastBundleSyncSnapshot({
            syncedAtIso: new Date().toISOString(),
            productCount: payload.products.length,
            bundleProductCount: payload.products.filter(
              (product) => (product.bundleOffers?.length ?? 0) > 0,
            ).length,
            bundlesByProductId: Object.fromEntries(
              Object.entries(bundleMap)
                .filter(([, offers]) => offers.length > 0)
                .map(([productId, offers]) => [
                  productId,
                  offers.map((offer) => ({
                    id: offer.id,
                    minTotalQty: offer.minTotalQty,
                    discountPercent: offer.discountPercent,
                    isActive: offer.isActive,
                  })),
                ]),
            ),
          }),
        );

        const nextItems: CartItem[] = [];
        const inferVariantId = (
          item: CartItem,
          product: NonNullable<(typeof payload.products)>[number],
        ) => {
          const parsedVariantIdFromLine =
            item.variantId ||
            (item.id.includes('::') ? item.id.split('::')[1] : undefined);
          if (parsedVariantIdFromLine) return parsedVariantIdFromLine;
          if (product.variants?.length === 1) return product.variants[0]?.id;
          return undefined;
        };

        for (const item of cartItems) {
          const productLookupId = item.detailId ?? item.id.split('::')[0] ?? item.id;
          const product = productById.get(productLookupId);
          if (!product) continue;

          const parsedVariantId = inferVariantId(item, product);
          const matchedVariant = product.variants?.find(
            (variant) => variant.id === parsedVariantId,
          );
          // Guard against transient catalog/variant mismatch during admin edits:
          // if variant cannot be resolved, preserve existing line identity and price.
          const syncedPrice = matchedVariant?.price ?? item.price;
          const syncedSalePrice = matchedVariant?.salePrice ?? item.salePrice;
          const normalizedLineId =
            matchedVariant?.id ? `${product.id}::${matchedVariant.id}` : item.id;
          nextItems.push({
            ...item,
            id: normalizedLineId,
            detailId: product.id,
            variantId: parsedVariantId,
            image: product.image,
            name: product.name,
            price: syncedPrice,
            salePrice: syncedSalePrice,
            hasActiveBundleOffer: product.hasActiveBundleOffer,
            bundleMinTotalQty: product.bundleMinTotalQty,
            bundleDiscountPercent: product.bundleDiscountPercent,
            bundleDisplayText: product.bundleDisplayText,
            bundleOffers: product.bundleOffers ?? [],
          });
        }

        const mergedById = new Map<string, CartItem>();
        for (const item of nextItems) {
          const existing = mergedById.get(item.id);
          if (!existing) {
            mergedById.set(item.id, item);
            continue;
          }
          mergedById.set(item.id, {
            ...existing,
            quantity: existing.quantity + item.quantity,
            selected: existing.selected || item.selected,
          });
        }
        const mergedItems = [...mergedById.values()];
        const unchanged =
          mergedItems.length === cartItems.length &&
          mergedItems.every((item, index) => {
            const currentItem = cartItems[index];
            return (
              currentItem &&
              item.id === currentItem.id &&
              item.detailId === currentItem.detailId &&
              item.variantId === currentItem.variantId &&
              item.name === currentItem.name &&
              item.price === currentItem.price &&
              item.salePrice === currentItem.salePrice &&
              item.image === currentItem.image &&
              item.quantity === currentItem.quantity &&
              item.selected === currentItem.selected &&
              item.bundleMinTotalQty === currentItem.bundleMinTotalQty &&
              item.bundleDiscountPercent === currentItem.bundleDiscountPercent &&
              item.bundleDisplayText === currentItem.bundleDisplayText &&
              JSON.stringify(item.bundleOffers ?? []) ===
                JSON.stringify(currentItem.bundleOffers ?? [])
            );
          });
        if (!unchanged) {
          dispatch(cartActions.setCartItems(mergedItems));
        }
      } catch {
        // Keep current cart state if catalog sync fails.
      }
    }

    if (!hasSanitizedCartRef.current) {
      hasSanitizedCartRef.current = true;
      void syncCatalogAndCartFromServer();
    }

    return () => {
      isMounted = false;
    };
  }, [cartItems, dispatch, hasHydrated]);

  return <>{children}</>;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <CartStateSync>{children}</CartStateSync>
    </Provider>
  );
}

export function useCart(): CartContextValue {
  const dispatch = useDispatch<AppDispatch>();
  const cartItems = useSelector(selectCartItems);
  const isCartOpen = useSelector(selectIsCartOpen);
  const cartNotices = useSelector(selectCartNotices);
  const shippingOption = useSelector(selectShippingOption);
  const itemCount = useSelector(selectItemCount);
  const selectedCartItems = useSelector(selectSelectedCartItems);
  const selectedItemCount = useSelector(selectSelectedItemCount);
  const [serverPricing, setServerPricing] = useState<CartPricingResult | null>(null);
  const [isPricingAuthoritative, setIsPricingAuthoritative] = useState(false);
  const lastBundleSyncSnapshot = useSelector(selectLastBundleSyncSnapshot);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    (
      window as typeof window & {
        __LAST_BUNDLE_SYNC_SNAPSHOT__?: unknown;
      }
    ).__LAST_BUNDLE_SYNC_SNAPSHOT__ = lastBundleSyncSnapshot;
  }, [lastBundleSyncSnapshot]);

  useEffect(() => {
    if (selectedCartItems.length === 0) {
      setServerPricing({
        linePricingById: {},
        subtotalBeforeDiscount: 0,
        discountTotal: 0,
        subtotal: 0,
      });
      setIsPricingAuthoritative(true);
      return;
    }

    const retries = [0, 200, 600, 1200];
    let activeTimer: number | null = null;
    let pollingTimer: number | null = null;
    let disposed = false;
    const controllers = new Set<AbortController>();
    const POLL_INTERVAL_MS = 20000;

    const requestPayload = {
      items: selectedCartItems.map((item) => ({
        id: item.id,
        detailId: item.detailId,
        variantId: item.variantId,
        quantity: item.quantity,
      })),
    };

    const runPricingFetch = async (markPending: boolean): Promise<void> => {
      if (disposed) return;
      if (markPending) setIsPricingAuthoritative(false);

      const attempt = async (attemptIndex: number): Promise<void> => {
        const controller = new AbortController();
        controllers.add(controller);
        try {
          const response = await fetch('/api/cart/price', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestPayload),
            signal: controller.signal,
          });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          const payload = (await response.json()) as CartPricingResult;
          if (disposed) return;
          setServerPricing(payload);
          setIsPricingAuthoritative(true);
        } catch {
          if (disposed || controller.signal.aborted) return;
          if (attemptIndex < retries.length - 1) {
            activeTimer = window.setTimeout(() => {
              void attempt(attemptIndex + 1);
            }, retries[attemptIndex + 1]);
            return;
          }
          setIsPricingAuthoritative(false);
        } finally {
          controllers.delete(controller);
        }
      };

      void attempt(0);
    };

    activeTimer = window.setTimeout(() => {
      void runPricingFetch(true);
    }, 120);

    const shouldPollNow = () =>
      isCartOpen && document.visibilityState === 'visible';

    if (shouldPollNow()) {
      pollingTimer = window.setInterval(() => {
        if (!shouldPollNow()) return;
        void runPricingFetch(false);
      }, POLL_INTERVAL_MS);
    }

    const handleOnline = () => {
      void runPricingFetch(true);
    };
    const handleVisibilityChange = () => {
      if (!shouldPollNow()) return;
      void runPricingFetch(true);
      if (pollingTimer !== null) return;
      pollingTimer = window.setInterval(() => {
        if (!shouldPollNow()) return;
        void runPricingFetch(false);
      }, POLL_INTERVAL_MS);
    };
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      disposed = true;
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      for (const controller of controllers) {
        controller.abort();
      }
      if (activeTimer !== null) {
        window.clearTimeout(activeTimer);
      }
      if (pollingTimer !== null) {
        window.clearInterval(pollingTimer);
      }
    };
  }, [isCartOpen, selectedCartItems]);

  const effectivePricing = serverPricing ?? {
    linePricingById: {},
    subtotalBeforeDiscount: 0,
    discountTotal: 0,
    subtotal: 0,
  };
  const linePricingById = effectivePricing.linePricingById;
  const subtotalBeforeDiscount = effectivePricing.subtotalBeforeDiscount;
  const discountTotal = effectivePricing.discountTotal;
  const subtotal = effectivePricing.subtotal;
  const shipping = selectedItemCount > 0 ? shippingOptions[shippingOption].charge : 0;

  function openCart() {
    dispatch(cartActions.setCartOpen(true));
  }

  function closeCart() {
    dispatch(cartActions.setCartOpen(false));
  }

  function toggleCart() {
    dispatch(cartActions.toggleCart());
  }

  function setCartItems(nextItems: CartItem[]) {
    dispatch(cartActions.setCartItems(nextItems));
  }

  function addToCart(product: CartProduct, quantity = 1) {
    const productId = product.detailId ?? product.id;
    const normalizedId = product.variantId ? `${productId}::${product.variantId}` : productId;
    const nextNotice = {
      id: `${normalizedId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: product.variantLabel ? `${product.name} (${product.variantLabel})` : product.name,
      image: product.image,
    };

    dispatch(cartActions.pushCartNotice(nextNotice));

    window.setTimeout(() => {
      dispatch(cartActions.removeCartNoticeById(nextNotice.id));
    }, 2200);

    const existingItem = cartItems.find((item) => item.id === normalizedId);
    if (existingItem) {
      setCartItems(
        cartItems.map((item) =>
          item.id === normalizedId
            ? {
                ...item,
                quantity: item.quantity + quantity,
                detailId: productId,
                variantId: product.variantId ?? item.variantId,
                variantLabel: product.variantLabel ?? item.variantLabel,
                image: product.image || item.image,
                price: product.price,
                salePrice: product.salePrice,
                bundleOffers: product.bundleOffers ?? item.bundleOffers ?? [],
              }
            : item,
        ),
      );
      return;
    }

    setCartItems([
      ...cartItems,
      {
        ...product,
        id: normalizedId,
        detailId: productId,
        quantity,
        selected: true,
      },
    ]);
  }

  function setShippingOption(option: ShippingOption) {
    dispatch(cartActions.setShippingOption(option));
  }

  function toggleItemSelection(lineId: string) {
    setCartItems(
      cartItems.map((item) =>
        item.id === lineId ? { ...item, selected: !item.selected } : item,
      ),
    );
  }

  function setItemSelection(lineId: string, selected: boolean) {
    setCartItems(
      cartItems.map((item) =>
        item.id === lineId ? { ...item, selected } : item,
      ),
    );
  }

  function updateQuantity(lineId: string, quantity: number) {
    if (quantity <= 0) {
      removeFromCart(lineId);
      return;
    }

    setCartItems(
      cartItems.map((item) =>
        item.id === lineId ? { ...item, quantity } : item,
      ),
    );
  }

  function removeFromCart(lineId: string) {
    setCartItems(cartItems.filter((item) => item.id !== lineId));
  }

  function clearSelectedItems() {
    setCartItems(cartItems.filter((item) => !item.selected));
  }

  return {
    cartItems,
    selectedCartItems,
    isCartOpen,
    cartNotices,
    shippingOption,
    itemCount,
    selectedItemCount,
    isPricingAuthoritative,
    subtotalBeforeDiscount,
    discountTotal,
    subtotal,
    linePricingById,
    shipping,
    openCart,
    closeCart,
    toggleCart,
    addToCart,
    setShippingOption,
    toggleItemSelection,
    setItemSelection,
    updateQuantity,
    removeFromCart,
    clearSelectedItems,
  };
}
