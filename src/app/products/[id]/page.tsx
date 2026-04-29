'use client';

import { useCart } from '@/components/CartProvider';
import { toVariantImageUrl } from '@/lib/image-variants';
import type {
  StorefrontCatalogProduct,
  StorefrontProductDetail,
} from '@/lib/storefront-types';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

export default function ProductDetail() {
  const params = useParams<{ id: string }>();
  const productId = params?.id;
  const { addToCart, cartItems, updateQuantity } = useCart();
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [isZooming, setIsZooming] = useState(false);
  const [zoomLensX, setZoomLensX] = useState(0);
  const [zoomLensY, setZoomLensY] = useState(0);
  const [product, setProduct] = useState<StorefrontProductDetail | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<StorefrontCatalogProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notFoundState, setNotFoundState] = useState(false);
  const [fallbackImageSet, setFallbackImageSet] = useState<Record<number, boolean>>(
    {},
  );
  const [zoomFallbackImageSet, setZoomFallbackImageSet] = useState<Record<number, boolean>>(
    {},
  );

  useEffect(() => {
    if (!productId) return;
    let isMounted = true;

    async function loadProduct() {
      setIsLoading(true);
      try {
        const [productResponse, catalogResponse] = await Promise.all([
          fetch(`/api/storefront/products/${productId}`),
          fetch('/api/storefront/catalog'),
        ]);

        if (!isMounted) return;

        if (productResponse.status === 404) {
          setNotFoundState(true);
          setIsLoading(false);
          return;
        }

        if (!productResponse.ok) {
          setIsLoading(false);
          return;
        }

        const productPayload = (await productResponse.json()) as StorefrontProductDetail;
        setProduct(productPayload);

        if (catalogResponse.ok) {
          const catalogPayload = (await catalogResponse.json()) as {
            products: StorefrontCatalogProduct[];
          };
          setRelatedProducts(
            (catalogPayload.products ?? [])
              .filter((catalogProduct) => catalogProduct.id !== productPayload.id)
              .slice(0, 4),
          );
        }
      } catch {
        if (!isMounted) return;
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadProduct();

    return () => {
      isMounted = false;
    };
  }, [productId]);

  const activeVariant = useMemo(
    () => product?.variants?.[selectedVariantIndex],
    [product, selectedVariantIndex],
  );
  const productCartItems = useMemo(
    () => cartItems.filter((item) => item.detailId === product?.id),
    [cartItems, product?.id],
  );
  const activeVariantCartItem = useMemo(
    () =>
      productCartItems.find((item) =>
        activeVariant?.id ? item.variantId === activeVariant.id : false,
      ),
    [activeVariant?.id, productCartItems],
  );
  const activeVariantQuantity = activeVariantCartItem?.quantity ?? 0;
  const activePrice = activeVariant?.price ?? product?.price ?? 0;
  const activeSalePrice = activeVariant?.salePrice ?? product?.salePrice;
  const discount = useMemo(() => {
    if (!activeSalePrice || activePrice <= activeSalePrice) return 0;
    return Math.round(((activePrice - activeSalePrice) / activePrice) * 100);
  }, [activePrice, activeSalePrice]);

  if (notFoundState) {
    notFound();
  }

  if (isLoading || !product) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center text-slate-500">
        Loading product...
      </div>
    );
  }

  const safeSelectedImage = product.images[selectedImage] ?? product.image;
  const resolvedSelectedImage = fallbackImageSet[selectedImage]
    ? safeSelectedImage
    : toVariantImageUrl(safeSelectedImage, 'detail');
  const zoomSelectedImage = zoomFallbackImageSet[selectedImage]
    ? safeSelectedImage
    : toVariantImageUrl(safeSelectedImage, 'zoom');
  const DETAIL_BOX_SIZE = 584;
  const LENS_SIZE = 140;
  const ZOOM_SCALE = 2.2;
  const toOriginalFromVariantUrl = (imageUrl: string) =>
    imageUrl.replace(/-(thumb|detail|zoom)\.webp$/i, (match) =>
      match.includes('.webp') ? '.webp' : match,
    );

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
            {product.images.map((image, index) => (
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
                  src={fallbackImageSet[index] ? image : toVariantImageUrl(image, 'detail')}
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
          {/* Preload zoom variant once selected; fallback to original if missing */}
          {safeSelectedImage ? (
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
            <p className={product.inStock ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
              {product.inStock ? 'In Stock' : 'Out of Stock'}
            </p>
          </div>

          {product.variants.length > 0 && (
            <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
              <p className="mb-3 text-sm font-semibold text-slate-900">Variants</p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((variant, index) => (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => {
                      setSelectedVariantIndex(index);
                      const variantImage = variant.image;
                      const imageIndex = product.images.findIndex(
                        (img) =>
                          img === variantImage ||
                          toVariantImageUrl(img, 'thumb') === variantImage ||
                          img === toOriginalFromVariantUrl(variantImage),
                      );
                      setSelectedImage(imageIndex >= 0 ? imageIndex : 0);
                    }}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      index === selectedVariantIndex
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-300 bg-white text-slate-700 hover:border-blue-300'
                    }`}
                  >
                    {variant.color} / {variant.size}
                  </button>
                ))}
              </div>

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
                      if (!activeVariantCartItem) {
                        addToCart(
                          {
                            id: product.id,
                            detailId: product.id,
                            name: product.name,
                            price: activePrice,
                            salePrice: activeSalePrice,
                            image: activeVariant?.image || product.image,
                            variantId: activeVariant?.id,
                            variantLabel: activeVariant
                              ? `${activeVariant.color} / ${activeVariant.size}`
                              : undefined,
                          },
                          1,
                        );
                        return;
                      }
                      updateQuantity(activeVariantCartItem.id, activeVariantCartItem.quantity + 1);
                    }}
                    className="px-4 py-2 text-lg leading-none text-slate-700 transition hover:bg-slate-100"
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
              onClick={() =>
                addToCart(
                  {
                    id: product.id,
                    detailId: product.id,
                    name: product.name,
                    price: activePrice,
                    salePrice: activeSalePrice,
                    image: activeVariant?.image || product.image,
                    variantId: activeVariant?.id,
                    variantLabel: activeVariant
                      ? `${activeVariant.color} / ${activeVariant.size}`
                      : undefined,
                  },
                  1,
                )
              }
              className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700"
            >
              Add to Cart
            </button>
          </div>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Key Features</h3>
            <ul className="space-y-2.5">
              {product.benefits.map((benefit, index) => (
                <li key={`${benefit}-${index}`} className="flex items-start gap-3 text-gray-700">
                  <span className="mt-1 h-2 w-2 rounded-full bg-green-600" />
                  {benefit}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <section className="mt-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-8">Related Products</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {relatedProducts.map((relatedProduct) => (
            <Link key={relatedProduct.id} href={`/products/${relatedProduct.id}`} className="group cursor-pointer">
              <div className="relative overflow-hidden bg-gray-100 aspect-square rounded-lg mb-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={relatedProduct.image}
                  alt={relatedProduct.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
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


