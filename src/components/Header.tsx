'use client';

import { useCart } from '@/components/CartProvider';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { catalogProducts } from '@/data/products';

const searchableProducts = catalogProducts.map(({ id, name, image }) => ({
  id,
  name,
  image,
}));

export default function Header() {
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
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const {
    cartItems,
    isCartOpen,
    cartNotices,
    itemCount,
    selectedItemCount,
    selectedCartItems,
    subtotal,
    closeCart,
    toggleCart,
    toggleItemSelection,
    updateQuantity,
    removeFromCart,
  } = useCart();
  const [isCheckoutView, setIsCheckoutView] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'bkash' | 'cod' | ''>('');
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
  const desktopSearchRef = useRef<HTMLDivElement | null>(null);
  const mobileSearchRef = useRef<HTMLDivElement | null>(null);
  const firstNameHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const lastNameHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const divisions = [
    'Dhaka',
    'Chittagong',
    'Rajshahi',
    'Khulna',
    'Barisal',
    'Sylhet',
    'Rangpur',
    'Mymensingh',
  ];

  const districts: Record<string, string[]> = {
    Dhaka: [
      'Dhaka',
      'Gazipur',
      'Narayanganj',
      'Manikganj',
      'Munshiganj',
      'Narsingdi',
      'Tangail',
      'Kishoreganj',
      'Netrokona',
      'Sherpur',
      'Mymensingh',
      'Jamalpur',
    ],
    Chittagong: [
      'Chittagong',
      "Cox's Bazar",
      'Rangamati',
      'Bandarban',
      'Khagrachhari',
      'Feni',
      'Lakshmipur',
      'Noakhali',
      'Brahmanbaria',
      'Comilla',
    ],
    Rajshahi: [
      'Rajshahi',
      'Natore',
      'Naogaon',
      'Chapainawabganj',
      'Pabna',
      'Sirajganj',
      'Bogra',
      'Joypurhat',
    ],
    Khulna: [
      'Khulna',
      'Bagerhat',
      'Chuadanga',
      'Jessore',
      'Jhenaidah',
      'Kushtia',
      'Magura',
      'Meherpur',
      'Narail',
      'Satkhira',
    ],
    Barisal: [
      'Barisal',
      'Barguna',
      'Bhola',
      'Jhalokati',
      'Patuakhali',
      'Pirojpur',
    ],
    Sylhet: ['Sylhet', 'Habiganj', 'Moulvibazar', 'Sunamganj'],
    Rangpur: [
      'Rangpur',
      'Dinajpur',
      'Gaibandha',
      'Kurigram',
      'Lalmonirhat',
      'Nilphamari',
      'Panchagarh',
      'Thakurgaon',
    ],
    Mymensingh: ['Mymensingh', 'Jamalpur', 'Netrokona', 'Sherpur'],
  };

  const thanas: Record<string, string[]> = {
    Dhaka: [
      'Dhanmondi',
      'Gulshan',
      'Banani',
      'Uttara',
      'Mirpur',
      'Mohammadpur',
      'Tejgaon',
      'Ramna',
      'Motijheel',
      'Sabujbagh',
    ],
    Gazipur: ['Gazipur Sadar', 'Kaliakair', 'Kapasia', 'Sreepur', 'Kaliganj'],
    Narayanganj: [
      'Narayanganj Sadar',
      'Araihazar',
      'Bandar',
      'Rupganj',
      'Sonargaon',
    ],
    default: ['Sadar', 'Municipality'],
  };

  const shippingCharge = useMemo(() => {
    if (!checkoutForm.division) return 0;
    if (checkoutForm.division === 'Dhaka') {
      if (!checkoutForm.district) return 0;
      if (checkoutForm.district === 'Dhaka') return 80;
      return 120;
    }
    return 150;
  }, [checkoutForm.district, checkoutForm.division]);

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
  const mobilePattern = /^(?:\+8801[3-9]\d{8}|01[3-9]\d{8})$/;

  const isEmailValid =
    checkoutForm.email.trim() === '' || emailPattern.test(checkoutForm.email);
  const isCustomerMobileValid = mobilePattern.test(
    checkoutForm.customerMobile.trim(),
  );
  const isReceiverMobileValid =
    checkoutForm.receiverMobile.trim() === '' ||
    mobilePattern.test(checkoutForm.receiverMobile.trim());
  const isReceiverDifferentFromCustomer =
    checkoutForm.receiverMobile.trim() === '' ||
    checkoutForm.receiverMobile.trim() !== checkoutForm.customerMobile.trim();

  const hasRequiredCheckoutFields =
    checkoutForm.firstName.trim() !== '' &&
    checkoutForm.customerMobile.trim() !== '' &&
    checkoutForm.division.trim() !== '' &&
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
  const isDivisionInvalid =
    touchedFields.division && checkoutForm.division.trim() === '';
  const isDistrictInvalid =
    touchedFields.district && checkoutForm.district.trim() === '';
  const isThanaInvalid = touchedFields.thana && checkoutForm.thana.trim() === '';
  const isAddressInvalid =
    touchedFields.address && checkoutForm.address.trim() === '';

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/products', label: 'Products' },
    { href: '#', label: 'Categories' },
    { href: '/checkout', label: 'Cart' },
    { href: '/login', label: 'Login' },
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
    if (selectedItemCount === 0) return;
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
      ...(name === 'division' && { district: '', thana: '' }),
      ...(name === 'district' && { thana: '' }),
    }));
  }

  function handleCheckoutFieldBlur(field: CheckoutField) {
    setTouchedFields((current) => ({
      ...current,
      [field]: true,
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
  }

  function handlePlaceOrder() {
    if (!isCheckoutFormValid) {
      return;
    }

    const orderId = 'ORD-' + Date.now();
    const orderData = {
      id: orderId,
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
      totals: {
        subtotal,
        shipping: shippingCharge,
        total: checkoutTotal,
      },
      orderDate: new Date().toISOString(),
    };

    localStorage.setItem(`order_${orderId}`, JSON.stringify(orderData));
    handleCloseCart();
    router.push(`/order-confirmation?orderId=${orderId}`);
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
              <Link href="/" className="flex items-center">
                <div className="relative h-[2.1rem] w-[3rem] overflow-hidden rounded-md border border-blue-200 bg-[#2d5db3] shadow-sm sm:h-11 sm:w-16 sm:rounded-lg">
                  <Image
                    src="/buy-easy-logo.svg"
                    alt="Buy Easy logo"
                    fill
                    sizes="(max-width: 639px) 51px, 64px"
                    className="object-contain p-0.5"
                    priority
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
                    placeholder="Global Finds at Deshi Price"
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
                            <img
                              src={product.image}
                              alt={product.name}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <span className="line-clamp-2 text-xs font-medium text-slate-700">
                            {product.name}
                          </span>
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
                            <img
                              src={cartNotice.image}
                              alt={cartNotice.name}
                              className="h-full w-full object-cover"
                            />
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
                    <motion.select
                      name="division"
                      value={checkoutForm.division}
                      onChange={handleCheckoutInputChange}
                      onBlur={() => handleCheckoutFieldBlur('division')}
                      animate={
                        isFieldFilled(checkoutForm.division)
                          ? { scale: 1.01, y: -1 }
                          : { scale: 1, y: 0 }
                      }
                      transition={fieldSpringTransition}
                      className={`w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-pink-300 ${
                        isDivisionInvalid
                          ? invalidFieldGlow
                          : isFieldFilled(checkoutForm.division)
                            ? completedFieldGlow
                            : 'border-slate-200'
                      }`}
                    >
                      <option value="">Select division *</option>
                      {divisions.map((division) => (
                        <option key={division} value={division}>
                          {division}
                        </option>
                      ))}
                    </motion.select>
                    <motion.select
                      name="district"
                      value={checkoutForm.district}
                      onChange={handleCheckoutInputChange}
                      onBlur={() => handleCheckoutFieldBlur('district')}
                      disabled={!checkoutForm.division}
                      animate={
                        isFieldFilled(checkoutForm.district)
                          ? { scale: 1.01, y: -1 }
                          : { scale: 1, y: 0 }
                      }
                      transition={fieldSpringTransition}
                      className={`w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-pink-300 disabled:bg-slate-50 ${
                        isDistrictInvalid
                          ? invalidFieldGlow
                          : isFieldFilled(checkoutForm.district)
                            ? completedFieldGlow
                            : 'border-slate-200'
                      }`}
                    >
                      <option value="">Select district *</option>
                      {checkoutForm.division &&
                        districts[checkoutForm.division]?.map((district) => (
                          <option key={district} value={district}>
                            {district}
                          </option>
                        ))}
                    </motion.select>
                  </div>
                  <motion.select
                    name="thana"
                    value={checkoutForm.thana}
                    onChange={handleCheckoutInputChange}
                    onBlur={() => handleCheckoutFieldBlur('thana')}
                    disabled={!checkoutForm.district}
                    animate={
                      isFieldFilled(checkoutForm.thana)
                        ? { scale: 1.01, y: -1 }
                        : { scale: 1, y: 0 }
                    }
                    transition={fieldSpringTransition}
                    className={`w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-pink-300 disabled:bg-slate-50 ${
                      isThanaInvalid
                        ? invalidFieldGlow
                        : isFieldFilled(checkoutForm.thana)
                          ? completedFieldGlow
                          : 'border-slate-200'
                    }`}
                  >
                    <option value="">Select thana/upazila *</option>
                    {checkoutForm.district &&
                      (thanas[checkoutForm.district] || thanas.default)?.map(
                        (thana) => (
                          <option key={thana} value={thana}>
                            {thana}
                          </option>
                        ),
                      )}
                  </motion.select>
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
                        className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-all duration-200 transform-gpu ${
                          paymentMethod === 'bkash'
                            ? 'scale-[1.03] border-2 border-pink-400 bg-pink-50 text-pink-700 shadow-[0_6px_16px_rgba(236,72,153,0.22)]'
                            : 'border-pink-200 bg-pink-50/70 text-pink-700 hover:bg-pink-100/70'
                        }`}
                      >
                        bKash
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('cod')}
                        className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-all duration-200 transform-gpu ${
                          paymentMethod === 'cod'
                            ? 'scale-[1.03] border-2 border-blue-400 bg-blue-50 text-slate-700 shadow-[0_6px_16px_rgba(59,130,246,0.22)]'
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
                    <span>Cart Subtotal</span>
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
                <button
                  type="button"
                  onClick={handlePlaceOrder}
                  disabled={!isCheckoutFormValid}
                  className={`flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold uppercase tracking-[0.12em] !text-white transition ${
                    isCheckoutFormValid
                      ? 'bg-[#2d5db3] hover:bg-[#244a8f]'
                      : 'cursor-not-allowed bg-slate-300'
                  }`}
                >
                  Place Order
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="px-3 pb-6">
                {cartItems.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {cartItems.map((item) => (
                      <div key={item.id} className="flex items-center gap-3">
                        <div className="flex shrink-0 items-center self-stretch">
                          <div className="flex h-full items-center">
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={() => toggleItemSelection(item.id)}
                              aria-label={`Select ${item.name} for checkout`}
                              className="h-4 w-4 rounded border-slate-300 text-[#2d5db3] focus:ring-[#2d5db3]"
                            />
                          </div>
                        </div>
                        <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                          <div className="flex gap-3">
                            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                              <img
                                src={item.image}
                                alt={item.name}
                                className="h-full w-full object-cover"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <Link
                                href={`/products/${item.detailId ?? item.id}`}
                                onClick={handleCloseCart}
                                className="line-clamp-2 text-sm font-medium text-slate-800 transition hover:text-blue-600"
                              >
                                {item.name}
                              </Link>
                              <p className="mt-2 text-sm font-semibold text-slate-900">
                                ৳{(item.salePrice ?? item.price).toFixed(2)}
                              </p>
                              {item.salePrice && (
                                <p className="text-xs text-slate-400 line-through">
                                  ৳{item.price.toFixed(2)}
                                </p>
                              )}
                              <div className="mt-3 flex items-center justify-between gap-3">
                                <button
                                  type="button"
                                  onClick={() => removeFromCart(item.id)}
                                  className="shrink-0 text-xs font-medium uppercase tracking-[0.12em] text-rose-500 transition hover:text-rose-600"
                                >
                                  Remove
                                </button>
                                <div className="flex shrink-0 items-center rounded-full border border-slate-200">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateQuantity(item.id, item.quantity - 1)
                                    }
                                    className="px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50"
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
                                    className="px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50"
                                    aria-label={`Increase quantity for ${item.name}`}
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            </div>
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
                    <span>Subtotal</span>
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
                    Subtotal
                  </span>
                  <span className="text-lg font-bold text-blue-600">
                    ৳{subtotal.toFixed(2)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleProceedToCheckout}
                  className={`flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold uppercase tracking-[0.12em] !text-white transition ${
                    selectedItemCount > 0
                      ? 'bg-[#2d5db3] hover:bg-[#244a8f] hover:!text-white'
                      : 'pointer-events-none bg-slate-300 !text-white'
                  }`}
                >
                  Proceed Checkout
                </button>
              </div>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
