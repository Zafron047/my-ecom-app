'use client';

import ProductCard from '@/components/ProductCard';
import HeroSlider from '@/components/HeroSlider';
import { catalogProducts } from '@/data/products';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

export default function Home() {
  const [failedCategoryImages, setFailedCategoryImages] = useState<
    Record<string, boolean>
  >({});
  const [visibleProductCount, setVisibleProductCount] = useState(18);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Sample products data
  const featuredProducts = catalogProducts.slice(0, 6);
  const featuredDisplayProducts = featuredProducts.map(
    ({ salePrice: _salePrice, badge: _badge, ...product }) => product,
  );
  const allProducts = Array.from({ length: 200 }, (_, index) => {
    const product = catalogProducts[index % catalogProducts.length];

    return {
      ...product,
      id: `more-to-love-${index + 1}`,
      detailId: product.id,
    };
  });
  const superSaleProducts = catalogProducts
    .filter((product) => product.superSale)
    .slice(0, 5);

  const categories = [
    {
      name: 'Gadgets',
      image:
        'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&h=400&fit=crop',
    },
    {
      name: 'Home Finds',
      image:
        'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=400&h=400&fit=crop',
    },
    {
      name: 'Car Accessories',
      image:
        'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=400&h=400&fit=crop',
    },
    {
      name: 'Office Setup',
      image:
        'https://images.unsplash.com/photo-1496171367470-9ed9a91ea931?w=400&h=400&fit=crop',
    },
    {
      name: 'Kitchen Picks',
      image:
        'https://images.unsplash.com/photo-1577937927133-66ef06acdf18?w=400&h=400&fit=crop',
    },
    {
      name: 'Beauty Tools',
      image:
        'https://images.unsplash.com/photo-1522337660859-02fbefca4702?w=400&h=400&fit=crop',
    },
    {
      name: 'Pet Essentials',
      image:
        'https://images.unsplash.com/photo-1517849845537-4d257902454a?w=400&h=400&fit=crop',
    },
    {
      name: 'Travel Gear',
      image:
        'https://images.unsplash.com/photo-1527631746610-bca00a040d60?w=400&h=400&fit=crop',
    },
  ];

  useEffect(() => {
    const target = loadMoreRef.current;

    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];

        if (!entry?.isIntersecting) return;

        setVisibleProductCount((current) =>
          Math.min(current + 18, allProducts.length),
        );
      },
      {
        rootMargin: '0px 0px 420px 0px',
      },
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, [allProducts.length]);

  return (
    <div className="bg-white">
      {/* Hero Slider */}
      <HeroSlider />

      {/* Featured Products */}
      <section
        id="featured"
        className="bg-gradient-to-b from-slate-100 to-white pt-10 pb-16"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-7">
            <div className="mb-3 flex items-center gap-3">
              <span className="h-px w-10 bg-gradient-to-r from-orange-300 via-amber-400 to-orange-500" />
              <span className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 bg-clip-text text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-transparent">
                Fresh Picks
              </span>
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Featured Products
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5 lg:gap-6">
            {featuredDisplayProducts.map((product) => (
              <div key={product.id} className="mx-auto w-full max-w-[230px]">
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Super Sale */}
      <section className="bg-gradient-to-r from-rose-50 via-white to-amber-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-7 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-rose-500">
                Limited-Time Offers
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-gray-900">
                Super Sale
              </h2>
            </div>
            <Link
              href="/collections/super-sale"
              className="inline-flex w-fit items-center rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-600 transition hover:border-rose-300 hover:bg-rose-50"
            >
              Shop all deals
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5 lg:gap-6">
            {superSaleProducts.map((product) => (
              <div key={product.id} className="mx-auto w-full max-w-[230px]">
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="bg-gradient-to-b from-slate-100 to-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-7">
            Categories
          </h2>
          <div className="mx-auto flex max-w-[880px] flex-wrap justify-center gap-5">
            {categories.map((category) => (
              <Link
                key={category.name}
                href="#"
                className="w-[140px] md:w-[160px]"
              >
                <div className="group flex flex-col items-center text-center">
                  {(() => {
                    const showFallback =
                      !category.image || failedCategoryImages[category.name];

                    return (
                      <>
                        <div className="aspect-square w-36 overflow-hidden rounded-full border border-gray-200 bg-slate-100 p-1 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md">
                          {!showFallback ? (
                            <img
                              src={category.image}
                              alt={category.name}
                              className="h-full w-full rounded-full object-cover transition-transform duration-300 group-hover:scale-105"
                              onError={() =>
                                setFailedCategoryImages((current) => ({
                                  ...current,
                                  [category.name]: true,
                                }))
                              }
                            />
                          ) : (
                            <div className="grid h-full w-full place-items-center rounded-full bg-gradient-to-br from-slate-100 via-white to-slate-200 p-4 text-center">
                              <span className="block max-w-[80%] text-center text-[0.7rem] font-medium leading-4 text-slate-600">
                                {category.name}
                              </span>
                            </div>
                          )}
                        </div>
                        <p className="mt-4 text-[0.86rem] font-normal leading-5 text-gray-900">
                          {category.name}
                        </p>
                      </>
                    );
                  })()}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* All Products */}
      <section className="bg-gradient-to-b from-slate-100 to-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-7">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">
              More to love
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5 lg:gap-6">
            {allProducts.slice(0, visibleProductCount).map((product) => (
              <div key={product.id} className="mx-auto w-full max-w-[230px]">
                <ProductCard product={product} />
              </div>
            ))}
          </div>

          {visibleProductCount < allProducts.length && (
            <div ref={loadMoreRef} className="mt-8 flex justify-center py-6">
              <span className="text-sm text-gray-400">
                Loading more products...
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Shipping Info */}
      <section className="bg-gradient-to-b from-[#f8fbff] via-white to-[#f7f9fc] py-6">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-[28px] border border-blue-100/80 bg-white shadow-[0_16px_45px_rgba(15,23,42,0.06)]">
            <div className="border-b border-blue-50 bg-gradient-to-r from-[#eef5ff] via-white to-[#fff7fb] px-5 py-4 sm:px-7">
              <div className="text-center">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-blue-600">
                  Delivery Coverage
                </p>
                <div className="mt-1 text-[1.15rem] font-semibold text-gray-900">
                  Shipping info
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 px-4 py-4 sm:px-5 md:grid-cols-3 md:gap-4 md:py-5">
              <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-[#f7fbff] to-white px-4 py-4 text-center shadow-sm">
                <div className="mb-2 inline-flex rounded-full bg-blue-100 px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-blue-700">
                  Inside City
                </div>
                <div className="mb-1 text-[1.05rem] font-bold text-blue-600">
                  Dhaka City
                </div>
                <p className="text-[0.76rem] font-medium text-slate-600">
                  24hrs 80/-
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-center shadow-sm">
                <div className="mb-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-slate-700">
                  Regional
                </div>
                <div className="mb-1 text-[1.05rem] font-bold text-blue-600">
                  Dhaka Division
                </div>
                <p className="text-[0.76rem] font-medium text-slate-600">
                  24 - 48hrs 120/-
                </p>
              </div>

              <div className="rounded-2xl border border-rose-100 bg-gradient-to-br from-white to-rose-50 px-4 py-4 text-center shadow-sm">
                <div className="mb-2 inline-flex rounded-full bg-rose-100 px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-rose-700">
                  Nationwide
                </div>
                <div className="mb-1 text-[1.05rem] font-bold text-blue-600">
                  Outer Dhaka
                </div>
                <p className="text-[0.76rem] font-medium text-slate-600">
                  72 - 96hrs 150/-
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
