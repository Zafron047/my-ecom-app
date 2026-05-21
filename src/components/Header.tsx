'use client';

import {
  ABANDONED_CHECKOUT_SESSION_KEY,
  useCart,
} from '@/components/CartProvider';
import { CHECKOUT_PENDING_ORDER_KEY } from '@/lib/checkoutPendingOrder.mjs';
import { getGroupedAreaOptions, getGroupedDistrictOptions } from '@/lib/location-presenter';
import { getShippingCharge } from '@/lib/shipping-charge';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import SearchableDropdown from '@/components/SearchableDropdown';
import { FacebookIcon, GoogleIcon } from '@/components/SocialAuthIcons';
import type { StorefrontBusinessProfile } from '@/lib/storefront-types';

const MOBILE_PATTERN = /^01[3-9]\d{8}$/;

function normalizeMobileInput(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('8801') && digits.length === 13) {
    return `0${digits.slice(3)}`;
  }
  return digits;
}

export default function Header({
  businessProfile,
}: {
  businessProfile: StorefrontBusinessProfile;
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
  const [isCustomerLoggedIn, setIsCustomerLoggedIn] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchableProducts, setSearchableProducts] = useState<
    { id: string; name: string; image: string; variantCount: number }[]
  >([]);
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
  const [paymentMethod, setPaymentMethod] = useState<'bkash' | 'cod' | ''>('');
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
    'border-emerald-400 shadow-[0_0_0_2px_rgba(16,185,129,0.18)]';
  const invalidFieldGlow =
    'border-rose-400 shadow-[0_0_0_2px_rgba(244,63,94,0.16)] bg-rose-50/35';
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

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/products', label: 'Products' },
    { href: '#', label: 'Categories' },
    { href: '/checkout', label: 'Cart' },
    ...(isCustomerLoggedIn
      ? [
          { href: '/account', label: 'Account' },
          { href: '#', label: 'Logout' },
        ]
      : [{ href: '/login', label: 'Login' }]),
    { href: '#', label: 'Support' },
  ];

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const searchSuggestions = normalizedQuery
    ? searchableProducts
        .filter((product) =>
          product.name.toLowerCase().includes(normalizedQuery),
        )
        .slice(0, 5)
    : [];

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

    async function loadSearchProducts() {
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
        if (!isMounted) return;
        setSearchableProducts(payload.products ?? []);
      } catch {
        // Keep search suggestions empty when loading fails.
      }
    }

    void loadSearchProducts();

    return () => {
      isMounted = false;
    };
  }, []);

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
    router.push(`/products/${productId}`);
  }

  function handleMenuToggle() {
    if (!isMenuOpen) {
      handleCloseCart();
    }

    setIsMenuOpen((open) => !open);
  }

  function handleCartToggle() {
    if (!isCartOpen) {
      setIsMenuOpen(false);
    } else {
      resetCheckoutView();
    }

    toggleCart();
  }

  function handleCloseCart() {
    resetCheckoutView();
    closeCart();
  }

  function handleProceedToCheckout() {
    if (!canCheckoutWithAuthoritativePricing) return;
    setIsCheckoutView(true);
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
    setPaymentMethod('');
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

      const payload = (await response.json()) as { orderId: string };
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
      <header className="border-b border-gray-200 bg-white sticky top-0 z-40">
        <div className="border-b border-black bg-black">
          <div className="mx-auto flex h-6 max-w-7xl items-center justify-center px-4 sm:px-6 lg:px-8">
            <p
              className="text-center text-[7.5px] font-normal leading-none tracking-[0.06rem] sm:text-[8.5px]"
              style={{ color: 'aliceblue' }}
            >
              Hotline: +880 17XX-XXXXXX | +880 1400-XXXXXX
            </p>
          </div>
        </div>

        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="relative flex items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-1 sm:gap-3 lg:flex-1">
              <button
                type="button"
                aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={isMenuOpen}
                onClick={handleMenuToggle}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-700 transition hover:bg-gray-50"
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
              <Link href="/" className="flex shrink-0 items-center">
                <div className="relative h-8 w-[4.9rem] shrink-0 overflow-hidden rounded-[0.35rem] sm:h-10 sm:w-[5.95rem]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={businessProfile.logoUrl}
                    alt={businessProfile.logoAlt}
                    className="h-full w-full object-contain"
                    loading="eager"
                    fetchPriority="high"
                  />
                </div>
              </Link>
            </div>

            <div className="min-w-0 flex-1 justify-center lg:flex-[2]">
              <div ref={desktopSearchRef} className="relative w-full max-w-2xl">
                <form
                  role="search"
                  onSubmit={handleSearchSubmit}
                  className="flex w-full items-center gap-2 rounded-2xl bg-white px-4 py-1.5 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] transition focus-within:shadow-[inset_0_0_0_1px_rgba(59,130,246,0.45),0_0_0_3px_rgba(59,130,246,0.12)]"
                >
                  <svg
                    className="h-3.5 w-3.5 shrink-0 text-gray-400"
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
                    }}
                    onFocus={() => setIsSearchOpen(true)}
                    placeholder={businessProfile.tagline}
                    aria-label="Search products"
                    autoComplete="off"
                    className="w-full appearance-none !rounded-none !border-0 !bg-transparent !p-0 !text-xs !text-gray-700 !shadow-none outline-none placeholder:!text-gray-400 focus:!border-0 focus:!shadow-none"
                  />
                </form>

                {isSearchOpen && searchSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-[calc(100%+0.45rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
                    {searchSuggestions.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() =>
                          handleSuggestionSelect(product.id, product.name)
                        }
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                            {product.image ? (
                              <img
                                src={product.image}
                                alt={product.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="h-full w-full bg-slate-100" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="line-clamp-2 text-xs font-medium text-slate-700">
                              {product.name}
                            </span>
                            <p className="mt-0.5 text-[0.62rem] font-medium text-slate-400">
                              {product.variantCount}{' '}
                              {product.variantCount === 1 ? 'variant' : 'variants'}
                            </p>
                          </div>
                        </div>
                        <span className="shrink-0 text-[0.65rem] uppercase tracking-[0.14em] text-slate-400">
                          View
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Actions */}
            <div className="flex items-center justify-end space-x-4 lg:flex-1">
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
                        className="rounded-2xl border border-blue-100 bg-white/95 px-2.5 py-2 shadow-[0_16px_35px_rgba(15,23,42,0.14)] backdrop-blur-sm"
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
                  className="flex items-center space-x-2 text-gray-700 transition hover:text-gray-900"
                >
                  <svg
                    className="w-6 h-6"
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
                  <span className="min-w-6 rounded bg-blue-600 px-2 py-1 text-center text-xs text-white">
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
            setIsMenuOpen(false);
            handleCloseCart();
          }}
          className={`absolute inset-0 bg-slate-900/35 transition-opacity duration-300 ${
            isMenuOpen || isCartOpen ? 'opacity-100' : 'opacity-0'
          }`}
        />

        <aside
          className={`absolute left-0 top-0 flex h-full w-80 max-w-[86vw] flex-col bg-white px-6 py-6 shadow-2xl transition-transform duration-300 ease-out ${
            isMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="mb-2" />

          <div className="mb-6 rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
              Promise
            </p>
            <p className="mt-2 text-[10px] font-medium leading-5 text-gray-700">
              Global Finds at Deshi Price
            </p>
          </div>

          <div className="flex flex-col gap-2 pb-12">
            {navLinks.map((link, index) => (
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

                  setIsMenuOpen(false);
                }}
                className="rounded-2xl border border-transparent px-4 py-3 text-base font-medium text-gray-700 transition hover:border-gray-200 hover:bg-gray-50 hover:text-gray-900"
                style={{
                  transitionDelay: isMenuOpen ? `${index * 45}ms` : '0ms',
                }}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </aside>

        <aside
          className={`absolute right-0 top-0 box-border flex h-full w-[26rem] max-w-[94vw] flex-col overflow-x-hidden overflow-y-auto bg-white shadow-2xl transition-transform duration-300 ease-out ${
            isCartOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="mb-2 flex items-center justify-between px-6 pt-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
                {isCheckoutView ? 'Checkout' : 'Cart'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isCheckoutView && (
                <button
                  type="button"
                  onClick={resetCheckoutView}
                  className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-gray-600 transition hover:bg-gray-50"
                >
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={handleCloseCart}
                aria-label="Close cart"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-700 transition hover:bg-gray-50"
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

          <div className={`mb-6 px-6 ${isCheckoutView ? 'hidden' : ''}`}>
            <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50 px-4 py-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
                    Basket
                  </p>
                  <p className="mt-2 text-[10px] font-medium leading-5 text-gray-700">
                    {selectedItemCount} of {itemCount} item
                    {itemCount === 1 ? '' : 's'} selected
                  </p>
                </div>
                <span className="text-[0.68rem] font-medium uppercase tracking-[0.14em] text-slate-400">
                  Pick items
                </span>
              </div>
            </div>
          </div>

          {isCheckoutView ? (
            <>
              <div className="px-3 pb-6">
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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
                      className={`w-full rounded-xl border px-3 py-2 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-pink-300 ${
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
                        className={`w-full rounded-xl border px-3 py-2 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-pink-300 ${
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
                        className={`w-full rounded-xl border px-3 py-2 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-pink-300 ${
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
                      className={`w-full rounded-xl border px-3 py-2 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-pink-300 ${
                        isEmailInvalid
                          ? 'rounded-b-none border-rose-300 bg-rose-50/40 shadow-[0_0_0_2px_rgba(244,63,94,0.16)]'
                          : isFieldFilled(checkoutForm.email)
                            ? completedFieldGlow
                            : 'border-slate-200'
                      }`}
                    />
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
                      className={`w-full rounded-xl border px-3 py-2 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-pink-300 ${
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
                        className={`w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-pink-300 disabled:bg-slate-50 ${
                          isDistrictInvalid
                            ? invalidFieldGlow
                            : isFieldFilled(checkoutForm.district)
                              ? completedFieldGlow
                              : 'border-slate-200'
                        }`}
                      />
                    </motion.div>
                  </div>
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
                      className={`w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-pink-300 disabled:bg-slate-50 ${
                        isThanaInvalid
                          ? invalidFieldGlow
                          : isFieldFilled(checkoutForm.thana)
                            ? completedFieldGlow
                            : 'border-slate-200'
                      }`}
                    />
                  </motion.div>
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
                    className={`w-full rounded-xl border px-3 py-2 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-pink-300 ${
                      isAddressInvalid
                        ? invalidFieldGlow
                        : isFieldFilled(checkoutForm.address)
                          ? completedFieldGlow
                          : 'border-slate-200'
                    }`}
                  />
                  <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Payment Method
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('bkash')}
                          className={`rounded-xl border-2 px-3 py-2 text-sm font-semibold transition-all duration-200 transform-gpu ${
                            paymentMethod === 'bkash'
                              ? 'scale-[1.03] border-pink-400 bg-pink-50 text-pink-700 shadow-[0_6px_16px_rgba(236,72,153,0.22)]'
                              : 'border-pink-200 bg-pink-50/70 text-pink-700 hover:bg-pink-100/70'
                          }`}
                      >
                        bKash
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('cod')}
                          className={`rounded-xl border-2 px-3 py-2 text-sm font-semibold transition-all duration-200 transform-gpu ${
                            paymentMethod === 'cod'
                              ? 'scale-[1.03] border-blue-400 bg-blue-50 text-slate-700 shadow-[0_6px_16px_rgba(59,130,246,0.22)]'
                              : 'border-blue-200 bg-blue-50/70 text-slate-700 hover:bg-blue-100/70'
                          }`}
                      >
                        Cash on Delivery
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 px-6 pt-4 pb-6">
                <div className="mb-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Items Total</span>
                    <span className="font-medium text-slate-900">
                      ৳{subtotal.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Shipping Charge</span>
                    <span className="font-medium text-slate-900">
                      ৳{shippingCharge.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-slate-900">
                    <span className="font-semibold">Total</span>
                    <span className="text-lg font-bold text-blue-600">
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
                    className={`flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold uppercase tracking-[0.12em] !text-white transition ${
                      isCheckoutFormValid && !isPlacingOrder && canCheckoutWithAuthoritativePricing
                        ? 'bg-[#2d5db3] hover:bg-[#244a8f]'
                        : 'cursor-not-allowed bg-slate-300'
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
              <div className="px-3 pb-6">
                {cartItems.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {groupedCartItems.map((group) => (
                      <div key={group.productId} className="flex items-start gap-3">
                        <div className="flex shrink-0 items-center self-stretch">
                          <div className="flex h-full items-center">
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
                              className="h-4 w-4 rounded border-slate-300 text-[#2d5db3] focus:ring-[#2d5db3]"
                            />
                          </div>
                        </div>
                        <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                          <div className="grid grid-cols-[80px_minmax(0,1fr)] gap-3">
                            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                              {group.productImage ? (
                                <img
                                  src={group.productImage}
                                  alt={group.productName}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="h-full w-full bg-slate-100" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <Link
                                href={`/products/${group.productId}`}
                                onClick={handleCloseCart}
                                className="line-clamp-2 text-sm font-medium text-slate-800 transition hover:text-blue-600"
                              >
                                {group.productName}
                              </Link>
                            </div>
                          </div>
                          <div className="col-span-2 mt-2 w-full space-y-2">
                            {group.lines.map((item) => {
                              const unitBasePrice = item.salePrice ?? item.price;
                              return (
                                <div
                                  key={item.id}
                                  className="w-full rounded-lg border border-slate-100 bg-slate-50 p-2"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-xs text-slate-600">
                                      {item.variantLabel || 'Variant'}
                                    </p>
                                    <p className="text-xs font-semibold text-slate-900">
                                      ৳{unitBasePrice.toFixed(2)} x {item.quantity}
                                    </p>
                                  </div>
                                  <div className="mt-2 flex items-center justify-between gap-3">
                                    <button
                                      type="button"
                                      onClick={() => removeFromCart(item.id)}
                                      className="shrink-0 text-[11px] font-medium uppercase tracking-[0.12em] text-rose-500 transition hover:text-rose-600"
                                    >
                                      Remove
                                    </button>
                                    <div className="flex shrink-0 items-center rounded-full border border-slate-200 bg-white">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          updateQuantity(item.id, item.quantity - 1)
                                        }
                                        className="px-3 py-1 text-sm text-slate-600 transition hover:bg-slate-50"
                                        aria-label={`Decrease quantity for ${item.name}`}
                                      >
                                        -
                                      </button>
                                      <span className="min-w-8 text-center text-sm font-medium text-slate-800">
                                        {item.quantity}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          updateQuantity(item.id, item.quantity + 1)
                                        }
                                        className="px-3 py-1 text-sm text-slate-600 transition hover:bg-slate-50"
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
                          <div className="col-span-2 mt-3 w-full space-y-1 text-xs">
                            <div className="flex items-center justify-between text-slate-600">
                              <span>Product subtotal</span>
                              <span>৳{group.subtotalBeforeDiscount.toFixed(2)}</span>
                            </div>
                            {group.discount > 0 && (
                              <>
                                <div className="flex items-center justify-between text-emerald-700">
                                  <span>Bundle discount</span>
                                  <span>-৳{group.discount.toFixed(2)}</span>
                                </div>
                                <div className="flex items-center justify-between font-semibold text-slate-800">
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
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                    <p className="text-sm font-medium text-slate-700">
                      Your cart is empty
                    </p>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      Add a few products and they will appear here instantly.
                    </p>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200 px-6 pt-4 pb-6">
                <div className="mb-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Selected items</span>
                    <span className="font-medium text-slate-900">
                      {selectedItemCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Items Total</span>
                    <span className="font-medium text-slate-900">
                      ৳{subtotal.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="mb-4">
                  <label
                    htmlFor="cart-coupon"
                    className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500"
                  >
                    Coupon
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="cart-coupon"
                      type="text"
                      placeholder="Apply coupon"
                      className="w-36 min-w-0 rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-300"
                    />
                    <button
                      type="button"
                      className="shrink-0 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Apply
                    </button>
                  </div>
                </div>
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900">
                    Cart Subtotal
                  </span>
                  <span className="text-lg font-bold text-blue-600">
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
                  className={`flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold uppercase tracking-[0.12em] !text-white transition ${
                    canCheckoutWithAuthoritativePricing
                      ? 'bg-[#2d5db3] hover:bg-[#244a8f] hover:!text-white'
                      : 'pointer-events-none bg-slate-300 !text-white'
                  }`}
                >
                  <span>Proceed Checkout</span>
                  <span className="ml-3 flex items-center gap-1.5" aria-hidden="true">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white">
                      <GoogleIcon className="h-3.5 w-3.5" />
                    </span>
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white">
                      <FacebookIcon className="h-4 w-4" />
                    </span>
                  </span>
                </button>
              </div>
            </>
          )}
        </aside>
      </div>
    </>
  );
}










