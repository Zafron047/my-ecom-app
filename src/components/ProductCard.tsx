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
  badge?: string;
  variants: {
    id: string;
    color: string;
    size: string;
    price: number;
    salePrice?: number;
    image: string;
  }[];
}

export default function ProductCard({ product }: { product: Product }) {
  const [activeVariantIndex, setActiveVariantIndex] = useState(0);
  const { cartItems, addToCart, updateQuantity } = useCart();
  const productId = product.detailId ?? product.id;
  const productCartItems = cartItems.filter(
    (item) => item.detailId === productId,
  );

  const variants = product.variants ?? [];
  const fallbackVariant = variants[0];
  const selectedVariant = variants[activeVariantIndex] ?? fallbackVariant;
  const selectedVariantCartItem = productCartItems.find(
    (item) => item.variantId === selectedVariant?.id,
  );
  const activeVariantQuantity = selectedVariantCartItem?.quantity ?? 0;
  const hasVariants = variants.length > 1;
  const activeVariantLabel = selectedVariant
    ? `${selectedVariant.color} / ${selectedVariant.size}`
    : 'Standard';

  const activeImage = selectedVariant?.image || product.image;
  const activePrice = selectedVariant?.price ?? product.price;
  const activeSalePrice = selectedVariant?.salePrice ?? product.salePrice;

  const discount =
    activeSalePrice && activePrice > activeSalePrice
      ? Math.round(((activePrice - activeSalePrice) / activePrice) * 100)
      : 0;

  const handleVariantSlide = (direction: 'prev' | 'next') => {
    if (variants.length === 0) return;
    setActiveVariantIndex((current) => {
      if (direction === 'prev') {
        return current === 0 ? variants.length - 1 : current - 1;
      }
      return current === variants.length - 1 ? 0 : current + 1;
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
              <motion.img
                key={activeImage || `${product.id}-fallback-image`}
                src={activeImage}
                alt={product.name}
                initial={{ opacity: 0.35, scale: 0.985 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0.35, scale: 1.015 }}
                transition={{ duration: 0.24, ease: 'easeOut' }}
                className="h-full w-full object-contain p-2"
              />
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
          </div>
        </div>

        <p className="mb-2 min-h-[2.5rem] line-clamp-2 text-center text-[0.8rem] font-normal leading-5 text-gray-900">
          {product.name}
        </p>

        <div className="mb-2 flex items-center justify-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-blue-700">
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              handleVariantSlide('prev');
            }}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!hasVariants}
            aria-label={`Previous variant for ${product.name}`}
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <span className="min-w-[7.5rem] truncate text-center normal-case tracking-normal text-slate-700">
            {activeVariantLabel}
          </span>
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              handleVariantSlide('next');
            }}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!hasVariants}
            aria-label={`Next variant for ${product.name}`}
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>
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
                    image: activeImage,
                    price: activePrice,
                    salePrice: activeSalePrice,
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
