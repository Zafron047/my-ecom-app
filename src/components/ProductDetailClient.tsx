'use client';

import { useCart } from '@/components/CartProvider';
import { toVariantImageUrl } from '@/lib/image-variants';
import { trackMetaViewContent } from '@/lib/meta-pixel';
import type {
  StorefrontCatalogProduct,
  StorefrontProductDetail,
} from '@/lib/storefront-types';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

function isValidColorHex(value: string | undefined) {
  return Boolean(value && /^#[0-9a-f]{6}$/i.test(value));
}

const easeOutExpo = [0.16, 1, 0.3, 1] as const;

interface ProductDetailClientProps {
  product: StorefrontProductDetail;
  relatedProducts: StorefrontCatalogProduct[];
}

export default function ProductDetailClient({
  product,
  relatedProducts,
}: ProductDetailClientProps) {
  const { addToCart, cartItems, updateQuantity } = useCart();
  const relatedCarouselRef = useRef<HTMLDivElement>(null);
  const trackedViewContentKeysRef = useRef<Set<string>>(new Set());
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [areBundleOffersExpanded, setAreBundleOffersExpanded] = useState(false);
  const [isZooming, setIsZooming] = useState(false);
  const [zoomLensX, setZoomLensX] = useState(0);
  const [zoomLensY, setZoomLensY] = useState(0);
  const [fallbackImageSet, setFallbackImageSet] = useState<Record<number, boolean>>(
    {},
  );
  const [zoomFallbackImageSet, setZoomFallbackImageSet] = useState<Record<number, boolean>>(
    {},
  );
  const formatVariantLabel = (color?: string, size?: string) =>
    [color?.trim(), size?.trim()].filter(Boolean).join(' / ');

  const activeVariant = useMemo(
    () => product?.variants?.[selectedVariantIndex],
    [product, selectedVariantIndex],
  );
  const variantGroups = useMemo(() => {
    if (!product) return [];
    const groups = new Map<
      string,
      {
        color: string;
        colorHex?: string;
        indexes: number[];
      }
    >();

    product.variants.forEach((variant, index) => {
      const color = variant.color?.trim() || 'Default';
      const key = color.toLowerCase();
      const current =
        groups.get(key) ??
        {
          color,
          colorHex: isValidColorHex(variant.colorHex) ? variant.colorHex : undefined,
          indexes: [],
        };
      current.indexes.push(index);
      if (!current.colorHex && isValidColorHex(variant.colorHex)) {
        current.colorHex = variant.colorHex;
      }
      groups.set(key, current);
    });

    return [...groups.values()];
  }, [product]);
  const activeVariantGroup = useMemo(
    () =>
      variantGroups.find((group) =>
        group.indexes.includes(selectedVariantIndex),
      ) ?? variantGroups[0],
    [selectedVariantIndex, variantGroups],
  );
  const bestActiveBundleOffer = useMemo(
    () =>
      [...product.bundleOffers]
        .filter((offer) => offer.isActive)
        .sort((a, b) => {
          if (b.discountPercent !== a.discountPercent) {
            return b.discountPercent - a.discountPercent;
          }
          return b.minTotalQty - a.minTotalQty;
        })[0],
    [product.bundleOffers],
  );
  const productCartItems = useMemo(
    () => cartItems.filter((item) => item.detailId === product.id),
    [cartItems, product.id],
  );
  const activeVariantCartItem = useMemo(
    () =>
      productCartItems.find((item) =>
        activeVariant?.id ? item.variantId === activeVariant.id : false,
      ),
    [activeVariant, productCartItems],
  );
  const activeVariantQuantity = activeVariantCartItem?.quantity ?? 0;
  const activePrice = activeVariant?.price ?? product?.price ?? 0;
  const activeSalePrice =
    activeVariant
      ? activeVariant.salePrice
      : product?.salePrice;
  const activeStockQuantity = activeVariant?.stockQuantity ?? 0;
  const isActiveVariantInStock = activeStockQuantity > 0;
  const canIncreaseActiveVariantQuantity =
    Boolean(activeVariant) &&
    isActiveVariantInStock &&
    activeVariantQuantity < activeStockQuantity;
  const canAddActiveVariant =
    Boolean(activeVariant) && isActiveVariantInStock && activeVariantQuantity < activeStockQuantity;
  const discount = useMemo(() => {
    if (!activeSalePrice || activePrice <= activeSalePrice) return 0;
    return Math.round(((activePrice - activeSalePrice) / activePrice) * 100);
  }, [activePrice, activeSalePrice]);

  const normalizedImages = product.images.filter((image) =>
    Boolean(image && image.trim()),
  );
  const fallbackPrimaryImage = product.image?.trim() ? product.image : '';
  const safeSelectedImage =
    normalizedImages[selectedImage] ?? fallbackPrimaryImage;
  const descriptionText = product.description.trim();
  const descriptionLineCount = descriptionText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean).length;
  const shouldClampDescription =
    descriptionText.length > 360 || descriptionLineCount > 5;
  const visibleBundleOffers = areBundleOffersExpanded
    ? product.bundleOffers
    : product.bundleOffers.slice(0, 1);
  const hiddenBundleOfferCount = Math.max(
    product.bundleOffers.length - visibleBundleOffers.length,
    0,
  );
  const appendImageVersion = (imageUrl: string) => {
    if (!imageUrl) return imageUrl;
    try {
      const parsed = new URL(imageUrl);
      parsed.searchParams.set('v', String(product.imageVersion));
      return parsed.toString();
    } catch {
      const joiner = imageUrl.includes('?') ? '&' : '?';
      return `${imageUrl}${joiner}v=${product.imageVersion}`;
    }
  };
  const resolvedSelectedImage = fallbackImageSet[selectedImage]
    ? appendImageVersion(safeSelectedImage)
    : appendImageVersion(toVariantImageUrl(safeSelectedImage, 'detail'));
  const zoomSelectedImage = zoomFallbackImageSet[selectedImage]
    ? appendImageVersion(safeSelectedImage)
    : appendImageVersion(toVariantImageUrl(safeSelectedImage, 'zoom'));
  const DETAIL_BOX_SIZE = 584;
  const LENS_SIZE = 140;
  const ZOOM_SCALE = 2.2;
  const toOriginalFromVariantUrl = (imageUrl: string) =>
    imageUrl
      .replace(/\/(thumb|detail|zoom)\//i, '/original/')
      .replace(/-(thumb|detail|zoom)\.webp$/i, '.webp');
  const selectVariantAtIndex = (index: number) => {
    if (!product) return;
    const variant = product.variants[index];
    if (!variant) return;
    setSelectedVariantIndex(index);
    const variantImage = variant.image;
    const imageIndex = product.images.findIndex(
      (img) =>
        img === variantImage ||
        toVariantImageUrl(img, 'thumb') === variantImage ||
        img === toOriginalFromVariantUrl(variantImage),
    );
    setSelectedImage(imageIndex >= 0 ? imageIndex : 0);
  };
  const cartProduct = {
    id: product.id,
    detailId: product.id,
    name: product.name,
    price: activePrice,
    salePrice: activeSalePrice,
    stockQuantity: activeStockQuantity,
    image: activeVariant?.image || product.image,
    variantId: activeVariant?.id,
    variantLabel: activeVariant
      ? formatVariantLabel(activeVariant.color, activeVariant.size) ||
        undefined
      : undefined,
    bundleOffers: product.bundleOffers,
    hasActiveBundleOffer: Boolean(bestActiveBundleOffer),
    bundleMinTotalQty: bestActiveBundleOffer?.minTotalQty,
    bundleDiscountPercent: bestActiveBundleOffer?.discountPercent,
    bundleDisplayText: bestActiveBundleOffer?.title?.trim() || undefined,
  };
  const addSelectedVariantToCart = () => {
    if (!canAddActiveVariant) return;
    addToCart(cartProduct, 1);
  };
  const decreaseActiveVariantQuantity = () => {
    if (!activeVariantCartItem) return;
    updateQuantity(activeVariantCartItem.id, activeVariantQuantity - 1);
  };
  const increaseActiveVariantQuantity = () => {
    if (!canIncreaseActiveVariantQuantity) return;
    if (activeVariantCartItem) {
      updateQuantity(activeVariantCartItem.id, activeVariantQuantity + 1);
      return;
    }
    addToCart(cartProduct, 1);
  };
  const scrollRelatedProducts = (direction: -1 | 1) => {
    const carousel = relatedCarouselRef.current;
    if (!carousel) return;
    carousel.scrollBy({
      left: direction * carousel.clientWidth * 0.82,
      behavior: 'smooth',
    });
  };

  useEffect(() => {
    const contentId = activeVariant?.id ?? product.id;
    const trackingKey = `viewcontent:${contentId}`;
    if (trackedViewContentKeysRef.current.has(trackingKey)) return;

    if (typeof window !== 'undefined') {
      const sessionKey = `meta_${trackingKey}`;
      const lastTrackedAt = Number(window.sessionStorage.getItem(sessionKey) ?? 0);
      const now = Date.now();
      if (now - lastTrackedAt < 2000) return;
      window.sessionStorage.setItem(sessionKey, String(now));
    }

    trackedViewContentKeysRef.current.add(trackingKey);
    trackMetaViewContent({
      content_ids: [contentId],
      content_name: product.name,
      content_type: 'product',
      contents: [
        {
          id: contentId,
          item_price: activeSalePrice ?? activePrice,
          quantity: 1,
        },
      ],
      currency: 'BDT',
      num_items: 1,
      value: activeSalePrice ?? activePrice,
    });
  }, [activePrice, activeSalePrice, activeVariant?.id, product.id, product.name]);

  return (
    <div className="mx-auto max-w-7xl px-3 py-5 text-slate-950 sm:px-6 sm:py-10 lg:px-8">
      <nav className="mb-5 flex items-center space-x-1.5 text-[11px] sm:mb-8 sm:space-x-2 sm:text-sm">
        <Link href="/" className="font-medium text-slate-500 transition hover:text-blue-700">
          Home
        </Link>
        <span className="text-slate-300">/</span>
        <Link href="/products" className="font-medium text-slate-500 transition hover:text-blue-700">
          Products
        </Link>
        <span className="text-slate-300">/</span>
        <span className="max-w-[42rem] truncate text-slate-700">{product.name}</span>
      </nav>

      <div className="mb-12 grid grid-cols-1 gap-8 sm:mb-20 sm:gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(460px,0.88fr)]">
        <motion.div
          className="self-start lg:sticky lg:top-28"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: easeOutExpo }}
        >
          <div className="relative z-20 mb-3 rounded-[1.25rem] border border-[#e5ded1] bg-white p-2.5 shadow-[0_22px_55px_rgba(64,48,29,0.1)] sm:mb-4 sm:rounded-[1.75rem] sm:p-4 sm:shadow-[0_32px_90px_rgba(64,48,29,0.11)]">
            <div className="absolute inset-2.5 rounded-2xl bg-[#f7f3eb] sm:inset-4 sm:rounded-[1.25rem]" aria-hidden="true" />
            <div
              className="relative z-20 aspect-square w-full max-w-[584px] shrink-0 overflow-hidden rounded-2xl border border-white bg-[#f8f5ef] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.86)] sm:rounded-[1.25rem]"
              onMouseEnter={() => setIsZooming(true)}
              onMouseLeave={() => setIsZooming(false)}
              onMouseMove={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                const x = Math.max(
                  LENS_SIZE / 2,
                  Math.min(event.clientX - rect.left, rect.width - LENS_SIZE / 2),
                );
                const y = Math.max(
                  LENS_SIZE / 2,
                  Math.min(event.clientY - rect.top, rect.height - LENS_SIZE / 2),
                );
                setZoomLensX(x - LENS_SIZE / 2);
                setZoomLensY(y - LENS_SIZE / 2);
              }}
            >
              {safeSelectedImage ? (
                <AnimatePresence mode="wait">
                  <motion.img
                    key={`${resolvedSelectedImage}-${selectedImage}`}
                    src={resolvedSelectedImage}
                    alt={product.name}
                    className="h-full w-full object-cover"
                    initial={{ opacity: 0, scale: 1.025 }}
                    animate={{
                      opacity: isZooming ? 0 : 1,
                      scale: isZooming ? 1.04 : 1,
                    }}
                    exit={{ opacity: 0, scale: 0.99 }}
                    transition={{ duration: 0.32, ease: easeOutExpo }}
                    onError={() =>
                      setFallbackImageSet((current) => ({
                        ...current,
                        [selectedImage]: true,
                      }))
                    }
                  />
                </AnimatePresence>
              ) : (
                <div className="w-full h-full grid place-items-center text-slate-500">
                  No image
                </div>
              )}
              {safeSelectedImage && isZooming && (
                <div
                  className="absolute inset-0 h-full w-full bg-no-repeat"
                  style={{
                    backgroundImage: `url(${zoomSelectedImage})`,
                    backgroundPosition: `-${zoomLensX * ZOOM_SCALE}px -${zoomLensY * ZOOM_SCALE}px`,
                    backgroundSize: `${DETAIL_BOX_SIZE * ZOOM_SCALE}px ${DETAIL_BOX_SIZE * ZOOM_SCALE}px`,
                  }}
                />
              )}
              {isZooming && safeSelectedImage && (
                <div
                  className="pointer-events-none absolute rounded-lg border border-[#d2b36e]/80 bg-white/10 shadow-[0_0_0_1px_rgba(255,255,255,0.74),0_12px_30px_rgba(64,48,29,0.15)] backdrop-blur-[1px]"
                  style={{
                    width: LENS_SIZE,
                    height: LENS_SIZE,
                    transform: `translate(${zoomLensX}px, ${zoomLensY}px)`,
                  }}
                />
              )}
              {safeSelectedImage && (
                <motion.div
                  className="pointer-events-none absolute bottom-4 right-4 rounded-full border border-white/45 bg-[#3a3329]/82 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white shadow-lg"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.3 }}
                >
                  Zoom
                </motion.div>
              )}
            </div>
          </div>
          <div className="mt-3 rounded-2xl border border-[#e5ded1] bg-white/92 p-2.5 shadow-[0_14px_36px_rgba(64,48,29,0.07)] backdrop-blur sm:mt-5 sm:p-3 sm:shadow-[0_18px_50px_rgba(64,48,29,0.08)]">
            <div className="flex snap-x gap-2.5 overflow-x-auto pb-0.5 [scrollbar-width:none] sm:flex-wrap sm:gap-3 sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden">
              {normalizedImages.map((image, index) => (
                <motion.button
                  key={`${image}-${index}`}
                  onClick={() => setSelectedImage(index)}
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.96 }}
                  transition={{ duration: 0.18 }}
                  className={`relative h-16 w-16 shrink-0 snap-start overflow-hidden rounded-xl border bg-white transition sm:h-20 sm:w-20 ${
                    selectedImage === index
                      ? 'border-[#c6a15b] shadow-[0_10px_24px_rgba(120,88,39,0.18)] ring-2 ring-[#ead8ad]'
                      : 'border-[#e7e0d5] opacity-82 hover:border-[#d8c39a] hover:opacity-100'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      fallbackImageSet[index]
                        ? appendImageVersion(image)
                        : appendImageVersion(toVariantImageUrl(image, 'thumb'))
                    }
                    alt={`View ${index + 1}`}
                    className="w-full h-full object-cover"
                    onError={() =>
                      setFallbackImageSet((current) => ({
                        ...current,
                        [index]: true,
                      }))
                    }
                  />
                  {selectedImage === index ? (
                    <motion.span
                      layoutId="active-product-thumbnail"
                      className="absolute inset-x-3 bottom-2 h-0.5 rounded-full bg-gradient-to-r from-[#b58a3b] via-[#e4c77e] to-[#9a7434]"
                      transition={{ duration: 0.25, ease: easeOutExpo }}
                    />
                  ) : null}
                </motion.button>
              ))}
            </div>
          </div>
          {/* Load zoom only after the customer starts zooming. */}
          {safeSelectedImage && isZooming ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={zoomSelectedImage}
              alt=""
              className="hidden"
              aria-hidden="true"
              onError={() =>
                setZoomFallbackImageSet((current) => ({
                  ...current,
                  [selectedImage]: true,
                }))
              }
            />
          ) : null}
        </motion.div>

        <motion.div
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_18px_48px_rgba(15,23,42,0.06)] sm:rounded-lg sm:p-7 sm:shadow-[0_22px_70px_rgba(15,23,42,0.07)]"
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08, ease: easeOutExpo }}
        >
          <div className="mb-5 flex items-start justify-between gap-4 sm:mb-6">
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 sm:mb-3 sm:text-xs">
                {product.category}
              </p>
              <h1 className="text-2xl font-semibold leading-tight text-slate-950 sm:text-4xl">{product.name}</h1>
            </div>
            {discount > 0 && (
              <div className="rounded-full bg-rose-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm">
                -{discount}%
              </div>
            )}
          </div>

          <div className="mb-5 border-y border-slate-100 py-4 sm:mb-7 sm:py-5">
            <div className="mb-2 flex items-baseline gap-3 sm:mb-3">
              {activeSalePrice ? (
                <>
                  <span className="text-2xl font-semibold text-slate-950 sm:text-4xl">
                    BDT {activeSalePrice.toFixed(2)}
                  </span>
                  <span className="text-lg text-slate-400 line-through">
                    BDT {activePrice.toFixed(2)}
                  </span>
                </>
              ) : (
                <span className="text-2xl font-semibold text-slate-950 sm:text-4xl">
                  BDT {activePrice.toFixed(2)}
                </span>
              )}
            </div>
            <p className={isActiveVariantInStock ? 'text-sm font-semibold text-emerald-700' : 'text-sm font-semibold text-red-600'}>
              {isActiveVariantInStock
                ? `${activeStockQuantity} in stock${activeVariantQuantity > 0 ? `, ${activeVariantQuantity} in cart` : ''}`
                : 'Out of Stock'}
            </p>
          </div>

          {product.variants.length > 0 && (
            <div className="mb-5 sm:mb-6">
              <p className="mb-3 text-sm font-semibold text-slate-950">
                Color
              </p>
              <div className="flex flex-wrap gap-2">
                {variantGroups.map((group, groupIndex) => (
                  <motion.button
                    key={`${group.color}-${groupIndex}`}
                    type="button"
                    onClick={() => selectVariantAtIndex(group.indexes[0] ?? 0)}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.96 }}
                    className={`inline-flex h-10 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition ${
                      group === activeVariantGroup
                        ? 'border-slate-950 bg-slate-950 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-500'
                    }`}
                  >
                    <span
                      className="h-4 w-4 rounded-full border border-white/70 shadow-sm ring-1 ring-slate-300"
                      style={{
                        backgroundColor: group.colorHex ?? '#e5e7eb',
                      }}
                      aria-hidden="true"
                    />
                    {group.color}
                  </motion.button>
                ))}
              </div>
              {activeVariantGroup ? (
                <div className="mt-5">
                  <p className="mb-3 text-sm font-semibold text-slate-950">
                    Size
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {activeVariantGroup.indexes.map((index, sizeIndex) => {
                      const variant = product.variants[index];
                      if (!variant) return null;

                      return (
                        <motion.button
                          key={`${variant.id}-${sizeIndex}`}
                          type="button"
                          onClick={() => selectVariantAtIndex(index)}
                          whileHover={{ y: -1 }}
                          whileTap={{ scale: 0.96 }}
                          className={`min-w-12 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                            index === selectedVariantIndex
                              ? 'border-slate-950 bg-white text-slate-950 ring-2 ring-slate-950/10'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-500'
                          }`}
                        >
                          {variant.size?.trim() || 'Default'}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="mt-5 flex items-center gap-3 sm:mt-6">
                <div className="inline-flex h-12 items-center rounded-full border border-slate-200 bg-white shadow-sm">
                  <motion.button
                    type="button"
                    onClick={decreaseActiveVariantQuantity}
                    disabled={activeVariantQuantity <= 0}
                    whileTap={{ scale: 0.9 }}
                    className="px-4 text-lg leading-none text-slate-700 transition hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-35"
                    aria-label="Decrease quantity"
                  >
                    -
                  </motion.button>
                  <span className="min-w-10 text-center text-sm font-semibold text-slate-950">
                    {activeVariantQuantity}
                  </span>
                  <motion.button
                    type="button"
                    onClick={increaseActiveVariantQuantity}
                    disabled={!canIncreaseActiveVariantQuantity}
                    whileTap={{ scale: 0.9 }}
                    className="px-4 text-lg leading-none text-slate-700 transition hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-35"
                    aria-label="Increase quantity"
                  >
                    +
                  </motion.button>
                </div>

                <motion.button
                  className="h-12 flex-1 rounded-full border border-slate-300 px-5 text-sm font-semibold text-slate-800 transition hover:border-slate-950 hover:bg-slate-50 sm:flex-none"
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.97 }}
                >
                  Wishlist
                </motion.button>
              </div>
            </div>
          )}

          <div className="mb-5 sm:mb-6">
            <motion.button
              type="button"
              onClick={addSelectedVariantToCart}
              disabled={!canAddActiveVariant}
              whileHover={canAddActiveVariant ? { y: -2 } : undefined}
              whileTap={canAddActiveVariant ? { scale: 0.985 } : undefined}
              className="w-full rounded-full bg-slate-950 py-4 font-semibold text-white shadow-[0_16px_32px_rgba(15,23,42,0.2)] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
            >
              {activeStockQuantity <= 0
                ? 'Out of Stock'
                : activeVariantQuantity >= activeStockQuantity
                  ? 'Max Quantity In Cart'
                  : 'Add to Cart'}
            </motion.button>
          </div>

          <div className="mb-5 grid grid-cols-3 gap-2 border-b border-slate-100 pb-5 text-center sm:mb-6 sm:gap-3 sm:pb-6">
            {['Fast delivery', 'Easy returns', 'Quality checked'].map((label, index) => (
              <motion.div
                key={label}
                className="rounded-md bg-slate-50 px-1.5 py-2.5 text-[10px] font-semibold text-slate-700 sm:px-2 sm:py-3 sm:text-xs"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: 0.18 + index * 0.05 }}
              >
                {label}
              </motion.div>
            ))}
          </div>

          {product.bundleOffers.length > 0 && (
            <div className="mb-5 rounded-xl border border-amber-200 bg-[#fffaf0] p-3 sm:mb-6 sm:rounded-lg sm:p-4">
              <h3 className="mb-4 text-lg font-semibold text-slate-950">Bundle Offers</h3>
              <div className="space-y-3">
                <AnimatePresence initial={false}>
                  {visibleBundleOffers.map((offer, offerIndex) => (
                    <motion.div
                      key={`${offer.id}-${offerIndex}`}
                      className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 rounded-md border border-amber-200 bg-white px-3 py-2 shadow-sm"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.25, ease: easeOutExpo }}
                    >
                    <div className="h-16 w-16 overflow-hidden rounded-md border border-amber-100 bg-amber-50">
                      {offer.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={offer.image}
                          alt={offer.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-[10px] font-semibold text-amber-700">
                          Bundle
                        </div>
                      )}
                    </div>
                    <div className="self-center">
                      <p className="text-sm font-semibold text-slate-900">{offer.title}</p>
                      <p className="text-xs text-slate-700">
                        Buy at least {offer.minTotalQty} eligible pcs and get{' '}
                        {offer.discountPercent}% off
                      </p>
                    </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
              {product.bundleOffers.length > 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setAreBundleOffersExpanded((current) => !current)
                  }
                  className="mt-3 text-sm font-semibold text-slate-900 transition hover:text-amber-800"
                >
                  {areBundleOffersExpanded
                    ? 'See fewer offers'
                    : `See ${hiddenBundleOfferCount} more offer${hiddenBundleOfferCount === 1 ? '' : 's'}`}
                </button>
              ) : null}
            </div>
          )}

          <div className="mb-5 rounded-xl border border-slate-200 bg-white p-3 sm:mb-6 sm:rounded-lg sm:p-4">
            <h3 className="mb-4 text-lg font-semibold text-slate-950">Specifications</h3>
            <div className="space-y-2">
              {product.specs.map((spec, index) => (
                <div
                  key={`${spec.name}-${index}`}
                  className="grid grid-cols-[minmax(120px,0.9fr)_minmax(0,1.1fr)] gap-3 border-b border-slate-100 px-1 py-2 last:border-b-0"
                >
                  <p className="text-sm font-semibold text-slate-700">{spec.name}</p>
                  <p className="text-sm text-slate-900">{spec.value}</p>
                </div>
              ))}
            </div>
          </div>

          {descriptionText ? (
            <div className="rounded-xl border border-slate-200 bg-white p-3 sm:rounded-lg sm:p-4">
              <h3 className="mb-3 text-lg font-semibold text-slate-950">
                Description
              </h3>
              <div
                className={`relative ${
                  shouldClampDescription && !isDescriptionExpanded
                    ? 'max-h-32 overflow-hidden'
                    : ''
                }`}
              >
                <p className="whitespace-pre-line text-sm leading-6 text-slate-700">
                  {descriptionText}
                </p>
                {shouldClampDescription && !isDescriptionExpanded ? (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white to-white/0" />
                ) : null}
              </div>
              {shouldClampDescription ? (
                <button
                  type="button"
                  onClick={() =>
                    setIsDescriptionExpanded((current) => !current)
                  }
                  className="mt-3 text-sm font-semibold text-slate-950 transition hover:text-blue-700"
                >
                  {isDescriptionExpanded ? 'See less' : 'See more...'}
                </button>
              ) : null}
            </div>
          ) : null}

        </motion.div>
      </div>

      <section className="mt-10 overflow-hidden rounded-2xl border border-[#e5ded1] bg-[#fbfaf7] px-3 py-4 shadow-[0_18px_48px_rgba(64,48,29,0.07)] sm:mt-16 sm:rounded-[1.75rem] sm:px-7 sm:py-6 sm:shadow-[0_24px_70px_rgba(64,48,29,0.08)]">
        <div className="mb-5 flex items-end justify-between gap-3 sm:mb-7 sm:gap-4">
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8c7450] sm:mb-2 sm:text-xs">
              Curated for you
            </p>
            <h2 className="text-2xl font-semibold leading-tight text-slate-950 sm:text-3xl">Related Products</h2>
          </div>
          <Link href="/products" className="text-sm font-semibold text-slate-700 transition hover:text-slate-950">
            View all
          </Link>
        </div>
        <div className="relative">
          <motion.button
            type="button"
            onClick={() => scrollRelatedProducts(-1)}
            className="absolute left-1 top-1/2 z-20 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-[#dccba9] bg-white/95 text-base font-semibold text-[#5d4b32] shadow-[0_10px_24px_rgba(64,48,29,0.18)] backdrop-blur transition hover:border-[#c6a15b] hover:text-slate-950 sm:left-2 sm:h-11 sm:w-11 sm:text-lg"
            aria-label="Previous related products"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.95 }}
          >
            &lt;
          </motion.button>
          <div
            ref={relatedCarouselRef}
            className="-mx-3 flex snap-x gap-3 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:-mx-7 sm:gap-5 sm:px-7 sm:pb-2 [&::-webkit-scrollbar]:hidden"
          >
            {relatedProducts.map((relatedProduct, relatedProductIndex) => (
              <Link
                key={`${relatedProduct.id}-${relatedProductIndex}`}
                href={`/products/${relatedProduct.id}`}
                className="group block min-w-[72%] snap-start cursor-pointer sm:min-w-[42%] lg:min-w-[24%]"
              >
                <motion.div
                  className="h-full rounded-xl border border-[#e7ddca] bg-white p-2.5 shadow-[0_12px_34px_rgba(64,48,29,0.07)] transition-colors group-hover:border-[#d4bd8a] sm:rounded-2xl sm:p-3 sm:shadow-[0_16px_45px_rgba(64,48,29,0.08)]"
                  whileHover={{ y: -6 }}
                  transition={{ duration: 0.24, ease: easeOutExpo }}
                >
                  <div className="relative mb-3 aspect-[4/5] overflow-hidden rounded-lg bg-[#f4efe6] sm:mb-4 sm:rounded-xl">
                    {relatedProduct.image ? (
                      <motion.img
                        src={relatedProduct.image}
                        alt={relatedProduct.name}
                        className="h-full w-full object-cover"
                        whileHover={{ scale: 1.055 }}
                        transition={{ duration: 0.45, ease: easeOutExpo }}
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-xs font-semibold text-slate-500">
                        No image
                      </div>
                    )}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/35 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  </div>
                  <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#9b8054] sm:mb-2 sm:text-[11px]">
                    Recommended
                  </p>
                  <h3 className="mb-2 line-clamp-2 min-h-11 text-base font-semibold leading-snug text-slate-950 sm:mb-3 sm:min-h-14 sm:text-lg">
                    {relatedProduct.name}
                  </h3>
                  <div className="flex items-center justify-between gap-2 border-t border-[#eee6d8] pt-2.5 sm:gap-3 sm:pt-3">
                    <span className="text-sm font-semibold text-slate-800 sm:text-base">
                      BDT {(relatedProduct.salePrice ?? relatedProduct.price).toFixed(2)}
                    </span>
                    <span className="text-xs font-semibold text-[#7c6239] transition group-hover:text-slate-950 sm:text-sm">
                      View
                    </span>
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
          <motion.button
            type="button"
            onClick={() => scrollRelatedProducts(1)}
            className="absolute right-1 top-1/2 z-20 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-[#dccba9] bg-white/95 text-base font-semibold text-[#5d4b32] shadow-[0_10px_24px_rgba(64,48,29,0.18)] backdrop-blur transition hover:border-[#c6a15b] hover:text-slate-950 sm:right-2 sm:h-11 sm:w-11 sm:text-lg"
            aria-label="Next related products"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.95 }}
          >
            &gt;
          </motion.button>
        </div>
      </section>
    </div>
  );
}


