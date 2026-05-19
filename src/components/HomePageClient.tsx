'use client';

import HomeProductListSection from '@/components/HomeProductListSection';
import HeroSlider from '@/components/HeroSlider';
import { slugifyCategory } from '@/lib/category-slug';
import type {
  StorefrontCatalogProduct,
  StorefrontHomepageSection,
} from '@/lib/storefront-types';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

interface HomePageClientProps {
  catalogProducts: StorefrontCatalogProduct[];
  catalogCategories: string[];
  homepageSections: StorefrontHomepageSection[];
  categoryThumbnails: Record<string, string>;
}

export default function HomePageClient({
  catalogProducts,
  catalogCategories,
  homepageSections,
  categoryThumbnails,
}: HomePageClientProps) {
  const [failedCategoryImages, setFailedCategoryImages] = useState<
    Record<string, boolean>
  >({});
  const [visibleProductCount, setVisibleProductCount] = useState(18);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const allProducts = catalogProducts;

  const computedHomepageSections = useMemo(
    () =>
      homepageSections.map((section) => {
        const sourceValue = section.sourceValue?.trim().toLowerCase();
        const latestThreshold = new Date();
        latestThreshold.setDate(latestThreshold.getDate() - 45);
        const baseProducts =
          section.productIds && section.productIds.length > 0
            ? section.productIds
                .map((id) => catalogProducts.find((product) => product.id === id))
                .filter((product): product is StorefrontCatalogProduct => Boolean(product))
            : section.sourceType === 'super_sale'
              ? catalogProducts.filter((product) => product.superSale)
              : section.sourceType === 'category'
                ? catalogProducts.filter(
                    (product) =>
                      product.category.trim().toLowerCase() === sourceValue,
                  )
                : section.sourceType === 'tag'
                  ? catalogProducts.filter((product) =>
                      product.tags.some(
                        (tag) => tag.trim().toLowerCase() === sourceValue,
                      ),
                    )
                  : section.sourceType === 'latest'
                    ? catalogProducts.filter((product) => {
                        const createdAt = new Date(product.createdAt);
                        return (
                          !Number.isNaN(createdAt.getTime()) && createdAt >= latestThreshold
                        );
                      })
                    : catalogProducts;

        return {
          ...section,
          products: baseProducts.slice(0, Math.max(1, section.productLimit)),
        };
      }),
    [catalogProducts, homepageSections],
  );

  const categories = useMemo(
    () =>
      catalogCategories
        .filter((categoryName) => categoryName !== 'All')
        .map((categoryName) => ({
          name: categoryName,
          image:
            categoryThumbnails[categoryName] ||
            catalogProducts.find((product) => product.category === categoryName)?.image ||
            '',
        })),
    [catalogCategories, catalogProducts, categoryThumbnails],
  );

  useEffect(() => {
    const target = loadMoreRef.current;

    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];

        if (!entry?.isIntersecting) return;

        setVisibleProductCount((current) => Math.min(current + 18, allProducts.length));
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

      {computedHomepageSections.map((section, index) => (
        <div key={section.id} id={index === 0 ? 'featured' : undefined}>
          <HomeProductListSection
            title={section.title}
            products={section.products}
            variant={section.variant}
            layout={section.layout}
            sectionClassName={
              section.variant === 'sale'
                ? 'bg-gradient-to-r from-rose-50 via-white to-amber-50 py-16'
                : index === 0
                  ? 'bg-gradient-to-b from-slate-100 to-white pt-10 pb-16'
                  : 'bg-gradient-to-b from-slate-100 to-white py-16'
            }
            eyebrow={section.eyebrow}
            cta={
              section.ctaLabel && section.ctaHref
                ? { href: section.ctaHref, label: section.ctaLabel }
                : undefined
            }
          />
        </div>
      ))}

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
                href={`/collections/${slugifyCategory(category.name)}`}
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

          <HomeProductListSection
            title="More to love"
            products={allProducts.slice(0, visibleProductCount)}
            sectionClassName="py-0"
          />

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
