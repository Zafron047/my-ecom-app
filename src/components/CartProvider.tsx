'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

type CartProduct = {
  id: string;
  detailId?: string;
  name: string;
  price: number;
  salePrice?: number;
  image: string;
};

export type CartItem = CartProduct & {
  quantity: number;
  selected: boolean;
};

type CartNotice = {
  id: string;
  name: string;
  image: string;
};

export type ShippingOption =
  | 'dhaka-city'
  | 'dhaka-division'
  | 'outside-dhaka-division';

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
  cartNotices: CartNotice[];
  shippingOption: ShippingOption;
  itemCount: number;
  selectedItemCount: number;
  subtotal: number;
  shipping: number;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  addToCart: (product: CartProduct, quantity?: number) => void;
  setShippingOption: (option: ShippingOption) => void;
  toggleItemSelection: (productId: string) => void;
  setItemSelection: (productId: string, selected: boolean) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearSelectedItems: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = 'shop-easy-cart';
const SHIPPING_STORAGE_KEY = 'shop-easy-shipping-option';
const LEGACY_STORAGE_KEYS: string[] = [];
const LEGACY_SHIPPING_STORAGE_KEYS: string[] = [];

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartNotices, setCartNotices] = useState<CartNotice[]>([]);
  const [shippingOption, setShippingOption] =
    useState<ShippingOption>('dhaka-city');
  const [hasHydrated, setHasHydrated] = useState(false);
  const hasSanitizedCartRef = useRef(false);

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

        setCartItems(
          parsedCart.map((item) => ({
            ...item,
            selected: item.selected ?? true,
          })),
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
        setShippingOption(storedShippingOption);

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
      setHasHydrated(true);
    }
  }, []);

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
    if (hasSanitizedCartRef.current) return;
    hasSanitizedCartRef.current = true;

    let isMounted = true;

    async function sanitizeCartItems() {
      try {
        const response = await fetch('/api/storefront/catalog');
        if (!response.ok) return;

        const payload = (await response.json()) as {
          products?: Array<{
            id: string;
            image: string;
            name: string;
            price: number;
            salePrice?: number;
          }>;
        };

        if (!isMounted || !payload.products) return;

        const productById = new Map(
          payload.products.map((product) => [product.id, product]),
        );

        setCartItems((currentItems) => {
          const nextItems: CartItem[] = [];

          for (const item of currentItems) {
            const product = productById.get(item.id);
            if (!product) continue;

            nextItems.push({
              ...item,
              detailId: product.id,
              id: product.id,
              image: product.image,
              name: product.name,
              price: product.price,
              salePrice: product.salePrice,
            });
          }

          const unchanged =
            nextItems.length === currentItems.length &&
            nextItems.every((item, index) => {
              const currentItem = currentItems[index];
              return (
                currentItem &&
                item.id === currentItem.id &&
                item.name === currentItem.name &&
                item.price === currentItem.price &&
                item.salePrice === currentItem.salePrice &&
                item.image === currentItem.image &&
                item.quantity === currentItem.quantity &&
                item.selected === currentItem.selected
              );
            });

          return unchanged ? currentItems : nextItems;
        });
      } catch {
        // Keep current cart state if catalog sync fails.
      }
    }

    void sanitizeCartItems();

    return () => {
      isMounted = false;
    };
  }, [hasHydrated]);

  const itemCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems],
  );

  const selectedCartItems = useMemo(
    () => cartItems.filter((item) => item.selected),
    [cartItems],
  );

  const selectedItemCount = useMemo(
    () => selectedCartItems.reduce((sum, item) => sum + item.quantity, 0),
    [selectedCartItems],
  );

  const subtotal = useMemo(
    () =>
      selectedCartItems.reduce((sum, item) => {
        const unitPrice = item.salePrice ?? item.price;
        return sum + unitPrice * item.quantity;
      }, 0),
    [selectedCartItems],
  );

  const shipping = selectedItemCount > 0 ? shippingOptions[shippingOption].charge : 0;

  function openCart() {
    setIsCartOpen(true);
  }

  function closeCart() {
    setIsCartOpen(false);
  }

  function toggleCart() {
    setIsCartOpen((open) => !open);
  }

  function addToCart(product: CartProduct, quantity = 1) {
    const normalizedId = product.detailId ?? product.id;
    const nextNotice = {
      id: `${normalizedId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: product.name,
      image: product.image,
    };

    setCartNotices((currentNotices) => [...currentNotices, nextNotice]);

    window.setTimeout(() => {
      setCartNotices((currentNotices) =>
        currentNotices.filter((notice) => notice.id !== nextNotice.id),
      );
    }, 2200);

    setCartItems((currentItems) => {
      const existingItem = currentItems.find((item) => item.id === normalizedId);

      if (existingItem) {
        return currentItems.map((item) =>
          item.id === normalizedId
            ? { ...item, quantity: item.quantity + quantity }
            : item,
        );
      }

      return [
        ...currentItems,
        {
          ...product,
          id: normalizedId,
          detailId: normalizedId,
          quantity,
          selected: true,
        },
      ];
    });
  }

  function toggleItemSelection(productId: string) {
    setCartItems((currentItems) =>
      currentItems.map((item) =>
        item.id === productId ? { ...item, selected: !item.selected } : item,
      ),
    );
  }

  function setItemSelection(productId: string, selected: boolean) {
    setCartItems((currentItems) =>
      currentItems.map((item) =>
        item.id === productId ? { ...item, selected } : item,
      ),
    );
  }

  function updateQuantity(productId: string, quantity: number) {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCartItems((currentItems) =>
      currentItems.map((item) =>
        item.id === productId ? { ...item, quantity } : item,
      ),
    );
  }

  function removeFromCart(productId: string) {
    setCartItems((currentItems) =>
      currentItems.filter((item) => item.id !== productId),
    );
  }

  function clearSelectedItems() {
    setCartItems((currentItems) =>
      currentItems.filter((item) => !item.selected),
    );
  }

  const value = {
    cartItems,
    selectedCartItems,
    isCartOpen,
    cartNotices,
    shippingOption,
    itemCount,
    selectedItemCount,
    subtotal,
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

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }

  return context;
}
