'use client';

import HomeProductListSection from '@/components/HomeProductListSection';
import HeroSlider from '@/components/HeroSlider';
import { slugifyCategory } from '@/lib/category-slug';
import { deliveryShippingOptions } from '@/lib/dhaka-delivery-zones';
import type {
  StorefrontCatalogProduct,
  StorefrontHeroSlide,
  StorefrontHomepageSection,
} from '@/lib/storefront-types';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

interface HomePageClientProps {
  catalogProducts: StorefrontCatalogProduct[];
  catalogCategories: string[];
  heroSlides: StorefrontHeroSlide[];
  homepageSections: StorefrontHomepageSection[];
  categoryThumbnails: Record<string, string>;
}

export default function HomePageClient({
  catalogProducts,
  catalogCategories,
  heroSlides,
  homepageSections,
  categoryThumbnails,
}: HomePageClientProps) {
  const [failedCategoryImages, setFailedCategoryImages] = useState<
    Record<string, boolean>
  >({});
  const [visibleProductCount, setVisibleProductCount] = useState(18);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const allProducts = catalogProducts;
  const trustSignals = ['Quality products', 'COD Available', 'Fast Delivery'];

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
    <div className="bg-white text-zinc-950">
      {/* Hero Slider */}
      <HeroSlider slides={heroSlides} />

      <section className="border-b border-zinc-200/70 bg-[linear-gradient(180deg,#fff_0%,#f7f7f8_100%)] pt-4 pb-3 sm:py-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={false}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center justify-center overflow-x-auto whitespace-nowrap rounded-full border border-zinc-200/80 bg-white/82 px-3 py-2 text-[0.72rem] font-semibold tracking-tight text-zinc-700 shadow-[0_10px_28px_rgba(24,24,27,0.045)] [scrollbar-width:none] [-ms-overflow-style:none] sm:px-5 sm:py-2.5 sm:text-xs [&::-webkit-scrollbar]:hidden"
            aria-label="Shopping reassurance"
          >
            {trustSignals.map((signal, index) => (
              <span key={signal} className="inline-flex items-center">
                <span>{signal}</span>
                {index < trustSignals.length - 1 ? (
                  <span className="mx-2 h-1 w-1 rounded-full bg-zinc-300 sm:mx-3" />
                ) : null}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      {computedHomepageSections.map((section, index) => (
        <div key={section.id} id={index === 0 ? 'featured' : undefined}>
          <HomeProductListSection
            title={section.title}
            products={section.products}
            variant={section.variant}
            layout={section.layout}
            sectionClassName={
              section.variant === 'sale'
                  ? 'bg-[linear-gradient(180deg,#fff_0%,#fff7f5_46%,#fff_100%)] py-16 md:py-24'
                : index === 0
                  ? 'bg-[linear-gradient(180deg,#f7f7f8_0%,#fff_46%)] pt-8 pb-14 md:pt-16 md:pb-24'
                  : 'bg-white py-16 md:py-24'
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
      <section className="bg-zinc-950 py-16 text-white md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col gap-3 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.26em] text-white/48">
                Shop by need
              </p>
              <h2 className="mt-3 max-w-xl text-3xl font-semibold leading-[1.02] tracking-tight text-white md:text-5xl">
                Kitchen, decor & daily essentials
              </h2>
            </div>
            <p className="max-w-md text-sm font-medium leading-6 text-white/62">
              Browse by the way you live: cooking, organizing, decorating, and
              solving small household problems quickly.
            </p>
          </div>
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            variants={{
              hidden: {},
              show: {
                transition: {
                  staggerChildren: 0.045,
                },
              },
            }}
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-5 lg:grid-cols-4"
          >
            {categories.map((category) => (
              <motion.div
                key={category.name}
                variants={{
                  hidden: { opacity: 0, y: 18 },
                  show: { opacity: 1, y: 0 },
                }}
                transition={{ duration: 0.42, ease: 'easeOut' }}
              >
                <Link
                  href={`/collections/${slugifyCategory(category.name)}`}
                  className="group block overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_18px_45px_rgba(0,0,0,0.24)] transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.07] md:rounded-3xl"
                >
                  {(() => {
                    const showFallback =
                      !category.image || failedCategoryImages[category.name];

                    return (
                      <div className="relative aspect-[4/5] overflow-hidden">
                        <div className="absolute inset-0 bg-zinc-900">
                          {!showFallback ? (
                            <img
                              src={category.image}
                              alt={category.name}
                              className="h-full w-full object-cover opacity-88 transition-transform duration-500 group-hover:scale-105"
                              onError={() =>
                                setFailedCategoryImages((current) => ({
                                  ...current,
                                  [category.name]: true,
                                }))
                              }
                            />
                          ) : (
                            <div className="grid h-full w-full place-items-center bg-gradient-to-br from-zinc-800 via-zinc-900 to-black p-4 text-center">
                              <span className="block max-w-[80%] text-center text-xs font-medium leading-4 text-white/62">
                                {category.name}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/28 to-transparent p-3 pt-12 sm:p-4">
                          <p className="text-sm font-semibold leading-5 text-white sm:text-base">
                          {category.name}
                        </p>
                        </div>
                      </div>
                    );
                  })()}
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* All Products */}
      <section className="bg-[linear-gradient(180deg,#f7f7f8_0%,#fff_32%)] py-16 md:py-24">
        <HomeProductListSection
          title="Useful finds for every room"
          products={allProducts.slice(0, visibleProductCount)}
          sectionClassName="py-0"
          containerClassName="w-full px-4 sm:px-6 lg:px-8"
          headerClassName="mx-auto max-w-7xl"
          gridClassName="grid grid-cols-2 gap-x-3.5 gap-y-8 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-5 lg:gap-x-6 lg:gap-y-10 xl:grid-cols-6 2xl:grid-cols-7"
          animateItems={false}
        />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {visibleProductCount < allProducts.length && (
            <div ref={loadMoreRef} className="mt-8 flex justify-center py-6">
              <span className="text-sm text-gray-400">
                Loading more useful finds...
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Shipping Info */}
      <section className="bg-white py-10 md:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-[28px] border border-zinc-200/80 bg-[linear-gradient(180deg,#fff_0%,#fafafa_100%)] shadow-[0_24px_70px_rgba(24,24,27,0.08)]">
            <div className="border-b border-zinc-100 px-5 py-5 sm:px-7">
              <div className="flex flex-col gap-2 text-center sm:text-left">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                  Delivery confidence
                </p>
                <div className="text-[1.35rem] font-semibold leading-tight tracking-tight text-zinc-950">
                  Clear delivery timing before you order
                </div>
                <p className="mx-auto max-w-2xl text-sm font-medium leading-6 text-zinc-500 sm:mx-0">
                  Practical household orders are packed for everyday delivery:
                  simple rates, COD support, and no confusing marketplace steps.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 px-4 py-4 sm:px-5 md:grid-cols-3 md:gap-4 md:py-5">
              {deliveryShippingOptions.map((option) => (
                <div
                  key={option.id}
                  className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 text-center shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div
                    className={`mb-2 inline-flex rounded-full px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.18em] ${
                      option.id === 'outside-dhaka-division'
                        ? 'bg-zinc-950 text-white'
                        : option.id === 'dhaka-division'
                          ? 'bg-slate-100 text-slate-700'
                          : 'bg-zinc-100 text-zinc-700'
                    }`}
                  >
                    {option.badge}
                  </div>
                  <div className="mb-1 text-[1.05rem] font-bold text-zinc-950">
                    {option.title}
                  </div>
                  <p className="text-[0.76rem] font-medium text-slate-600">
                    {option.summary}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
