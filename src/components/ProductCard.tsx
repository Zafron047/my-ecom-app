'use client';

import { useCart } from '@/components/CartProvider';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { useState } from 'react';

interface Product {
  id: string;
  detailId?: string;
  name: string;
  price: number;
  salePrice?: number;
  image: string;
  images?: string[];
  badge?: string;
  variants: {
    id: string;
    color: string;
    colorHex?: string;
    size: string;
    price: number;
    salePrice?: number;
    image: string;
    images?: string[];
  }[];
  bundleOffers?: {
    id: string;
    title: string;
    image: string;
    minTotalQty: number;
    discountPercent: number;
    variantIds: string[];
    isActive: boolean;
  }[];
  hasActiveBundleOffer?: boolean;
  bundleMinTotalQty?: number;
  bundleDiscountPercent?: number;
  bundleDisplayText?: string;
}

export default function ProductCard({ product }: { product: Product }) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const { cartItems, addToCart, updateQuantity } = useCart();
  const productId = product.detailId ?? product.id;
  const productCartItems = cartItems.filter(
    (item) => item.detailId === productId,
  );

  const variants = product.variants ?? [];
  const productImages = (
    product.images && product.images.length > 0 ? product.images : [product.image]
  ).filter((imagePath): imagePath is string => Boolean(imagePath && imagePath.trim()));
  const normalizedActiveImageIndex =
    activeImageIndex >= productImages.length ? 0 : activeImageIndex;
  const activeImage =
    productImages[normalizedActiveImageIndex] ||
    (product.image && product.image.trim() ? product.image : undefined);

  const normalizeImagePath = (value: string | undefined) =>
    (value ?? '')
      .split('?')[0]
      .replace(/-(thumb|detail|zoom)(\.[a-z0-9]+)$/i, '$2');

  const selectedVariant =
    variants.find(
      (variant) =>
        (variant.images ?? [variant.image]).some(
          (imagePath) =>
            normalizeImagePath(imagePath) === normalizeImagePath(activeImage),
        ),
    ) ?? variants[0];
  const selectedBundleOffer =
    (product.bundleOffers ?? [])
      .filter(
        (offer) =>
          offer.isActive &&
          Boolean(selectedVariant?.id) &&
          offer.variantIds.includes(selectedVariant!.id),
      )
      .sort((a, b) => {
        if (b.discountPercent !== a.discountPercent) {
          return b.discountPercent - a.discountPercent;
        }
        return b.minTotalQty - a.minTotalQty;
      })[0] ?? null;
  const selectedVariantCartItem = productCartItems.find(
    (item) => item.variantId === selectedVariant?.id,
  );
  const cartImage =
    activeImage ?? selectedVariant?.image ?? product.image ?? '';
  const activeVariantQuantity = selectedVariantCartItem?.quantity ?? 0;
  const hasMultipleImages = productImages.length > 1;
  const activeVariantLabel = selectedVariant
    ? formatVariantLabel(selectedVariant.color, selectedVariant.size)
    : '';
  const activeBundleLabel =
    selectedBundleOffer?.title?.trim() ||
    product.bundleDisplayText?.trim() ||
    '';

  const activePrice = selectedVariant?.price ?? product.price;
  const activeSalePrice = selectedVariant
    ? selectedVariant.salePrice
    : product.salePrice;

  const discount =
    activeSalePrice && activePrice > activeSalePrice
      ? Math.round(((activePrice - activeSalePrice) / activePrice) * 100)
      : 0;

  const handleImageSlide = (direction: 'prev' | 'next') => {
    if (productImages.length === 0) return;
    setActiveImageIndex((current) => {
      if (direction === 'prev') {
        return current === 0 ? productImages.length - 1 : current - 1;
      }
      return current === productImages.length - 1 ? 0 : current + 1;
    });
  };

  return (
    <div className="group flex h-full flex-col">
      <Link
        href={`/products/${product.detailId ?? product.id}`}
        className="flex flex-1 cursor-pointer flex-col"
      >
        <div className="mb-4 rounded-md border border-gray-200 bg-slate-200/45 transition group-hover:border-gray-300">
          <div className="relative m-[6px] aspect-square overflow-hidden bg-white">
            <AnimatePresence mode="wait">
              {activeImage ? (
                <motion.img
                  key={activeImage}
                  src={activeImage}
                  alt={product.name}
                  initial={{ opacity: 0.35, scale: 0.985 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0.35, scale: 1.015 }}
                  transition={{ duration: 0.24, ease: 'easeOut' }}
                  className="h-full w-full object-contain p-2"
                />
              ) : (
                <motion.div
                  key={`${product.id}-image-placeholder`}
                  initial={{ opacity: 0.35, scale: 0.985 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0.35, scale: 1.015 }}
                  transition={{ duration: 0.24, ease: 'easeOut' }}
                  className="flex h-full w-full items-center justify-center p-2 text-[11px] font-medium text-slate-400"
                >
                  No image
                </motion.div>
              )}
            </AnimatePresence>
            {product.badge && (
              <div className="absolute left-2 top-2 rounded-sm bg-[#e85a73] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.04em] text-white">
                {product.badge}
              </div>
            )}
            {discount > 0 && (
              <div className="absolute right-2 top-2 rounded-sm bg-[#1f4db8] px-2 py-1 text-[10px] font-medium text-white">
                -{discount}%
              </div>
            )}
            {hasMultipleImages && (
              <>
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    handleImageSlide('prev');
                  }}
                  className="absolute left-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow transition hover:bg-white"
                  aria-label={`Previous image for ${product.name}`}
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    handleImageSlide('next');
                  }}
                  className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow transition hover:bg-white"
                  aria-label={`Next image for ${product.name}`}
                >
                  ›
                </button>
              </>
            )}
          </div>
        </div>

        <p className="mb-2 min-h-[2.5rem] line-clamp-2 text-center text-[0.8rem] font-normal leading-5 text-gray-900">
          {product.name}
        </p>

        {activeVariantLabel ? (
          <div className="text-center text-[0.72rem] font-medium text-slate-700">
            {activeVariantLabel}
          </div>
        ) : null}
        {activeBundleLabel ? (
          <div className="bundle-title-shine mb-2 bg-gradient-to-r from-purple-800 via-fuchsia-700 to-pink-700 bg-clip-text text-center text-[0.72rem] font-semibold text-transparent">
            {activeBundleLabel}
          </div>
        ) : (
          <div className="mb-2" />
        )}
      </Link>

      <div className="min-h-[52px]">
        <div className="flex min-h-[1.75rem] items-center justify-center gap-2">
          {activeSalePrice ? (
            <>
              <span className="text-[0.85rem] text-gray-500 line-through">
                BDT {activePrice.toFixed(2)}
              </span>
              <span className="text-[0.96rem] font-medium text-gray-900">
                BDT {activeSalePrice.toFixed(2)}
              </span>
            </>
          ) : (
            <span className="text-[0.96rem] font-medium text-gray-900">
              BDT {activePrice.toFixed(2)}
            </span>
          )}
        </div>
      </div>

      <div className="relative mt-4">
        <div
          className="flex w-full items-center justify-between rounded-full border border-[#2d5db3] bg-[#2d5db3] px-4 py-2.5 text-[0.9rem] font-semibold text-white"
          style={{ display: 'flex' }}
        >
          <button
            type="button"
            onClick={() => {
              if (!selectedVariantCartItem) return;
              updateQuantity(
                selectedVariantCartItem.id,
                selectedVariantCartItem.quantity - 1,
              );
            }}
            className="leading-none transition hover:opacity-90"
            style={{ width: '40%' }}
            aria-label={`Decrease quantity for ${product.name}`}
          >
            -
          </button>
          <span style={{ fontSize: '1.12rem', lineHeight: 1 }}>
            {activeVariantQuantity}
          </span>
          <button
            type="button"
            onClick={() => {
              if (!selectedVariantCartItem) {
                addToCart(
                  {
                    ...product,
                    variantId: selectedVariant?.id,
                    variantLabel: activeVariantLabel,
                    image: cartImage,
                    price: activePrice,
                    salePrice: activeSalePrice,
                    bundleOffers: product.bundleOffers,
                    hasActiveBundleOffer: product.hasActiveBundleOffer,
                    bundleMinTotalQty: product.bundleMinTotalQty,
                    bundleDiscountPercent: product.bundleDiscountPercent,
                    bundleDisplayText: product.bundleDisplayText,
                  },
                  1,
                );
                return;
              }
              updateQuantity(
                selectedVariantCartItem.id,
                selectedVariantCartItem.quantity + 1,
              );
            }}
            className="leading-none transition hover:opacity-90"
            style={{ width: '40%' }}
            aria-label={`Increase quantity for ${product.name}`}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
  const formatVariantLabel = (color?: string, size?: string) =>
    [color?.trim(), size?.trim()].filter(Boolean).join(' / ');
