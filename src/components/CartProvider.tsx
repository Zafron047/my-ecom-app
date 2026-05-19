'use client';

import { Provider, useDispatch, useSelector } from 'react-redux';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
import { fetchStorefrontCatalogClient } from '@/lib/storefront-catalog-client';

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
  cartPricingError: string;
  shipping: number;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  addToCart: (product: CartProduct, quantity?: number) => void;
  setShippingOption: (option: ShippingOption) => void;
  toggleItemSelection: (lineId: string) => void;
  setItemSelection: (lineId: string, selected: boolean) => void;
  setItemsSelection: (lineIds: string[], selected: boolean) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  removeFromCart: (lineId: string) => void;
  clearSelectedItems: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = 'shop-easy-cart';
const SHIPPING_STORAGE_KEY = 'shop-easy-shipping-option';
export const ABANDONED_CHECKOUT_SESSION_KEY = 'shop-easy-abandoned-checkout-session';
const LEGACY_STORAGE_KEYS: string[] = [];
const LEGACY_SHIPPING_STORAGE_KEYS: string[] = [];

function getAbandonedCheckoutSessionId() {
  const existing = window.localStorage.getItem(ABANDONED_CHECKOUT_SESSION_KEY);
  if (existing) return existing;

  const sessionId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  window.localStorage.setItem(ABANDONED_CHECKOUT_SESSION_KEY, sessionId);
  return sessionId;
}

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

    const syncTimer = window.setTimeout(() => {
      const sessionId = getAbandonedCheckoutSessionId();
      void fetch('/api/cart/abandoned-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          sessionId,
          items: cartItems,
        }),
      }).catch(() => {
        // Abandoned checkout tracking must never block cart UX.
      });
    }, 500);

    return () => {
      window.clearTimeout(syncTimer);
    };
  }, [cartItems, hasHydrated]);

  useEffect(() => {
    if (!hasHydrated) return;
    window.localStorage.setItem(SHIPPING_STORAGE_KEY, shippingOption);
  }, [hasHydrated, shippingOption]);

  useEffect(() => {
    if (!hasHydrated) return;
    if (cartItems.length === 0) return;

    let isMounted = true;

    async function syncCatalogAndCartFromServer() {
      try {
        const payload = await fetchStorefrontCatalogClient();
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
          if (!matchedVariant) continue;
          if (matchedVariant.stockQuantity <= 0) continue;
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
            stockQuantity: matchedVariant.stockQuantity,
            quantity: Math.min(item.quantity, matchedVariant.stockQuantity),
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
              item.stockQuantity === currentItem.stockQuantity &&
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
      <CartStateSync>
        <CartRuntimeProvider>{children}</CartRuntimeProvider>
      </CartStateSync>
    </Provider>
  );
}

function CartRuntimeProvider({ children }: { children: React.ReactNode }) {
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
  const [cartPricingError, setCartPricingError] = useState('');
  const authoritativePricingSignatureRef = useRef<string | null>(null);
  const lastBundleSyncSnapshot = useSelector(selectLastBundleSyncSnapshot);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    (
      window as typeof window & {
        __LAST_BUNDLE_SYNC_SNAPSHOT__?: unknown;
      }
    ).__LAST_BUNDLE_SYNC_SNAPSHOT__ = lastBundleSyncSnapshot;
  }, [lastBundleSyncSnapshot]);

  const selectedCartPricingSignature = JSON.stringify(
    selectedCartItems.map((item) => ({
      id: item.id,
      detailId: item.detailId,
      variantId: item.variantId,
      quantity: item.quantity,
    })),
  );

  useEffect(() => {
    const requestPayload = JSON.parse(selectedCartPricingSignature) as {
      id: string;
      detailId?: string;
      variantId?: string;
      quantity: number;
    }[];

    if (requestPayload.length === 0) {
      const hasEmptyPricing =
        serverPricing !== null &&
        Object.keys(serverPricing.linePricingById).length === 0 &&
        serverPricing.subtotalBeforeDiscount === 0 &&
        serverPricing.discountTotal === 0 &&
        serverPricing.subtotal === 0;

      authoritativePricingSignatureRef.current = selectedCartPricingSignature;
      if (!hasEmptyPricing) {
        setServerPricing({
          linePricingById: {},
          subtotalBeforeDiscount: 0,
          discountTotal: 0,
          subtotal: 0,
        });
      }
      setIsPricingAuthoritative(true);
      setCartPricingError('');
      return;
    }

    if (!isCartOpen) {
      return;
    }

    const hasCompletePricingForRequest =
      serverPricing !== null &&
      requestPayload.every((item) =>
        Object.hasOwn(serverPricing.linePricingById, item.id),
      );

    if (
      authoritativePricingSignatureRef.current === selectedCartPricingSignature &&
      hasCompletePricingForRequest
    ) {
      setIsPricingAuthoritative(true);
      return;
    }

    const retries = [0, 200, 600, 1200];
    let activeTimer: number | null = null;
    let disposed = false;
    const controllers = new Set<AbortController>();
    const body = JSON.stringify({ items: requestPayload });

    const runPricingFetch = async (markPending: boolean): Promise<void> => {
      if (disposed) return;
      if (markPending) {
        setIsPricingAuthoritative(false);
        setCartPricingError('');
      }

      const attempt = async (attemptIndex: number): Promise<void> => {
        const controller = new AbortController();
        controllers.add(controller);
        try {
          const response = await fetch('/api/cart/price', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
            signal: controller.signal,
          });
          if (!response.ok) {
            const errorPayload = (await response.json().catch(() => null)) as
              | { error?: string }
              | null;
            throw new Error(errorPayload?.error || `HTTP ${response.status}`);
          }
          const payload = (await response.json()) as CartPricingResult;
          if (disposed) return;
          const hasPricingForEveryRequestedLine = requestPayload.every((item) =>
            Object.hasOwn(payload.linePricingById, item.id),
          );
          if (!hasPricingForEveryRequestedLine) {
            throw new Error(
              'One or more cart items are no longer active or in stock. Please remove unavailable items and add them again.',
            );
          }
          authoritativePricingSignatureRef.current = selectedCartPricingSignature;
          setServerPricing(payload);
          setIsPricingAuthoritative(true);
          setCartPricingError('');
        } catch (error) {
          if (disposed || controller.signal.aborted) return;
          if (attemptIndex < retries.length - 1) {
            activeTimer = window.setTimeout(() => {
              void attempt(attemptIndex + 1);
            }, retries[attemptIndex + 1]);
            return;
          }
          setIsPricingAuthoritative(false);
          setCartPricingError(
            error instanceof Error && error.message
              ? error.message
              : 'One or more cart items are no longer active or in stock. Please remove unavailable items and add them again.',
          );
        } finally {
          controllers.delete(controller);
        }
      };

      void attempt(0);
    };

    activeTimer = window.setTimeout(() => {
      void runPricingFetch(true);
    }, 120);

    const handleOnline = () => {
      void runPricingFetch(true);
    };
    window.addEventListener('online', handleOnline);

    return () => {
      disposed = true;
      window.removeEventListener('online', handleOnline);
      for (const controller of controllers) {
        controller.abort();
      }
      if (activeTimer !== null) {
        window.clearTimeout(activeTimer);
      }
    };
  }, [isCartOpen, selectedCartPricingSignature, serverPricing]);

  const localPricingFallback = useMemo<CartPricingResult>(() => {
    const linePricingById = Object.fromEntries(
      selectedCartItems.map((item) => {
        const lineSubtotal = (item.salePrice ?? item.price) * item.quantity;
        return [
          item.id,
          {
            lineSubtotal,
            lineDiscount: 0,
            lineTotal: lineSubtotal,
          },
        ];
      }),
    );
    const subtotal = selectedCartItems.reduce(
      (sum, item) => sum + (item.salePrice ?? item.price) * item.quantity,
      0,
    );
    return {
      linePricingById,
      subtotalBeforeDiscount: subtotal,
      discountTotal: 0,
      subtotal,
    };
  }, [selectedCartItems]);

  const hasCompleteServerLinePricing =
    serverPricing !== null &&
    selectedCartItems.every((item) =>
      Object.hasOwn(serverPricing.linePricingById, item.id),
    );
  const hasServerPricingForCurrentSelection =
    serverPricing !== null &&
    authoritativePricingSignatureRef.current === selectedCartPricingSignature &&
    hasCompleteServerLinePricing;
  const effectivePricing = hasServerPricingForCurrentSelection
    ? serverPricing
    : localPricingFallback;
  const linePricingById = effectivePricing.linePricingById;
  const subtotalBeforeDiscount = effectivePricing.subtotalBeforeDiscount;
  const discountTotal = effectivePricing.discountTotal;
  const subtotal = effectivePricing.subtotal;
  const isCurrentPricingAuthoritative =
    isPricingAuthoritative && hasServerPricingForCurrentSelection;
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
    if (typeof product.stockQuantity === 'number' && product.stockQuantity <= 0) {
      return;
    }
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
      const nextQuantity =
        typeof product.stockQuantity === 'number'
          ? Math.min(existingItem.quantity + quantity, product.stockQuantity)
          : existingItem.quantity + quantity;
      setCartItems(
        cartItems.map((item) =>
          item.id === normalizedId
            ? {
                ...item,
                quantity: nextQuantity,
                detailId: productId,
                variantId: product.variantId ?? item.variantId,
                variantLabel: product.variantLabel ?? item.variantLabel,
                image: product.image || item.image,
                price: product.price,
                salePrice: product.salePrice,
                stockQuantity: product.stockQuantity ?? item.stockQuantity,
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
        quantity:
          typeof product.stockQuantity === 'number'
            ? Math.min(quantity, product.stockQuantity)
            : quantity,
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

  function setItemsSelection(lineIds: string[], selected: boolean) {
    const lineIdSet = new Set(lineIds);
    setCartItems(
      cartItems.map((item) =>
        lineIdSet.has(item.id) ? { ...item, selected } : item,
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
        item.id === lineId
          ? {
              ...item,
              quantity:
                typeof item.stockQuantity === 'number'
                  ? Math.min(quantity, item.stockQuantity)
                  : quantity,
            }
          : item,
      ),
    );
  }

  function removeFromCart(lineId: string) {
    setCartItems(cartItems.filter((item) => item.id !== lineId));
  }

  function clearSelectedItems() {
    setCartItems(cartItems.filter((item) => !item.selected));
  }

  const value = {
    cartItems,
    selectedCartItems,
    isCartOpen,
    cartNotices,
    shippingOption,
    itemCount,
    selectedItemCount,
    isPricingAuthoritative: isCurrentPricingAuthoritative,
    subtotalBeforeDiscount,
    discountTotal,
    subtotal,
    linePricingById,
    cartPricingError,
    shipping,
    openCart,
    closeCart,
    toggleCart,
    addToCart,
    setShippingOption,
    toggleItemSelection,
    setItemSelection,
    setItemsSelection,
    updateQuantity,
    removeFromCart,
    clearSelectedItems,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const value = useContext(CartContext);
  if (!value) {
    throw new Error('useCart must be used inside CartProvider.');
  }
  return value;
}
