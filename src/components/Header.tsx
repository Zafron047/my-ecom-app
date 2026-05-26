'use client';

import {
  ABANDONED_CHECKOUT_SESSION_KEY,
  useCart,
} from '@/components/CartProvider';
import { CHECKOUT_PENDING_ORDER_KEY } from '@/lib/checkoutPendingOrder.mjs';
import { getGroupedAreaOptions, getGroupedDistrictOptions } from '@/lib/location-presenter';
import {
  META_PURCHASE_EVENT_STORAGE_PREFIX,
  trackMetaInitiateCheckout,
  trackMetaSearch,
} from '@/lib/meta-pixel';
import { getShippingCharge } from '@/lib/shipping-charge';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SearchableDropdown from '@/components/SearchableDropdown';
import { slugifyCategory } from '@/lib/category-slug';
import type { StorefrontBusinessProfile } from '@/lib/storefront-types';

const MOBILE_PATTERN = /^01[3-9]\d{8}$/;
const curatedCategoryFallbacks = [
  'Kitchen & Cooking',
  'Home Organization',
  'Decor & Accessories',
  'Smart Gadgets',
  'Bathroom Essentials',
  'Daily Essentials',
  'Cleaning Tools',
  'Storage Solutions',
];
const categoryDisplayLabels: Record<string, string> = {
  kitchen: 'Kitchen & Cooking',
  'kitchen & dining': 'Kitchen & Cooking',
  cooking: 'Kitchen & Cooking',
  organization: 'Home Organization',
  organiser: 'Home Organization',
  organizer: 'Home Organization',
  storage: 'Home Organization',
  decor: 'Decor & Accessories',
  decoration: 'Decor & Accessories',
  accessories: 'Decor & Accessories',
  gadget: 'Smart Gadgets',
  gadgets: 'Smart Gadgets',
  smart: 'Smart Gadgets',
  bathroom: 'Bathroom Essentials',
  bath: 'Bathroom Essentials',
  cleaning: 'Cleaning Tools',
};
const categoryPriority = [
  'Kitchen & Cooking',
  'Home Organization',
  'Decor & Accessories',
  'Smart Gadgets',
  'Bathroom Essentials',
  'Daily Essentials',
  'Cleaning Tools',
  'Storage Solutions',
];

function isPlaceholderCategory(value: string) {
  return /\b(test|demo|sample|placeholder|temp|temporary|dummy|uncategorized)\b/i.test(
    value,
  );
}

function polishCategoryLabel(value: string, index: number) {
  const normalized = value.trim().toLowerCase();

  if (!normalized || isPlaceholderCategory(value)) {
    return curatedCategoryFallbacks[index % curatedCategoryFallbacks.length];
  }

  const directLabel = categoryDisplayLabels[normalized];
  if (directLabel) return directLabel;

  const matchingLabel = Object.entries(categoryDisplayLabels).find(([keyword]) =>
    normalized.includes(keyword),
  )?.[1];

  return matchingLabel ?? value.trim();
}

function normalizeMobileInput(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('8801') && digits.length === 13) {
    return `0${digits.slice(3)}`;
  }
  return digits;
}

export default function Header({
  businessProfile,
  catalogCategories,
}: {
  businessProfile: StorefrontBusinessProfile;
  catalogCategories: string[];
}) {
  type CheckoutField =
    | 'firstName'
    | 'lastName'
    | 'email'
    | 'customerMobile'
    | 'receiverMobile'
    | 'division'
    | 'district'
    | 'thana'
    | 'address';

  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [isAllCategoryMenuOpen, setIsAllCategoryMenuOpen] = useState(false);
  const [isCustomerLoggedIn, setIsCustomerLoggedIn] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchableProducts, setSearchableProducts] = useState<
    { id: string; name: string; image: string; variantCount: number }[]
  >([]);
  const [hasRequestedSearchProducts, setHasRequestedSearchProducts] =
    useState(false);
  const {
    cartItems,
    isCartOpen,
    cartNotices,
    itemCount,
    selectedItemCount,
    selectedCartItems,
    isPricingAuthoritative,
    cartPricingError,
    subtotal,
    linePricingById,
    closeCart,
    toggleCart,
    setItemsSelection,
    updateQuantity,
    removeFromCart,
  } = useCart();
  const [isCheckoutView, setIsCheckoutView] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'bkash' | 'cod' | ''>('cod');
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [placeOrderError, setPlaceOrderError] = useState('');
  const [showFirstNameSplitHint, setShowFirstNameSplitHint] = useState(false);
  const [showLastNameOnlyHint, setShowLastNameOnlyHint] = useState(false);
  const [touchedFields, setTouchedFields] = useState<Record<CheckoutField, boolean>>({
    firstName: false,
    lastName: false,
    email: false,
    customerMobile: false,
    receiverMobile: false,
    division: false,
    district: false,
    thana: false,
    address: false,
  });
  const [checkoutForm, setCheckoutForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    customerMobile: '',
    receiverMobile: '',
    division: '',
    district: '',
    thana: '',
    address: '',
  });
  const [locationDistricts, setLocationDistricts] = useState<string[]>([]);
  const [locationAreas, setLocationAreas] = useState<string[]>([]);
  const desktopSearchRef = useRef<HTMLDivElement | null>(null);
  const mobileSearchRef = useRef<HTMLDivElement | null>(null);
  const lastAutofillPhoneRef = useRef<string>('');
  const metaInitiateCheckoutEventIdRef = useRef<string | null>(null);
  const [isCustomerLookupLoading, setIsCustomerLookupLoading] = useState(false);
  const firstNameHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const lastNameHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const shouldLoadCheckoutLocations = isCartOpen && isCheckoutView;

  const shippingCharge = useMemo(() => {
    return getShippingCharge({
      division: checkoutForm.division,
      district: checkoutForm.district,
      area: checkoutForm.thana,
    });
  }, [checkoutForm.district, checkoutForm.division, checkoutForm.thana]);

  const checkoutTotal = subtotal + shippingCharge;
  const completedFieldGlow =
    'border-emerald-400 bg-emerald-50/25 shadow-[0_0_0_3px_rgba(16,185,129,0.13)]';
  const invalidFieldGlow =
    'border-rose-400 shadow-[0_0_0_3px_rgba(244,63,94,0.14)] bg-rose-50/35';
  const checkoutFieldClass =
    'min-h-12 w-full rounded-2xl border bg-white px-4 py-3 text-sm font-medium text-zinc-800 outline-none transition duration-200 placeholder:text-zinc-400 focus:border-zinc-950 focus:shadow-[0_0_0_4px_rgba(24,24,27,0.08)]';
  const checkoutDropdownClass =
    'min-h-12 w-full rounded-2xl border bg-white px-4 py-3 pr-10 text-sm font-medium text-zinc-800 outline-none transition duration-200 focus:border-zinc-950 focus:shadow-[0_0_0_4px_rgba(24,24,27,0.08)] disabled:bg-zinc-50 disabled:text-zinc-400 disabled:cursor-not-allowed';
  const primaryCtaClass =
    'flex min-h-[3.25rem] w-full items-center justify-center rounded-2xl px-5 py-3.5 text-sm font-bold uppercase tracking-[0.12em] !text-white shadow-[0_14px_30px_rgba(24,24,27,0.18)] transition duration-200 focus:outline-none focus:ring-4 focus:ring-zinc-950/15 active:translate-y-px';
  const checkoutSteps = ['Cart', 'Checkout'];
  const activeCheckoutStep = isCheckoutView ? 1 : 0;
  const fieldSpringTransition = {
    type: 'spring',
    stiffness: 320,
    damping: 22,
    mass: 0.45,
  } as const;

  function isFieldFilled(value: string) {
    return value.trim().length > 0;
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const isEmailValid =
    checkoutForm.email.trim() === '' || emailPattern.test(checkoutForm.email);
  const isCustomerMobileValid = MOBILE_PATTERN.test(
    checkoutForm.customerMobile.trim(),
  );
  const isReceiverMobileValid =
    checkoutForm.receiverMobile.trim() === '' ||
    MOBILE_PATTERN.test(checkoutForm.receiverMobile.trim());
  const isReceiverDifferentFromCustomer =
    checkoutForm.receiverMobile.trim() === '' ||
    checkoutForm.receiverMobile.trim() !== checkoutForm.customerMobile.trim();

  const hasRequiredCheckoutFields =
    checkoutForm.firstName.trim() !== '' &&
    checkoutForm.customerMobile.trim() !== '' &&
    checkoutForm.district.trim() !== '' &&
    checkoutForm.thana.trim() !== '' &&
    checkoutForm.address.trim() !== '' &&
    paymentMethod !== '';

  const isCheckoutFormValid =
    hasRequiredCheckoutFields &&
    isEmailValid &&
    isCustomerMobileValid &&
    isReceiverMobileValid &&
    isReceiverDifferentFromCustomer;
  const canCheckoutWithAuthoritativePricing =
    isPricingAuthoritative && selectedItemCount > 0;

  const isFirstNameInvalid =
    touchedFields.firstName && checkoutForm.firstName.trim() === '';
  const isEmailInvalid = touchedFields.email && !isEmailValid;
  const isCustomerMobileInvalid =
    touchedFields.customerMobile &&
    (checkoutForm.customerMobile.trim() === '' || !isCustomerMobileValid);
  const isReceiverMobileInvalid =
    touchedFields.receiverMobile &&
    checkoutForm.receiverMobile.trim() !== '' &&
    (!isReceiverMobileValid || !isReceiverDifferentFromCustomer);
  const isDistrictInvalid =
    touchedFields.district && checkoutForm.district.trim() === '';
  const isThanaInvalid = touchedFields.thana && checkoutForm.thana.trim() === '';
  const isAddressInvalid =
    touchedFields.address && checkoutForm.address.trim() === '';
  const groupedAreaOptions = getGroupedAreaOptions(
    checkoutForm.division,
    checkoutForm.district,
    locationAreas,
  );
  const groupedDistrictOptions = getGroupedDistrictOptions(locationDistricts);

  const exploreLinks = [
    { href: '/', label: 'Home', description: 'Return to the storefront' },
    { href: '/products', label: 'Products', description: 'Browse every useful find' },
  ];
  const supportLinks = [
    { href: '/checkout', label: 'Cart', description: `${itemCount} item${itemCount === 1 ? '' : 's'}` },
    ...(isCustomerLoggedIn
      ? [
          { href: '/account', label: 'Account', description: 'Orders and profile' },
          { href: '#', label: 'Logout', description: 'Sign out safely' },
        ]
      : [{ href: '/login', label: 'Login', description: 'Sign in or create account' }]),
    { href: '#', label: 'Support', description: 'Help with your order' },
  ];
  const menuCategories = catalogCategories
    .filter((category) => category !== 'All')
    .map((category, index) => ({
      href: `/collections/${slugifyCategory(category)}`,
      label: polishCategoryLabel(category, index),
      rawName: category,
    }))
    .sort((first, second) => {
      const firstPriority = categoryPriority.indexOf(first.label);
      const secondPriority = categoryPriority.indexOf(second.label);

      if (firstPriority !== -1 || secondPriority !== -1) {
        return (
          (firstPriority === -1 ? Number.MAX_SAFE_INTEGER : firstPriority) -
          (secondPriority === -1 ? Number.MAX_SAFE_INTEGER : secondPriority)
        );
      }

      return first.label.localeCompare(second.label);
    });
  const featuredMenuCategories = menuCategories.slice(0, 4);
  const hiddenMenuCategories = menuCategories.slice(4);
  const searchPlaceholder =
    businessProfile.tagline || 'Search kitchen, decor and daily essentials';

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const searchSuggestions = normalizedQuery
    ? searchableProducts
        .filter((product) =>
          product.name.toLowerCase().includes(normalizedQuery),
        )
        .slice(0, 5)
    : [];

  const loadSearchProducts = useCallback(async () => {
    if (hasRequestedSearchProducts) return;
    setHasRequestedSearchProducts(true);

    try {
      const response = await fetch('/api/storefront/search');
      if (!response.ok) return;
      const payload = (await response.json()) as {
        products?: {
          id: string;
          name: string;
          image: string;
          variantCount: number;
        }[];
      };
      setSearchableProducts(payload.products ?? []);
    } catch {
      // Keep search suggestions empty when loading fails.
    }
  }, [hasRequestedSearchProducts]);

  const groupedCartItems = useMemo(() => {
    const groups = new Map<
      string,
      {
        productId: string;
        productName: string;
        productImage: string;
        lines: typeof cartItems;
        allSelected: boolean;
        subtotalBeforeDiscount: number;
        subtotalAfterDiscount: number;
        discount: number;
      }
    >();

    for (const item of cartItems) {
      const productId = item.detailId ?? item.id;
      const group = groups.get(productId) ?? {
        productId,
        productName: item.name,
        productImage: item.image,
        lines: [],
        allSelected: true,
        subtotalBeforeDiscount: 0,
        subtotalAfterDiscount: 0,
        discount: 0,
      };

      group.lines.push(item);
      if (item.selected) {
        const linePricing = linePricingById[item.id];
        const lineSubtotal =
          linePricing?.lineSubtotal ?? (item.salePrice ?? item.price) * item.quantity;
        const lineTotal = linePricing?.lineTotal ?? lineSubtotal;
        const lineDiscount = linePricing?.lineDiscount ?? 0;
        group.subtotalBeforeDiscount += lineSubtotal;
        group.subtotalAfterDiscount += lineTotal;
        group.discount += lineDiscount;
      } else {
        group.allSelected = false;
      }

      groups.set(productId, group);
    }

    return [...groups.values()];
  }, [cartItems, linePricingById]);

  useEffect(() => {
    setIsCustomerLoggedIn(document.cookie.includes('customer_auth=1'));
  }, []);

  useEffect(() => {
    const normalizedPhone = normalizeMobileInput(checkoutForm.customerMobile);

    if (!MOBILE_PATTERN.test(normalizedPhone)) return;
    if (lastAutofillPhoneRef.current === normalizedPhone) return;

    const timer = setTimeout(async () => {
      setIsCustomerLookupLoading(true);
      try {
        const query = new URLSearchParams({ phone: normalizedPhone });
        const response = await fetch(`/api/customers/by-phone?${query.toString()}`);
        if (!response.ok) return;
        const payload = (await response.json()) as {
          customer: {
            firstName: string;
            lastName: string | null;
            email: string | null;
            phone: string;
            division: string | null;
            district: string | null;
            thana: string | null;
            address: string | null;
          } | null;
        };
        if (!payload.customer) {
          lastAutofillPhoneRef.current = normalizedPhone;
          return;
        }
        setCheckoutForm((current) => ({
          ...current,
          customerMobile: current.customerMobile,
          firstName: payload.customer?.firstName ?? current.firstName,
          lastName: payload.customer?.lastName ?? current.lastName,
          email: payload.customer?.email ?? current.email,
          division: payload.customer?.division ?? current.division,
          district: payload.customer?.district ?? current.district,
          thana: payload.customer?.thana ?? current.thana,
          address: payload.customer?.address ?? current.address,
        }));
        lastAutofillPhoneRef.current = normalizedPhone;
      } catch {
        // silent fail: checkout still works manually.
      } finally {
        setIsCustomerLookupLoading(false);
      }
    }, 320);

    return () => {
      clearTimeout(timer);
    };
  }, [checkoutForm.customerMobile]);

  useEffect(() => {
    let isMounted = true;

    if (!shouldLoadCheckoutLocations) {
      return () => {
        isMounted = false;
      };
    }

    async function loadDistricts() {
      try {
        const response = await fetch('/api/delivery-locations?type=districts');
        if (!response.ok) return;
        const payload = (await response.json()) as { items: string[] };
        if (!isMounted) return;
        setLocationDistricts(payload.items ?? []);
      } catch {
        if (!isMounted) return;
        setLocationDistricts([]);
      }
    }

    void loadDistricts();

    return () => {
      isMounted = false;
    };
  }, [shouldLoadCheckoutLocations]);

  useEffect(() => {
    let isMounted = true;

    if (!shouldLoadCheckoutLocations || !checkoutForm.district) {
      setLocationAreas([]);
      return () => {
        isMounted = false;
      };
    }

    async function loadAreas() {
      try {
        const query = new URLSearchParams({
          type: 'areas',
          district: checkoutForm.district,
        });
        const response = await fetch(`/api/delivery-locations?${query.toString()}`);
        if (!response.ok) return;
        const payload = (await response.json()) as { items: string[] };
        if (!isMounted) return;
        setLocationAreas(payload.items ?? []);
      } catch {
        if (!isMounted) return;
        setLocationAreas([]);
      }
    }

    void loadAreas();

    return () => {
      isMounted = false;
    };
  }, [checkoutForm.district, shouldLoadCheckoutLocations]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      const clickedDesktop = desktopSearchRef.current?.contains(target);
      const clickedMobile = mobileSearchRef.current?.contains(target);

      if (!clickedDesktop && !clickedMobile) {
        setIsSearchOpen(false);
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    if (!isMenuOpen && !isCartOpen) {
      document.body.style.overflow = '';
      return;
    }

    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = '';
    };
  }, [isCartOpen, isMenuOpen]);

  useEffect(() => {
    return () => {
      if (firstNameHintTimerRef.current) {
        clearTimeout(firstNameHintTimerRef.current);
      }
      if (lastNameHintTimerRef.current) {
        clearTimeout(lastNameHintTimerRef.current);
      }
    };
  }, []);

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (normalizedQuery) {
      trackMetaSearch({
        search_string: searchQuery.trim(),
        content_ids: searchSuggestions.map((product) => product.id),
        contents: searchSuggestions.map((product) => ({ id: product.id })),
      });
    }

    const exactMatch = searchableProducts.find(
      (product) => product.name.toLowerCase() === normalizedQuery,
    );
    const firstSuggestion = searchSuggestions[0];
    const targetProduct = exactMatch ?? firstSuggestion;

    if (targetProduct) {
      setIsSearchOpen(false);
      router.push(`/products/${targetProduct.id}`);
      return;
    }

    router.push('/products');
  }

  function handleSuggestionSelect(productId: string, productName: string) {
    setSearchQuery(productName);
    setIsSearchOpen(false);
    trackMetaSearch({
      search_string: searchQuery.trim() || productName,
      content_ids: [productId],
      contents: [{ id: productId }],
    });
    router.push(`/products/${productId}`);
  }

  function handleMenuToggle() {
    if (!isMenuOpen) {
      handleCloseCart();
    } else {
      setIsAllCategoryMenuOpen(false);
    }

    setIsMenuOpen((open) => !open);
  }

  function handleCartToggle() {
    if (!isCartOpen) {
      setIsMenuOpen(false);
      setIsAllCategoryMenuOpen(false);
    } else {
      resetCheckoutView();
    }

    toggleCart();
  }

  function handleCloseCart() {
    resetCheckoutView();
    closeCart();
  }

  function handleCloseMenu() {
    setIsMenuOpen(false);
    setIsAllCategoryMenuOpen(false);
  }

  function handleProceedToCheckout() {
    if (!canCheckoutWithAuthoritativePricing) return;
    setIsCheckoutView(true);
    metaInitiateCheckoutEventIdRef.current = trackMetaInitiateCheckout(
      selectedCartItems,
      subtotal,
      { sendServer: false },
    );
  }

  function handleCheckoutInputChange(
    event: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) {
    const { name, value } = event.target;
    let normalizedValue = value.replace(/^\s+/, '');

    if (name === 'firstName' || name === 'lastName') {
      if (name === 'firstName' && /\s/.test(value)) {
        triggerFirstNameSplitHint();
      }
      if (name === 'lastName' && /\s/.test(value)) {
        triggerLastNameOnlyHint();
      }
      normalizedValue = normalizedValue.replace(/\s+/g, '');
    }

    setCheckoutForm((current) => ({
      ...current,
      [name]: normalizedValue,
      ...(name === 'district' && { division: '', thana: '' }),
    }));
  }

  function handleCheckoutFieldBlur(field: CheckoutField) {
    setTouchedFields((current) => ({
      ...current,
      [field]: true,
    }));
  }

  function handleCheckoutLocationSelect(
    field: 'district' | 'thana',
    value: string,
  ) {
    setCheckoutForm((current) => ({
      ...current,
      [field]: value,
      ...(field === 'district' && { division: '', thana: '' }),
    }));
  }

  function triggerFirstNameSplitHint() {
    setShowFirstNameSplitHint(true);
    if (firstNameHintTimerRef.current) {
      clearTimeout(firstNameHintTimerRef.current);
    }
    firstNameHintTimerRef.current = setTimeout(() => {
      setShowFirstNameSplitHint(false);
    }, 1800);
  }

  function triggerLastNameOnlyHint() {
    setShowLastNameOnlyHint(true);
    if (lastNameHintTimerRef.current) {
      clearTimeout(lastNameHintTimerRef.current);
    }
    lastNameHintTimerRef.current = setTimeout(() => {
      setShowLastNameOnlyHint(false);
    }, 1800);
  }

  function resetCheckoutView() {
    setIsCheckoutView(false);
    setPaymentMethod('cod');
    setShowFirstNameSplitHint(false);
    setShowLastNameOnlyHint(false);
    setTouchedFields({
      firstName: false,
      lastName: false,
      email: false,
      customerMobile: false,
      receiverMobile: false,
      division: false,
      district: false,
      thana: false,
      address: false,
    });
    setPlaceOrderError('');
  }

  async function handlePlaceOrder() {
    if (!canCheckoutWithAuthoritativePricing) {
      setPlaceOrderError('Pricing is unavailable. Please wait for server sync and try again.');
      return;
    }
    if (!isCheckoutFormValid) {
      setPlaceOrderError('Please complete all required fields correctly.');
      return;
    }
    if (isPlacingOrder) return;
    setPlaceOrderError('');

    const requestBody = {
      customer: {
        firstName: checkoutForm.firstName.trim(),
        lastName: checkoutForm.lastName.trim(),
        email: checkoutForm.email.trim(),
        customerMobile: checkoutForm.customerMobile.trim(),
        receiverMobile: checkoutForm.receiverMobile.trim(),
      },
      shipping: {
        division: checkoutForm.division.trim(),
        district: checkoutForm.district.trim(),
        thana: checkoutForm.thana.trim(),
        address: checkoutForm.address.trim(),
      },
      payment: {
        method: paymentMethod,
      },
      items: selectedCartItems,
      meta: {
        initiateCheckoutEventId: metaInitiateCheckoutEventIdRef.current ?? undefined,
      },
      abandonedCheckoutSessionId:
        localStorage.getItem(ABANDONED_CHECKOUT_SESSION_KEY) ?? undefined,
      totals: {
        subtotal,
        shipping: shippingCharge,
        total: checkoutTotal,
      },
    };

    setIsPlacingOrder(true);
    try {
      const response = await fetch('/api/checkout/place-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as
          | { code?: string; error?: string; redirectTo?: string }
          | null;
        if (
          response.status === 403 &&
          errorPayload?.code === 'CUSTOMER_BLOCKED'
        ) {
          handleCloseCart();
          router.push(errorPayload.redirectTo || '/unauthorized');
          return;
        }
        setPlaceOrderError(
          errorPayload?.error || 'Could not place order. Please try again.',
        );
        return;
      }

      const payload = (await response.json()) as {
        orderId: string;
        metaEventId?: string;
      };
      if (!payload.orderId) {
        setPlaceOrderError('Could not place order. Please try again.');
        return;
      }

      const orderData = {
        id: payload.orderId,
        ...requestBody,
        orderDate: new Date().toISOString(),
      };

      localStorage.setItem(`order_${payload.orderId}`, JSON.stringify(orderData));
      if (payload.metaEventId) {
        localStorage.setItem(
          `${META_PURCHASE_EVENT_STORAGE_PREFIX}${payload.orderId}`,
          payload.metaEventId,
        );
      }
      localStorage.setItem(CHECKOUT_PENDING_ORDER_KEY, payload.orderId);
      handleCloseCart();
      router.push(`/order-confirmation?orderId=${payload.orderId}`);
    } catch {
      setPlaceOrderError(
        'Network issue while placing order. Please check your internet and retry.',
      );
    } finally {
      setIsPlacingOrder(false);
    }
  }

  async function handleCustomerLogout() {
    try {
      const response = await fetch('/api/logout', { method: 'POST' });
      if (!response.ok) return;
      setIsCustomerLoggedIn(false);
      setIsMenuOpen(false);
      router.push('/');
      router.refresh();
    } catch {
      // Keep current session state if network/request fails.
    }
  }

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-zinc-200/65 bg-white/88 shadow-[0_10px_34px_rgba(24,24,27,0.055)] backdrop-blur-xl">
        <div className="border-b border-white/10 bg-zinc-950">
          <div className="mx-auto flex h-7 max-w-7xl items-center justify-center px-4 sm:h-8 sm:px-6 lg:px-8">
            <span
              className="truncate text-center text-[7.5px] font-semibold uppercase leading-none tracking-[0.08rem] sm:text-[9px] sm:tracking-[0.14rem]"
              style={{ color: '#ffffff' }}
            >
              COD Available • Fast Delivery • Useful Home & Kitchen Finds
            </span>
          </div>
        </div>

        <nav className="mx-auto max-w-7xl px-3 py-3 sm:px-6 lg:px-8 lg:py-4">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:gap-4">
            <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-3 lg:min-w-[11.75rem]">
              <button
                type="button"
                aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={isMenuOpen}
                onClick={handleMenuToggle}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-200/90 bg-white/95 text-zinc-700 shadow-[0_8px_22px_rgba(24,24,27,0.045)] ring-1 ring-zinc-950/[0.025] transition duration-300 hover:-translate-y-0.5 hover:border-zinc-300 hover:bg-zinc-950 hover:text-white"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={
                      isMenuOpen
                        ? 'M6 6l12 12M18 6L6 18'
                        : 'M4 6h16M4 12h16M4 18h16'
                    }
                  />
                </svg>
              </button>

              {/* Logo */}
              <Link href="/" className="flex shrink-0 items-center gap-2">
                <div className="relative h-9 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-zinc-900/10 shadow-[0_8px_24px_rgba(24,24,27,0.06)] sm:h-10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={businessProfile.logoUrl}
                    alt={businessProfile.logoAlt}
                    className="h-full w-auto object-contain"
                    loading="eager"
                    fetchPriority="high"
                  />
                </div>
              </Link>
            </div>

            <div className="min-w-0">
              <div ref={desktopSearchRef} className="relative mx-auto w-full max-w-2xl">
                <form
                  role="search"
                  onSubmit={handleSearchSubmit}
                  className="flex h-10 w-full items-center gap-1.5 rounded-full border border-zinc-200/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(250,250,250,0.88))] px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),inset_0_-1px_0_rgba(24,24,27,0.025),0_8px_22px_rgba(24,24,27,0.035)] transition duration-300 focus-within:border-zinc-300 focus-within:bg-white focus-within:shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_0_0_4px_rgba(24,24,27,0.055)] sm:h-11 sm:gap-2.5 sm:px-4"
                >
                  <svg
                    className="h-3.5 w-3.5 shrink-0 text-zinc-400 sm:h-4 sm:w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
                    />
                  </svg>
                  <input
                    type="search"
                    name="q"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setIsSearchOpen(true);
                      void loadSearchProducts();
                    }}
                    onFocus={() => {
                      setIsSearchOpen(true);
                      void loadSearchProducts();
                    }}
                    placeholder={searchPlaceholder}
                    aria-label="Search products"
                    autoComplete="off"
                    className="w-full appearance-none !rounded-none !border-0 !bg-transparent !p-0 !text-[0.68rem] !font-medium !leading-none !text-zinc-800 !shadow-none outline-none placeholder:!font-medium placeholder:!tracking-[0.01em] placeholder:!text-zinc-400 focus:!border-0 focus:!shadow-none sm:!text-sm"
                  />
                </form>

                {isSearchOpen && searchSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-[calc(100%+0.6rem)] overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-[0_26px_70px_rgba(24,24,27,0.14)]">
                    {searchSuggestions.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() =>
                          handleSuggestionSelect(product.id, product.name)
                        }
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition duration-200 hover:bg-zinc-50"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-2xl bg-zinc-100">
                            {product.image ? (
                              <img
                                src={product.image}
                                alt={product.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="h-full w-full bg-zinc-100" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="line-clamp-2 text-xs font-semibold leading-5 text-zinc-800">
                              {product.name}
                            </span>
                            <p className="mt-0.5 text-[0.62rem] font-medium text-zinc-400">
                              {product.variantCount}{' '}
                              {product.variantCount === 1 ? 'variant' : 'variants'}
                            </p>
                          </div>
                        </div>
                        <span className="shrink-0 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                          View
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Actions */}
            <div className="flex shrink-0 items-center justify-end lg:min-w-[11.75rem]">
              <div className="relative">
                {cartNotices.length > 0 ? (
                  <div className="pointer-events-none absolute right-0 top-[calc(100%+0.6rem)] z-20 flex w-56 flex-col gap-2">
                    {cartNotices.map((cartNotice) => (
                      <motion.div
                        key={cartNotice.id}
                        initial={{
                          opacity: 0,
                          y: -6,
                          x: 0,
                          filter: 'blur(0px)',
                        }}
                        animate={{
                          opacity: [1, 1, 0.9, 0.8, 0.7, 0.6, 0.5, 0],
                          x: [0, 0, 6, 12, 18, 24, 30, 36],
                          y: [0, 0, 0, 0, 0, 0, 0, 0],
                          filter: [
                            'blur(0px)',
                            'blur(0px)',
                            'blur(0px)',
                            'blur(0.3px)',
                            'blur(0.6px)',
                            'blur(1px)',
                            'blur(1.2px)',
                            'blur(1.5px)',
                          ],
                        }}
                        transition={{
                          duration: 2.2,
                          times: [0, 0.58, 0.66, 0.74, 0.82, 0.9, 0.96, 1],
                          ease: 'linear',
                        }}
                        className="rounded-2xl border border-zinc-200 bg-white/95 px-2.5 py-2 shadow-[0_16px_35px_rgba(24,24,27,0.14)] backdrop-blur-sm"
                        aria-live="polite"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                            {cartNotice.image ? (
                              <img
                                src={cartNotice.image}
                                alt={cartNotice.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="h-full w-full bg-slate-100" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="line-clamp-1 text-xs font-semibold text-slate-800">
                              {cartNotice.name}
                            </p>
                            <p className="mt-0.5 text-[0.7rem] font-medium text-slate-500">
                              Added to cart
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={handleCartToggle}
                  aria-label={isCartOpen ? 'Close cart' : 'Open cart'}
                  aria-expanded={isCartOpen}
                  className="group relative flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200/90 bg-white/95 text-zinc-700 shadow-[0_8px_22px_rgba(24,24,27,0.045)] ring-1 ring-zinc-950/[0.025] transition duration-300 hover:-translate-y-0.5 hover:border-zinc-300 hover:bg-zinc-950 hover:text-white sm:w-auto sm:gap-2 sm:px-3 sm:py-2"
              >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                    />
                  </svg>
                  <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-zinc-950 px-1.5 py-0.5 text-center text-[0.65rem] font-semibold leading-none text-white ring-2 ring-white transition group-hover:bg-white group-hover:text-zinc-950 group-hover:ring-zinc-950 sm:static sm:min-w-6 sm:px-2 sm:py-1 sm:text-xs sm:ring-0">
                    {itemCount}
                  </span>
                </button>
              </div>
            </div>
          </div>

        </nav>
      </header>

      <div
        className={`fixed inset-0 z-50 transition ${
          isMenuOpen || isCartOpen
            ? 'pointer-events-auto'
            : 'pointer-events-none'
        }`}
      >
        <button
          type="button"
          aria-label="Close overlay"
          onClick={() => {
            handleCloseMenu();
            handleCloseCart();
          }}
          className={`absolute inset-0 bg-zinc-950/40 backdrop-blur-[3px] transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isMenuOpen || isCartOpen ? 'opacity-100' : 'opacity-0'
          }`}
        />

        <aside
          className={`absolute left-0 top-0 flex h-full w-[23.5rem] max-w-[92vw] flex-col overflow-y-auto bg-[#fbfaf8] px-6 py-6 shadow-[0_24px_80px_rgba(24,24,27,0.18)] ring-1 ring-zinc-950/10 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] sm:w-[25.5rem] sm:px-8 ${
            isMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.24em] text-zinc-400">
                BDBuyEasy
              </p>
              <h2 className="mt-2 text-2xl font-semibold leading-tight tracking-[-0.01em] text-zinc-950">
                Buy Easy
              </h2>
              <p className="mt-1 text-sm font-medium leading-6 text-zinc-500">
                Easy deals everyday
              </p>
            </div>
            <button
              type="button"
              onClick={handleCloseMenu}
              aria-label="Close menu"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 shadow-sm transition hover:border-zinc-300 hover:text-zinc-950"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div
            className={`mt-7 rounded-[1.75rem] border border-zinc-200/80 bg-white p-4 shadow-[0_18px_50px_rgba(24,24,27,0.06)] transition-all delay-75 duration-500 ${
              isMenuOpen ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
            }`}
          >
            <div className="overflow-hidden rounded-[1.35rem] bg-[linear-gradient(135deg,#f4f0e8,#e9ece6_58%,#f8f7f3)] px-4 py-5">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-zinc-500">
                Smart Home Essentials
              </p>
              <p className="mt-2 max-w-[14rem] text-lg font-semibold leading-6 text-zinc-950">
                Curated useful finds for daily living.
              </p>
            </div>
          </div>

          <nav
            className={`mt-8 flex flex-col gap-8 pb-12 transition-all delay-150 duration-500 ${
              isMenuOpen ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
            }`}
            aria-label="Primary menu"
          >
            <section>
              <p className="px-1 text-[0.68rem] font-bold uppercase tracking-[0.24em] text-zinc-400">
                Explore
              </p>
              <div className="mt-3 space-y-1">
                {exploreLinks.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    onClick={handleCloseMenu}
                    className="group flex items-center justify-between rounded-2xl px-3 py-3 transition hover:bg-white hover:shadow-sm"
                  >
                    <span>
                      <span className="block text-base font-semibold leading-5 text-zinc-950">
                        {link.label}
                      </span>
                      <span className="mt-1 block text-xs font-medium leading-5 text-zinc-500">
                        {link.description}
                      </span>
                    </span>
                    <span className="text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-zinc-950">
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </span>
                  </Link>
                ))}
              </div>
            </section>

            <section>
              <button
                type="button"
                onClick={() => setIsCategoryMenuOpen((open) => !open)}
                aria-expanded={isCategoryMenuOpen}
                className="flex w-full items-center justify-between gap-4 rounded-2xl px-1 py-1 text-left"
              >
                <span>
                  <span className="block text-[0.68rem] font-bold uppercase tracking-[0.24em] text-zinc-400">
                    Shop by Need
                  </span>
                  <span className="mt-2 block text-xl font-semibold leading-6 text-zinc-950">
                    Practical home upgrades
                  </span>
                </span>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 shadow-sm">
                  <svg
                    className={`h-4 w-4 transition-transform duration-300 ${
                      isCategoryMenuOpen ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </span>
              </button>

              <div
                className={`grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  isCategoryMenuOpen
                    ? 'grid-rows-[1fr] opacity-100'
                    : 'grid-rows-[0fr] opacity-0'
                }`}
              >
                <div className="overflow-hidden">
                  <div className="mt-4 rounded-[1.65rem] border border-zinc-200/80 bg-white p-2.5 shadow-sm">
                    {featuredMenuCategories.length > 0 ? (
                      <>
                        <div className="space-y-1.5">
                          {featuredMenuCategories.map((category) => (
                            <Link
                              key={category.rawName}
                              href={category.href}
                              onClick={handleCloseMenu}
                              className="block rounded-2xl px-3.5 py-3 text-[0.92rem] font-semibold leading-6 text-zinc-800 transition duration-300 hover:bg-zinc-50 hover:text-zinc-950"
                            >
                              {category.label}
                            </Link>
                          ))}
                        </div>

                        {hiddenMenuCategories.length > 0 && (
                          <div className="mt-2 border-t border-zinc-100 pt-2">
                            <button
                              type="button"
                              onClick={() =>
                                setIsAllCategoryMenuOpen((open) => !open)
                              }
                              aria-expanded={isAllCategoryMenuOpen}
                              className="flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-sm font-bold text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-950"
                            >
                              <span>
                                {isAllCategoryMenuOpen
                                  ? 'Show fewer categories'
                                  : `View all categories (${menuCategories.length})`}
                              </span>
                              <span className="text-base leading-none">
                                {isAllCategoryMenuOpen ? '-' : '+'}
                              </span>
                            </button>

                            {isAllCategoryMenuOpen && (
                              <div className="mt-1.5 space-y-1">
                                {hiddenMenuCategories.map((category) => (
                                  <Link
                                    key={category.rawName}
                                    href={category.href}
                                    onClick={handleCloseMenu}
                                    className="block rounded-2xl px-3.5 py-2.5 text-[0.84rem] font-medium leading-6 text-zinc-500 transition duration-300 hover:bg-zinc-50 hover:text-zinc-950"
                                  >
                                    {category.label}
                                  </Link>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      <Link
                        href="/products"
                        onClick={handleCloseMenu}
                        className="block rounded-2xl px-3 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-950"
                      >
                        Browse all products
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section>
              <p className="px-1 text-[0.68rem] font-bold uppercase tracking-[0.24em] text-zinc-400">
                Support
              </p>
              <div className="mt-3 space-y-1">
                {supportLinks.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    onClick={(event) => {
                      if (link.label === 'Cart') {
                        event.preventDefault();
                        handleCartToggle();
                        return;
                      }
                      if (link.label === 'Logout') {
                        event.preventDefault();
                        void handleCustomerLogout();
                        return;
                      }

                      handleCloseMenu();
                    }}
                    className="group flex items-center justify-between rounded-2xl px-3 py-3 transition hover:bg-white hover:shadow-sm"
                  >
                    <span>
                      <span className="block text-base font-semibold leading-5 text-zinc-950">
                        {link.label}
                      </span>
                      <span className="mt-1 block text-xs font-medium leading-5 text-zinc-500">
                        {link.description}
                      </span>
                    </span>
                    <span className="text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-zinc-950">
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          </nav>
        </aside>

        <aside
          className={`absolute right-0 top-0 box-border flex h-full w-full max-w-[100vw] flex-col overflow-x-hidden overflow-y-auto bg-white shadow-[0_24px_70px_rgba(24,24,27,0.18)] ring-1 ring-zinc-950/5 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] sm:w-[31rem] lg:w-[34rem] ${
            isCartOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="sticky top-0 z-10 mb-2 flex items-center justify-between border-b border-zinc-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-7">
            <div>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-zinc-400">
                {isCheckoutView ? 'Checkout' : 'Cart'}
              </p>
              <p className="mt-1 text-sm font-semibold text-zinc-950">
                {isCheckoutView
                  ? 'Complete your delivery details'
                  : `${selectedItemCount} selected item${selectedItemCount === 1 ? '' : 's'}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCloseCart}
                aria-label="Close cart"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-950 hover:text-white focus:outline-none focus:ring-4 focus:ring-zinc-950/10"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 6l12 12M18 6L6 18"
                  />
                </svg>
              </button>
            </div>
          </div>

          <div className="px-5 pt-3 sm:px-7">
            <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 p-1">
              {checkoutSteps.map((step, index) => (
                <button
                  type="button"
                  key={step}
                  onClick={() => {
                    if (step === 'Cart') {
                      resetCheckoutView();
                      return;
                    }
                    handleProceedToCheckout();
                  }}
                  disabled={step === 'Checkout' && !canCheckoutWithAuthoritativePricing}
                  aria-current={index === activeCheckoutStep ? 'step' : undefined}
                  className={`flex min-w-0 flex-1 items-center justify-center rounded-full px-2.5 py-2 text-[0.68rem] font-bold uppercase tracking-[0.12em] transition focus:outline-none focus:ring-4 focus:ring-zinc-950/10 disabled:cursor-not-allowed ${
                    index === activeCheckoutStep
                      ? 'bg-zinc-950 text-white shadow-sm'
                      : index < activeCheckoutStep
                        ? 'text-zinc-700'
                        : 'text-zinc-400 disabled:opacity-45'
                  }`}
                >
                  {step}
                </button>
              ))}
            </div>
          </div>

          {isCheckoutView ? (
            <>
              <div className="px-5 pb-6 pt-4 sm:px-7">
                <div className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-4 shadow-[0_12px_34px_rgba(24,24,27,0.06)] sm:p-5">
                  <div className="flex items-start justify-between gap-4 border-b border-zinc-100 pb-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">
                        Delivery Details
                      </p>
                      <p className="mt-1 text-sm font-semibold text-zinc-900">
                        We will confirm before dispatch.
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-emerald-700">
                      COD
                    </span>
                  </div>
                  <div>
                      <motion.input
                      type="tel"
                      name="customerMobile"
                      placeholder="Customer mobile *"
                      value={checkoutForm.customerMobile}
                      onChange={handleCheckoutInputChange}
                      onBlur={() => handleCheckoutFieldBlur('customerMobile')}
                      animate={
                        isFieldFilled(checkoutForm.customerMobile)
                          ? { scale: 1.01, y: -1 }
                          : { scale: 1, y: 0 }
                      }
                      transition={fieldSpringTransition}
                      className={`${checkoutFieldClass} ${
                        isCustomerMobileInvalid
                          ? 'rounded-b-none border-rose-300 bg-rose-50/40 shadow-[0_0_0_2px_rgba(244,63,94,0.16)]'
                          : isFieldFilled(checkoutForm.customerMobile)
                            ? completedFieldGlow
                            : 'border-slate-200'
                      }`}
                    />
                    <AnimatePresence initial={false}>
                      {isCustomerMobileInvalid && (
                        <motion.span
                          initial={{ opacity: 0, y: -4, height: 0 }}
                          animate={{ opacity: 1, y: 0, height: 'auto' }}
                          exit={{ opacity: 0, y: -4, height: 0 }}
                          transition={{ duration: 0.2, ease: 'easeOut' }}
                          className="mt-1 inline-flex w-fit max-w-full overflow-hidden rounded-md border border-amber-300 bg-amber-50 px-3 py-px text-[10px] font-medium leading-3.5 text-amber-800"
                        >
                          Use 01XXXXXXXXX or +8801XXXXXXXXX format.
                        </motion.span>
                      )}
                    </AnimatePresence>
                    {isCustomerLookupLoading && (
                      <p className="mt-1 text-[10px] font-medium text-slate-500">
                        Checking existing customer...
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <motion.input
                        type="text"
                        name="firstName"
                        placeholder="First name *"
                        value={checkoutForm.firstName}
                        onChange={handleCheckoutInputChange}
                        onBlur={() => handleCheckoutFieldBlur('firstName')}
                        onKeyDown={(event) => {
                          if (event.key === ' ') {
                            event.preventDefault();
                            triggerFirstNameSplitHint();
                          }
                        }}
                        animate={
                          isFieldFilled(checkoutForm.firstName)
                            ? { scale: 1.01, y: -1 }
                            : { scale: 1, y: 0 }
                        }
                        transition={fieldSpringTransition}
                        className={`${checkoutFieldClass} ${
                          isFirstNameInvalid
                            ? invalidFieldGlow
                            : isFieldFilled(checkoutForm.firstName)
                              ? completedFieldGlow
                              : 'border-slate-200'
                        }`}
                      />
                      <AnimatePresence initial={false}>
                        {showFirstNameSplitHint && (
                          <motion.span
                            initial={{ opacity: 0, y: -4, height: 0 }}
                            animate={{ opacity: 1, y: 0, height: 'auto' }}
                            exit={{ opacity: 0, y: -4, height: 0 }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                            className="mt-1 inline-flex w-fit max-w-full overflow-hidden rounded-md border border-amber-300 bg-amber-50 px-3 py-px text-[10px] font-medium leading-3.5 text-amber-800"
                          >
                            Enter Last Name in the Last Name field
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>
                    <div>
                      <motion.input
                        type="text"
                        name="lastName"
                        placeholder="Last name"
                        value={checkoutForm.lastName}
                        onChange={handleCheckoutInputChange}
                        onBlur={() => handleCheckoutFieldBlur('lastName')}
                        onKeyDown={(event) => {
                          if (event.key === ' ') {
                            event.preventDefault();
                            triggerLastNameOnlyHint();
                          }
                        }}
                        animate={
                          isFieldFilled(checkoutForm.lastName)
                            ? { scale: 1.01, y: -1 }
                            : { scale: 1, y: 0 }
                        }
                        transition={fieldSpringTransition}
                        className={`${checkoutFieldClass} ${
                          isFieldFilled(checkoutForm.lastName)
                            ? completedFieldGlow
                            : 'border-slate-200'
                        }`}
                      />
                      <AnimatePresence initial={false}>
                        {showLastNameOnlyHint && (
                          <motion.span
                            initial={{ opacity: 0, y: -4, height: 0 }}
                            animate={{ opacity: 1, y: 0, height: 'auto' }}
                            exit={{ opacity: 0, y: -4, height: 0 }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                            className="mt-1 inline-flex w-fit max-w-full overflow-hidden rounded-md border border-amber-300 bg-amber-50 px-3 py-px text-[10px] font-medium leading-3.5 text-amber-800"
                          >
                            First name and Last Name only.
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                  <div>
                      <motion.input
                      type="email"
                      name="email"
                      placeholder="Email (optional)"
                      value={checkoutForm.email}
                      onChange={handleCheckoutInputChange}
                      onBlur={() => handleCheckoutFieldBlur('email')}
                      animate={
                        isFieldFilled(checkoutForm.email)
                          ? { scale: 1.01, y: -1 }
                          : { scale: 1, y: 0 }
                      }
                      transition={fieldSpringTransition}
                      className={`${checkoutFieldClass} ${
                        isEmailInvalid
                          ? 'rounded-b-none border-rose-300 bg-rose-50/40 shadow-[0_0_0_2px_rgba(244,63,94,0.16)]'
                          : isFieldFilled(checkoutForm.email)
                            ? completedFieldGlow
                            : 'border-slate-200'
                      }`}
                    />
                    <p className="mt-1 inline-flex rounded-full bg-gradient-to-r from-emerald-500 via-sky-500 to-fuchsia-500 px-2.5 py-1 text-[11px] font-bold leading-4 !text-white shadow-sm ring-1 ring-sky-100 [text-shadow:0_1px_1px_rgba(0,0,0,0.2)]">
                      Get invoice on your email.
                    </p>
                    <AnimatePresence initial={false}>
                      {isEmailInvalid && (
                        <motion.span
                          initial={{ opacity: 0, y: -4, height: 0 }}
                          animate={{ opacity: 1, y: 0, height: 'auto' }}
                          exit={{ opacity: 0, y: -4, height: 0 }}
                          transition={{ duration: 0.2, ease: 'easeOut' }}
                          className="mt-1 inline-flex w-fit max-w-full overflow-hidden rounded-md border border-amber-300 bg-amber-50 px-3 py-px text-[10px] font-medium leading-3.5 text-amber-800"
                        >
                          Enter a valid email address.
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                  <div>
                      <motion.input
                      type="tel"
                      name="receiverMobile"
                      placeholder="Receiver mobile (optional)"
                      value={checkoutForm.receiverMobile}
                      onChange={handleCheckoutInputChange}
                      onBlur={() => handleCheckoutFieldBlur('receiverMobile')}
                      animate={
                        isFieldFilled(checkoutForm.receiverMobile)
                          ? { scale: 1.01, y: -1 }
                          : { scale: 1, y: 0 }
                      }
                      transition={fieldSpringTransition}
                      className={`${checkoutFieldClass} ${
                        isReceiverMobileInvalid
                          ? 'rounded-b-none border-rose-300 bg-rose-50/40 shadow-[0_0_0_2px_rgba(244,63,94,0.16)]'
                          : isFieldFilled(checkoutForm.receiverMobile)
                            ? completedFieldGlow
                            : 'border-slate-200'
                      }`}
                    />
                    <AnimatePresence initial={false}>
                      {isReceiverMobileInvalid && (
                        <motion.span
                          initial={{ opacity: 0, y: -4, height: 0 }}
                          animate={{ opacity: 1, y: 0, height: 'auto' }}
                          exit={{ opacity: 0, y: -4, height: 0 }}
                          transition={{ duration: 0.2, ease: 'easeOut' }}
                          className="mt-1 inline-flex w-fit max-w-full overflow-hidden rounded-md border border-amber-300 bg-amber-50 px-3 py-px text-[10px] font-medium leading-3.5 text-amber-800"
                        >
                          {!isReceiverDifferentFromCustomer
                            ? 'Do not add duplicate number.'
                            : 'Use 01XXXXXXXXX or +8801XXXXXXXXX format.'}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <motion.div
                      animate={
                        isFieldFilled(checkoutForm.district)
                          ? { scale: 1.01, y: -1 }
                          : { scale: 1, y: 0 }
                      }
                      transition={fieldSpringTransition}
                    >
                      <SearchableDropdown
                        value={checkoutForm.district}
                        options={groupedDistrictOptions}
                        placeholder="Select district *"
                        onSelect={(value) =>
                          handleCheckoutLocationSelect('district', value)
                        }
                        onBlur={() => handleCheckoutFieldBlur('district')}
                        className={`${checkoutDropdownClass} ${
                          isDistrictInvalid
                            ? invalidFieldGlow
                            : isFieldFilled(checkoutForm.district)
                              ? completedFieldGlow
                              : 'border-slate-200'
                        }`}
                      />
                    </motion.div>
                    <motion.div
                      animate={
                        isFieldFilled(checkoutForm.thana)
                          ? { scale: 1.01, y: -1 }
                          : { scale: 1, y: 0 }
                      }
                      transition={fieldSpringTransition}
                    >
                      <SearchableDropdown
                        value={checkoutForm.thana}
                        options={groupedAreaOptions}
                        placeholder="Select thana/upazila *"
                        disabled={!checkoutForm.district}
                        onSelect={(value) =>
                          handleCheckoutLocationSelect('thana', value)
                        }
                        onBlur={() => handleCheckoutFieldBlur('thana')}
                        className={`${checkoutDropdownClass} ${
                          isThanaInvalid
                            ? invalidFieldGlow
                            : isFieldFilled(checkoutForm.thana)
                              ? completedFieldGlow
                              : 'border-slate-200'
                        }`}
                      />
                    </motion.div>
                  </div>
                  <motion.textarea
                    name="address"
                    value={checkoutForm.address}
                    onChange={handleCheckoutInputChange}
                    onBlur={() => handleCheckoutFieldBlur('address')}
                    placeholder="Street address *"
                    rows={3}
                    animate={
                      isFieldFilled(checkoutForm.address)
                        ? { scale: 1.01, y: -1 }
                        : { scale: 1, y: 0 }
                    }
                    transition={fieldSpringTransition}
                    className={`!min-h-24 ${checkoutFieldClass} resize-none ${
                      isAddressInvalid
                        ? invalidFieldGlow
                        : isFieldFilled(checkoutForm.address)
                          ? completedFieldGlow
                          : 'border-slate-200'
                    }`}
                  />
                  <div className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3.5">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">
                      Payment Method
                    </p>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        title="Coming soon"
                        aria-disabled="true"
                        onClick={() => {
                          setPlaceOrderError('bKash is coming soon. Please choose Cash on Delivery.');
                        }}
                        className="min-h-12 cursor-not-allowed rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm font-bold text-zinc-400 opacity-70 transition-all duration-200 transform-gpu hover:border-zinc-300 focus:outline-none focus:ring-4 focus:ring-zinc-950/10"
                      >
                        bKash
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentMethod('cod');
                          setPlaceOrderError('');
                        }}
                          className={`min-h-12 rounded-2xl border px-3 py-2 text-sm font-bold transition-all duration-200 transform-gpu focus:outline-none focus:ring-4 focus:ring-zinc-950/10 ${
                            paymentMethod === 'cod'
                              ? 'scale-[1.015] border-zinc-950 bg-white text-zinc-950 shadow-sm'
                              : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-950'
                          }`}
                      >
                        Cash on Delivery
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 border-t border-zinc-200 bg-white/96 px-4 pb-3 pt-3 shadow-[0_-18px_45px_rgba(24,24,27,0.08)] backdrop-blur sm:px-7 sm:pb-6 sm:pt-4">
                <div className="mb-3 space-y-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-xs sm:mb-4 sm:space-y-2.5 sm:rounded-3xl sm:p-4 sm:text-sm">
                  <div className="flex items-center justify-between text-zinc-600">
                    <span>Items Total</span>
                    <span className="font-semibold text-zinc-900">
                      ৳{subtotal.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-600">
                    <span>Shipping Charge</span>
                    <span className="font-semibold text-zinc-900">
                      ৳{shippingCharge.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-zinc-200 pt-3 text-zinc-950">
                    <span className="font-bold">Total</span>
                    <span className="text-lg font-black text-zinc-950 sm:text-xl">
                      ৳{checkoutTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
                {!isPricingAuthoritative && selectedItemCount > 0 && cartPricingError && (
                  <p className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                    {cartPricingError}
                  </p>
                )}
                  <button
                    type="button"
                    onClick={handlePlaceOrder}
                    disabled={!isCheckoutFormValid || isPlacingOrder || !canCheckoutWithAuthoritativePricing}
                    className={`${primaryCtaClass} ${
                      isCheckoutFormValid && !isPlacingOrder && canCheckoutWithAuthoritativePricing
                        ? 'bg-zinc-950 hover:-translate-y-0.5 hover:bg-zinc-800'
                        : 'cursor-not-allowed bg-zinc-300 shadow-none'
                    }`}
                >
                  {isPlacingOrder ? 'Placing...' : 'Place Order'}
                </button>
                {placeOrderError && (
                  <p className="mt-2 text-xs font-medium text-rose-600">
                    {placeOrderError}
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="px-5 pb-6 pt-4 sm:px-7">
                {cartItems.length > 0 ? (
                  <div className="flex flex-col gap-4">
                    {groupedCartItems.map((group) => (
                      <div key={group.productId} className="flex items-start gap-3">
                        <div className="flex shrink-0 items-start pt-5">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white">
                            <input
                              type="checkbox"
                              checked={group.allSelected}
                              onChange={(event) => {
                                setItemsSelection(
                                  group.lines.map((line) => line.id),
                                  event.target.checked,
                                );
                              }}
                              aria-label={`Select ${group.productName} for checkout`}
                              className="h-4 w-4 rounded border-zinc-300 text-zinc-950 focus:ring-zinc-950"
                            />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1 rounded-3xl border border-zinc-200 bg-white p-3.5 shadow-[0_10px_28px_rgba(24,24,27,0.055)]">
                          <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3.5">
                            <div className="h-[5.5rem] w-[5.5rem] shrink-0 overflow-hidden rounded-2xl bg-zinc-100">
                              {group.productImage ? (
                                <img
                                  src={group.productImage}
                                  alt={group.productName}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="h-full w-full bg-zinc-100" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1 pt-1">
                              <Link
                                href={`/products/${group.productId}`}
                                onClick={handleCloseCart}
                                className="line-clamp-2 text-sm font-bold leading-5 text-zinc-900 transition hover:text-zinc-600"
                              >
                                {group.productName}
                              </Link>
                              <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-zinc-50 px-3 py-2">
                                <span className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-zinc-400">
                                  Subtotal
                                </span>
                                <span className="text-sm font-black text-zinc-950">
                                  ৳{group.subtotalAfterDiscount.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="col-span-2 mt-3 w-full space-y-2.5">
                            {group.lines.map((item) => {
                              const unitBasePrice = item.salePrice ?? item.price;
                              return (
                                <div
                                  key={item.id}
                                  className="w-full rounded-2xl border border-zinc-100 bg-zinc-50/80 p-3"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex min-w-0 items-center gap-2">
                                      <div className="h-6 w-6 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-white">
                                        {item.image ? (
                                          <img
                                            src={item.image}
                                            alt=""
                                            className="h-full w-full object-cover"
                                          />
                                        ) : (
                                          <div className="h-full w-full bg-zinc-100" />
                                        )}
                                      </div>
                                      <p className="line-clamp-2 min-w-0 text-xs font-semibold leading-5 text-zinc-600">
                                        {item.variantLabel || 'Variant'}
                                      </p>
                                    </div>
                                    <p className="shrink-0 text-xs font-bold text-zinc-950">
                                      ৳{unitBasePrice.toFixed(2)} x {item.quantity}
                                    </p>
                                  </div>
                                  <div className="mt-2 flex items-center justify-between gap-3">
                                    <button
                                      type="button"
                                      onClick={() => removeFromCart(item.id)}
                                      className="min-h-9 shrink-0 rounded-full border border-transparent px-2 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-zinc-400 transition hover:border-rose-100 hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus:ring-4 focus:ring-rose-500/10"
                                    >
                                      Remove
                                    </button>
                                    <div className="flex min-h-9 shrink-0 items-center overflow-hidden rounded-full border border-zinc-200 bg-white shadow-sm">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          updateQuantity(item.id, item.quantity - 1)
                                        }
                                        className="flex h-9 w-9 items-center justify-center text-base font-semibold text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-zinc-950/10"
                                        aria-label={`Decrease quantity for ${item.name}`}
                                      >
                                        -
                                      </button>
                                      <span className="min-w-9 text-center text-sm font-bold text-zinc-900">
                                        {item.quantity}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          updateQuantity(item.id, item.quantity + 1)
                                        }
                                        className="flex h-9 w-9 items-center justify-center text-base font-semibold text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-zinc-950/10"
                                        aria-label={`Increase quantity for ${item.name}`}
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <div className="col-span-2 mt-3 w-full space-y-1.5 rounded-2xl border border-zinc-100 bg-white px-3 py-2.5 text-xs">
                            <div className="flex items-center justify-between text-zinc-500">
                              <span>Product subtotal</span>
                              <span>৳{group.subtotalBeforeDiscount.toFixed(2)}</span>
                            </div>
                            {group.discount > 0 && (
                              <>
                                <div className="flex items-center justify-between text-emerald-700">
                                  <span>Bundle discount</span>
                                  <span>-৳{group.discount.toFixed(2)}</span>
                                </div>
                                <div className="flex items-center justify-between border-t border-zinc-100 pt-1.5 font-bold text-zinc-900">
                                  <span>After discount</span>
                                  <span>৳{group.subtotalAfterDiscount.toFixed(2)}</span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-3xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-10 text-center">
                    <p className="text-sm font-bold text-zinc-800">
                      Your cart is empty
                    </p>
                    <p className="mt-2 text-xs leading-5 text-zinc-500">
                      Add a few products and they will appear here instantly.
                    </p>
                  </div>
                )}
                <div className="mt-4 rounded-3xl border border-zinc-200 bg-white p-3">
                  <label
                    htmlFor="cart-coupon"
                    className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-zinc-500"
                  >
                    Coupon
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="cart-coupon"
                      type="text"
                      placeholder="Apply coupon"
                      className="min-h-11 min-w-0 flex-1 rounded-2xl border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-800 outline-none transition placeholder:text-zinc-400 focus:border-zinc-950 focus:shadow-[0_0_0_4px_rgba(24,24,27,0.08)]"
                    />
                    <button
                      type="button"
                      className="min-h-11 shrink-0 rounded-2xl border border-zinc-200 px-4 py-2 text-sm font-bold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-950 focus:outline-none focus:ring-4 focus:ring-zinc-950/10"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 border-t border-zinc-200 bg-white/96 px-4 pb-3 pt-3 shadow-[0_-18px_45px_rgba(24,24,27,0.08)] backdrop-blur sm:px-7 sm:pb-6 sm:pt-4">
                <div className="hidden">
                  <div className="flex items-center justify-between text-zinc-600">
                    <span>Items Total</span>
                    <span className="font-semibold text-zinc-900">
                      ৳{subtotal.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="mb-3 flex items-center justify-between rounded-2xl bg-zinc-950 px-4 py-3 text-white sm:mb-4 sm:rounded-3xl">
                  <span className="text-sm font-bold">
                    Cart Subtotal
                  </span>
                  <span className="text-lg font-black sm:text-xl">
                    ৳{subtotal.toFixed(2)}
                  </span>
                </div>
                {!isPricingAuthoritative && selectedItemCount > 0 && cartPricingError && (
                  <p className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                    {cartPricingError}
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleProceedToCheckout}
                  className={`${primaryCtaClass} ${
                    canCheckoutWithAuthoritativePricing
                      ? 'bg-zinc-950 hover:-translate-y-0.5 hover:bg-zinc-800 hover:!text-white'
                      : 'pointer-events-none bg-zinc-300 !text-white shadow-none'
                  }`}
                >
                  <span>Proceed Checkout</span>
                </button>
              </div>
            </>
          )}
        </aside>
      </div>
    </>
  );
}










