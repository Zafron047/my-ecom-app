'use client';

import { useCart } from '@/components/CartProvider';
import Image from 'next/image';
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
    stockQuantity: number;
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

type ProductCardVariant = 'showcase' | 'catalog';

export default function ProductCard({
  product,
  variant = 'showcase',
}: {
  product: Product;
  variant?: ProductCardVariant;
}) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const { cartItems, addToCart, updateQuantity } = useCart();
  const isCatalog = variant === 'catalog';
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

  const tiedVariants = variants.filter((variant) =>
    getExplicitVariantImages(variant).some(
      (imagePath) =>
        normalizeImagePath(imagePath) === normalizeImagePath(activeImage),
    ),
  );
  const hasVariantChoice =
    tiedVariants.length > 1 || (tiedVariants.length === 0 && variants.length > 1);
  const choiceVariants = tiedVariants.length > 1 ? tiedVariants : variants;
  const tiedVariant = tiedVariants.length === 1 ? tiedVariants[0] : null;
  const selectedVariant = hasVariantChoice ? undefined : tiedVariant ?? variants[0];
  const selectedBundleOffer =
    hasVariantChoice
      ? null
      : (product.bundleOffers ?? [])
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
  const activeVariantLabel = hasVariantChoice
    ? `${choiceVariants.length} variants`
    : tiedVariant
      ? formatVariantLabel(tiedVariant.color, tiedVariant.size)
      : '';
  const cartVariantLabel = selectedVariant
    ? formatVariantLabel(selectedVariant.color, selectedVariant.size)
    : '';
  const activeBundleLabel =
    selectedBundleOffer?.title?.trim() ||
    product.bundleDisplayText?.trim() ||
    '';

  const variantChoicePriceRange = hasVariantChoice
    ? getVariantPriceRange(choiceVariants)
    : null;
  const activePrice = variantChoicePriceRange?.min ?? selectedVariant?.price ?? product.price;
  const activeSalePrice = hasVariantChoice
    ? undefined
    : selectedVariant
      ? selectedVariant.salePrice
      : product.salePrice;
  const activeStockQuantity = hasVariantChoice
    ? choiceVariants.reduce((total, variant) => total + variant.stockQuantity, 0)
    : selectedVariant?.stockQuantity ?? 0;
  const isActiveVariantSoldOut = !hasVariantChoice && activeStockQuantity <= 0;
  const canIncreaseActiveVariant =
    !hasVariantChoice &&
    Boolean(selectedVariant) &&
    activeVariantQuantity < activeStockQuantity;

  const discount =
    !hasVariantChoice && activeSalePrice && activePrice > activeSalePrice
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
    <div
      className={`group flex h-full flex-col border border-zinc-200/80 bg-white ring-1 ring-transparent transition duration-300 hover:border-zinc-300 ${
        isCatalog
          ? 'rounded-xl shadow-[0_8px_24px_rgba(24,24,27,0.04)] hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(24,24,27,0.07)]'
          : 'rounded-xl shadow-[0_12px_34px_rgba(24,24,27,0.055)] hover:-translate-y-1 hover:shadow-[0_18px_46px_rgba(24,24,27,0.09)]'
      }`}
    >
      <Link
        href={`/products/${product.detailId ?? product.id}`}
        className="flex flex-1 cursor-pointer flex-col"
      >
        <div
          className={`overflow-hidden rounded-t-xl bg-zinc-50 ring-1 ring-zinc-900/5 transition group-hover:bg-zinc-100 sm:rounded-t-2xl ${
            isCatalog ? 'mb-2' : 'mb-2.5 sm:mb-4'
          }`}
        >
          <div
            className={`relative overflow-hidden rounded-t-xl sm:rounded-t-2xl ${
              isCatalog ? 'aspect-[1/0.9]' : 'aspect-square'
            }`}
          >
            {activeImage ? (
              <Image
                key={activeImage}
                src={activeImage}
                alt={product.name}
                fill
                sizes={
                  isCatalog
                    ? '(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw'
                    : '(min-width: 1536px) 15vw, (min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw'
                }
                className={`object-contain transition duration-500 group-hover:scale-[1.16] ${
                  isCatalog ? 'p-1' : 'p-0'
                }`}
              />
            ) : (
              <div
                key={`${product.id}-image-placeholder`}
                className="flex h-full w-full items-center justify-center p-2 text-[11px] font-medium text-slate-400"
              >
                No image
              </div>
            )}
            {(isActiveVariantSoldOut || product.badge) && (
              <div
                className={`absolute left-2 top-2 rounded-sm font-medium uppercase tracking-[0.04em] text-white ${
                  isActiveVariantSoldOut ? 'bg-zinc-950' : 'bg-rose-500'
                } ${isCatalog ? 'px-1.5 py-0.5 text-[8.5px]' : 'px-2 py-1 text-[10px]'}`}
              >
                {isActiveVariantSoldOut ? 'Sold Out' : product.badge}
              </div>
            )}
            {discount > 0 && (
              <div
                className={`absolute right-2 top-2 rounded-full bg-zinc-950 font-semibold text-white shadow-sm ${
                  isCatalog ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[10px]'
                }`}
              >
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
                  className={`absolute left-2 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white/90 text-slate-700 shadow-sm backdrop-blur transition hover:bg-white ${
                    isCatalog ? 'h-6 w-6 text-xs' : 'h-7 w-7'
                  }`}
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
                  className={`absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white/90 text-slate-700 shadow-sm backdrop-blur transition hover:bg-white ${
                    isCatalog ? 'h-6 w-6 text-xs' : 'h-7 w-7'
                  }`}
                  aria-label={`Next image for ${product.name}`}
                >
                  ›
                </button>
              </>
            )}
          </div>
        </div>

        <p
          className={`line-clamp-2 px-1.5 text-center font-medium text-zinc-900 ${
            isCatalog
              ? 'mb-1 min-h-[2.35rem] text-[0.78rem] leading-[1.15rem] sm:text-[0.86rem] sm:leading-5'
              : 'mb-2 min-h-[2.6rem] text-[0.82rem] leading-5 sm:text-[0.88rem]'
          }`}
        >
          {product.name}
        </p>

        {activeVariantLabel ? (
          <div
            className={`text-center font-medium text-zinc-500 ${
              isCatalog ? 'text-[0.66rem] leading-4' : 'text-[0.72rem] leading-5'
            }`}
          >
            {activeVariantLabel}
          </div>
        ) : null}
        {activeBundleLabel ? (
          <div
              className={`bundle-title-shine bg-gradient-to-r from-zinc-950 via-zinc-700 to-zinc-950 bg-clip-text px-2 text-center font-semibold text-transparent ${
              isCatalog ? 'mb-1 text-[0.66rem] leading-4' : 'mb-2 text-[0.72rem] leading-5'
            }`}
          >
            {activeBundleLabel}
          </div>
        ) : (
          <div className={isCatalog ? 'mb-1' : 'mb-2'} />
        )}
      </Link>

      <div className={isCatalog ? 'min-h-[32px]' : 'min-h-[44px]'}>
        <div
          className={`flex items-center justify-center gap-2 ${
            isCatalog ? 'min-h-[1.45rem]' : 'min-h-[1.75rem]'
          }`}
        >
          {variantChoicePriceRange ? (
            <span
              className={`text-center font-semibold text-zinc-950 ${
                isCatalog ? 'text-[0.82rem] leading-tight' : 'text-[0.95rem]'
              }`}
            >
              {formatVariantPriceRange(variantChoicePriceRange)}
            </span>
          ) : activeSalePrice ? (
            <>
              <span
                className={`text-zinc-400 line-through ${
                  isCatalog ? 'text-[0.68rem]' : 'text-[0.78rem]'
                }`}
              >
                BDT {activePrice.toFixed(2)}
              </span>
              <span
                className={`font-semibold text-zinc-950 ${
                  isCatalog ? 'text-[0.84rem]' : 'text-[0.98rem]'
                }`}
              >
                BDT {activeSalePrice.toFixed(2)}
              </span>
            </>
          ) : (
            <span
              className={`font-semibold text-zinc-950 ${
                isCatalog ? 'text-[0.84rem]' : 'text-[0.98rem]'
              }`}
            >
              BDT {activePrice.toFixed(2)}
            </span>
          )}
        </div>
      </div>

      <div className={`relative ${isCatalog ? 'mt-2' : 'mt-3.5 sm:mt-4'}`}>
        {hasVariantChoice ? (
          <Link
            href={`/products/${product.detailId ?? product.id}`}
            className={`flex w-full items-center justify-center rounded-lg border border-zinc-300 bg-white font-medium uppercase tracking-[0.08em] text-zinc-900 transition visited:text-zinc-900 hover:border-zinc-950 hover:bg-zinc-950 hover:!text-white ${
              isCatalog
                ? 'min-h-10 px-3 py-2 text-[0.6rem]'
                : 'px-4 py-[0.58rem] text-[0.68rem]'
            }`}
          >
            See details
          </Link>
        ) : isActiveVariantSoldOut ? (
          <div
            className={`flex w-full items-center justify-center rounded-lg border border-slate-300 bg-slate-100 font-medium uppercase tracking-[0.08em] text-slate-500 ${
              isCatalog
                ? 'min-h-10 px-3 py-2 text-[0.62rem]'
                : 'px-4 py-[0.58rem] text-[0.7rem]'
            }`}
          >
            Sold Out
          </div>
        ) : (
        <div
          className={`flex w-full items-center justify-between rounded-lg border border-zinc-900 bg-zinc-900 font-medium text-white shadow-[0_7px_18px_rgba(24,24,27,0.12)] transition group-hover:bg-zinc-950 ${
            isCatalog
              ? 'min-h-10 px-3 py-2 text-[0.76rem]'
              : 'px-4 py-[0.58rem] text-[0.82rem]'
          }`}
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
          <span style={{ fontSize: isCatalog ? '0.98rem' : '1.12rem', lineHeight: 1 }}>
            {activeVariantQuantity}
          </span>
          <button
            type="button"
            onClick={() => {
              if (!canIncreaseActiveVariant) return;
              if (!selectedVariantCartItem) {
                addToCart(
                  {
                    ...product,
                    variantId: selectedVariant?.id,
                    variantLabel: cartVariantLabel,
                    image: cartImage,
                    price: activePrice,
                    salePrice: activeSalePrice,
                    stockQuantity: activeStockQuantity,
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
            disabled={!canIncreaseActiveVariant}
            className="leading-none transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
            style={{ width: '40%' }}
            aria-label={`Increase quantity for ${product.name}`}
          >
            +
          </button>
        </div>
        )}
      </div>
    </div>
  );
}

const getExplicitVariantImages = (variant: Product['variants'][number]) =>
  variant.images?.filter((imagePath) => Boolean(imagePath?.trim())) ?? [];

function getVariantPriceRange(variants: Product['variants']) {
  const prices = variants
    .map((variant) => variant.salePrice ?? variant.price)
    .filter((price) => Number.isFinite(price));

  if (prices.length === 0) return null;

  return {
    max: Math.max(...prices),
    min: Math.min(...prices),
  };
}

function formatVariantPriceRange({
  max,
  min,
}: {
  max: number;
  min: number;
}) {
  if (min === max) return `BDT ${min.toFixed(2)}`;
  return `BDT ${min.toFixed(2)} - BDT ${max.toFixed(2)}`;
}

const formatVariantLabel = (color?: string, size?: string) =>
  [color?.trim(), size?.trim()].filter(Boolean).join(' / ');
