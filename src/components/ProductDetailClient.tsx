'use client';

import { useCart } from '@/components/CartProvider';
import { toVariantImageUrl } from '@/lib/image-variants';
import { trackMetaEvent } from '@/lib/meta-pixel';
import type {
  StorefrontCatalogProduct,
  StorefrontProductDetail,
} from '@/lib/storefront-types';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

function isValidColorHex(value: string | undefined) {
  return Boolean(value && /^#[0-9a-f]{6}$/i.test(value));
}

interface ProductDetailClientProps {
  product: StorefrontProductDetail;
  relatedProducts: StorefrontCatalogProduct[];
}

export default function ProductDetailClient({
  product,
  relatedProducts,
}: ProductDetailClientProps) {
  const { addToCart, cartItems, updateQuantity } = useCart();
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
  const canIncreaseActiveVariant =
    Boolean(activeVariant) && activeVariantQuantity < activeStockQuantity;
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

  useEffect(() => {
    trackMetaEvent('ViewContent', {
      content_ids: [activeVariant?.id ?? product.id],
      content_name: product.name,
      content_type: 'product',
      contents: [
        {
          id: activeVariant?.id ?? product.id,
          item_price: activeSalePrice ?? activePrice,
          quantity: 1,
        },
      ],
      currency: 'BDT',
      value: activeSalePrice ?? activePrice,
    });
  }, [activePrice, activeSalePrice, activeVariant?.id, product.id, product.name]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <nav className="mb-8 flex items-center space-x-2 text-sm">
        <Link href="/" className="text-blue-600 hover:text-blue-700">
          Home
        </Link>
        <span className="text-gray-400">/</span>
        <Link href="/products" className="text-blue-600 hover:text-blue-700">
          Products
        </Link>
        <span className="text-gray-400">/</span>
        <span className="text-gray-600">{product.name}</span>
      </nav>

      <div className="mb-16 grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="self-start lg:sticky lg:top-28">
          <div className="relative z-20 mb-4">
            <div
              className="relative z-20 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
              style={{ width: DETAIL_BOX_SIZE, height: DETAIL_BOX_SIZE }}
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
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resolvedSelectedImage}
                  alt={product.name}
                  className={`h-full w-full object-cover transition-opacity duration-150 ${isZooming ? 'opacity-0' : 'opacity-100'}`}
                  onError={() =>
                    setFallbackImageSet((current) => ({
                      ...current,
                      [selectedImage]: true,
                    }))
                  }
                />
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
                  className="pointer-events-none absolute rounded-md border border-blue-500/90 bg-blue-200/15 shadow-[0_0_0_1px_rgba(255,255,255,0.7)] backdrop-blur-[1px]"
                  style={{
                    width: LENS_SIZE,
                    height: LENS_SIZE,
                    transform: `translate(${zoomLensX}px, ${zoomLensY}px)`,
                  }}
                />
              )}
              {safeSelectedImage && (
                <div className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-slate-900/75 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white">
                  Zoom
                </div>
              )}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {normalizedImages.map((image, index) => (
              <button
                key={`${image}-${index}`}
                onClick={() => setSelectedImage(index)}
                className={`h-20 w-20 overflow-hidden rounded-md border-2 transition ${
                  selectedImage === index
                    ? 'border-blue-600'
                    : 'border-gray-200 hover:border-gray-300'
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
              </button>
            ))}
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
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h1 className="mb-2 text-3xl font-bold text-gray-900">{product.name}</h1>
              <p className="mb-1 bg-gradient-to-r from-violet-600 via-blue-600 to-cyan-500 bg-clip-text text-xs font-semibold uppercase tracking-[0.08em] text-transparent">
                {product.category}
              </p>
            </div>
            {discount > 0 && (
              <div className="bg-red-500 text-white px-3 py-1 rounded font-semibold">
                -{discount}%
              </div>
            )}
          </div>

          <div className="mb-6">
            <div className="flex items-baseline gap-3 mb-2">
              {activeSalePrice ? (
                <>
                  <span className="text-3xl font-bold text-gray-900">
                    <span className="bg-gradient-to-r from-emerald-600 to-lime-500 bg-clip-text text-transparent">
                      BDT {activeSalePrice.toFixed(2)}
                    </span>
                  </span>
                  <span className="text-lg text-gray-500 line-through">
                    <span className="bg-gradient-to-r from-rose-600 to-orange-500 bg-clip-text text-transparent">
                      BDT {activePrice.toFixed(2)}
                    </span>
                  </span>
                </>
              ) : (
                <span className="text-3xl font-bold text-gray-900">
                  <span className="bg-gradient-to-r from-emerald-600 to-lime-500 bg-clip-text text-transparent">
                    BDT {activePrice.toFixed(2)}
                  </span>
                </span>
              )}
            </div>
            <p className={isActiveVariantInStock ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
              {isActiveVariantInStock ? 'In Stock' : 'Out of Stock'}
            </p>
          </div>

          {product.variants.length > 0 && (
            <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
              <p className="mb-3 text-sm font-semibold text-slate-900">
                Color
              </p>
              <div className="flex flex-wrap gap-2">
                {variantGroups.map((group) => (
                  <button
                    key={group.color}
                    type="button"
                    onClick={() => selectVariantAtIndex(group.indexes[0] ?? 0)}
                    className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition ${
                      group === activeVariantGroup
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-300 bg-white text-slate-700 hover:border-blue-300'
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
                  </button>
                ))}
              </div>
              {activeVariantGroup ? (
                <div className="mt-4">
                  <p className="mb-3 text-sm font-semibold text-slate-900">
                    Size
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {activeVariantGroup.indexes.map((index) => {
                      const variant = product.variants[index];
                      if (!variant) return null;

                      return (
                        <button
                          key={variant.id}
                          type="button"
                          onClick={() => selectVariantAtIndex(index)}
                          className={`min-w-12 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                            index === selectedVariantIndex
                              ? 'border-blue-600 bg-white text-blue-700 ring-2 ring-blue-100'
                              : 'border-slate-300 bg-white text-slate-700 hover:border-blue-300'
                          }`}
                        >
                          {variant.size?.trim() || 'Default'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white">
                  <button
                    type="button"
                    onClick={() => {
                      if (!activeVariantCartItem) return;
                      updateQuantity(activeVariantCartItem.id, activeVariantCartItem.quantity - 1);
                    }}
                    className="px-4 py-2 text-lg leading-none text-slate-700 transition hover:bg-slate-100"
                    aria-label="Decrease quantity"
                  >
                    -
                  </button>
                  <span className="min-w-10 text-center text-sm font-semibold text-slate-900">
                    {activeVariantQuantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (!canIncreaseActiveVariant) return;
                      if (!activeVariantCartItem) {
                        addToCart(
                          {
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
                          },
                          1,
                        );
                        return;
                      }
                      updateQuantity(activeVariantCartItem.id, activeVariantCartItem.quantity + 1);
                    }}
                    disabled={!canIncreaseActiveVariant}
                    className="px-4 py-2 text-lg leading-none text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>

                <button className="rounded-lg border-2 border-blue-600 px-4 py-2.5 text-sm font-semibold text-blue-600 transition hover:bg-blue-50">
                  Wishlist
                </button>
              </div>
            </div>
          )}

          <div className="mb-6">
            <button
              type="button"
              onClick={() => {
                if (!canIncreaseActiveVariant) return;
                addToCart(
                  {
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
                  },
                  1,
                );
              }}
              disabled={!canIncreaseActiveVariant}
              className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {activeStockQuantity <= 0 ? 'Out of Stock' : 'Add to Cart'}
            </button>
          </div>

          {product.bundleOffers.length > 0 && (
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
              <h3 className="mb-4 text-lg font-semibold text-amber-900">Bundle Offers</h3>
              <div className="space-y-3">
                {visibleBundleOffers.map((offer) => (
                  <div
                    key={offer.id}
                    className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 rounded-lg border border-amber-200 bg-white px-3 py-2"
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
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{offer.title}</p>
                      <p className="text-xs text-slate-700">
                        Buy at least {offer.minTotalQty} eligible pcs and get{' '}
                        {offer.discountPercent}% off
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {product.bundleOffers.length > 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setAreBundleOffersExpanded((current) => !current)
                  }
                  className="mt-3 text-sm font-semibold text-amber-800 transition hover:text-amber-900"
                >
                  {areBundleOffersExpanded
                    ? 'See fewer offers'
                    : `See ${hiddenBundleOfferCount} more offer${hiddenBundleOfferCount === 1 ? '' : 's'}`}
                </button>
              ) : null}
            </div>
          )}

          <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Specifications</h3>
            <div className="space-y-2">
              {product.specs.map((spec, index) => (
                <div
                  key={`${spec.name}-${index}`}
                  className="grid grid-cols-[minmax(120px,0.9fr)_minmax(0,1.1fr)] gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                >
                  <p className="text-sm font-semibold text-slate-700">{spec.name}</p>
                  <p className="text-sm text-slate-900">{spec.value}</p>
                </div>
              ))}
            </div>
          </div>

          {descriptionText ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="mb-3 text-lg font-semibold text-gray-900">
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
                  className="mt-3 text-sm font-semibold text-blue-600 transition hover:text-blue-700"
                >
                  {isDescriptionExpanded ? 'See less' : 'See more...'}
                </button>
              ) : null}
            </div>
          ) : null}

        </div>
      </div>

      <section className="mt-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-8">Related Products</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {relatedProducts.map((relatedProduct) => (
            <Link key={relatedProduct.id} href={`/products/${relatedProduct.id}`} className="group cursor-pointer">
              <div className="relative overflow-hidden bg-gray-100 aspect-square rounded-lg mb-3">
                {relatedProduct.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={relatedProduct.image}
                    alt={relatedProduct.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center text-xs font-semibold text-slate-500">
                    No image
                  </div>
                )}
              </div>
              <h3 className="text-sm font-medium text-gray-900 line-clamp-2 mb-2">
                {relatedProduct.name}
              </h3>
              <span className="text-gray-900 font-semibold">
                BDT {(relatedProduct.salePrice ?? relatedProduct.price).toFixed(2)}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}


