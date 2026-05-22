'use client';

import ProductCard from '@/components/ProductCard';
import {
  buildCollectionNavigation,
  buildMobileCollectionChips,
  getCollectionDescription,
  getDisplayCategoryName,
  getDisplayProductName,
} from '@/lib/collection-display';
import type { StorefrontCatalogProduct } from '@/lib/storefront-types';
import Link from 'next/link';
import { useMemo, useState } from 'react';

interface ProductCollectionViewProps {
  title: string;
  description: string;
  products: StorefrontCatalogProduct[];
  categories: string[];
  initialCategory?: string;
}

export default function ProductCollectionView({
  title,
  description,
  products,
  categories,
  initialCategory,
}: ProductCollectionViewProps) {
  const [sortBy, setSortBy] = useState('featured');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    initialCategory ?? null,
  );
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const collectionNavigation = useMemo(
    () => buildCollectionNavigation(categories),
    [categories],
  );
  const visibleCategories = showAllCategories
    ? collectionNavigation
    : collectionNavigation.slice(0, 6);
  const mobileCategoryChips = useMemo(
    () => buildMobileCollectionChips(collectionNavigation),
    [collectionNavigation],
  );
  const selectedCategoryLabel =
    collectionNavigation.find((item) => item.rawName === selectedCategory)
      ?.displayName ??
    (initialCategory ? getDisplayCategoryName(initialCategory) : 'All products');
  const displayTitle = initialCategory
    ? getDisplayCategoryName(initialCategory)
    : title;

  const selectCategory = (rawName: string, closeMobileFilters = false) => {
    setSelectedCategory(rawName === 'All' ? null : rawName);
    if (closeMobileFilters) {
      setMobileFiltersOpen(false);
    }
  };

  const filteredProducts =
    selectedCategory && selectedCategory !== 'All'
      ? products.filter((product) => product.category === selectedCategory)
      : products;

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortBy === 'price-low') {
      return (a.salePrice || a.price) - (b.salePrice || b.price);
    }

    if (sortBy === 'price-high') {
      return (b.salePrice || b.price) - (a.salePrice || a.price);
    }

    return 0;
  });

  return (
    <div className="mx-auto max-w-[88rem] px-4 py-6 sm:px-6 sm:py-16 lg:px-10 lg:py-20">
      <div className="mb-5 max-w-4xl sm:mb-16">
        <Link
          href="/"
          className="mb-5 hidden text-sm font-medium text-zinc-500 transition hover:text-zinc-900 sm:inline-block"
        >
          Back to home
        </Link>
        <p className="mb-3 hidden text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 sm:block">
          Curated collection
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:mb-4 sm:text-4xl lg:text-5xl">
          {displayTitle}
        </h1>
        <p className="hidden max-w-2xl text-base leading-7 text-zinc-600 sm:block sm:text-lg">
          {initialCategory ? getCollectionDescription(initialCategory) : description}
        </p>
      </div>

      <div className="mb-4 lg:hidden">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {mobileCategoryChips.map((category) => (
            <button
              key={category.rawName}
              type="button"
              onClick={() => selectCategory(category.rawName)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                (category.rawName === 'All' && !selectedCategory) ||
                category.rawName === selectedCategory
                  ? 'border-zinc-950 bg-zinc-950 text-white'
                  : 'border-zinc-200 bg-white text-zinc-700'
              }`}
            >
              {category.displayName}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setMobileFiltersOpen(true)}
            className="shrink-0 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-950"
          >
            All categories
          </button>
        </div>
      </div>

      {mobileFiltersOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-zinc-950/30"
            aria-label="Close categories"
            onClick={() => setMobileFiltersOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[78vh] overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-500">
                All categories
              </p>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="rounded-full border border-zinc-200 px-3 py-1.5 text-sm font-semibold text-zinc-950"
              >
                Close
              </button>
            </div>
            <div className="space-y-1.5">
              {collectionNavigation.map((category) => (
                <button
                  key={category.rawName}
                  type="button"
                  onClick={() => selectCategory(category.rawName, true)}
                  className={`block w-full rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                    (category.rawName === 'All' && !selectedCategory) ||
                    category.rawName === selectedCategory
                      ? 'bg-zinc-950 text-white'
                      : 'bg-zinc-50 text-zinc-700'
                  }`}
                >
                  {category.displayName}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-14 xl:gap-16">
        <div className="hidden lg:col-span-1 lg:block">
          <aside className="sticky top-24 rounded-2xl border border-zinc-200 bg-white/80 p-4 shadow-[0_18px_48px_rgba(24,24,27,0.06)] backdrop-blur sm:p-5">
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Shop by collection
              </p>
              <h2 className="mt-2 text-lg font-semibold text-zinc-950">
                Curated edits
              </h2>
            </div>
            <div className="space-y-1.5">
              {visibleCategories.map((category) => (
                <button
                  key={category.rawName}
                  type="button"
                  onClick={() => selectCategory(category.rawName)}
                  className={`block w-full rounded-xl px-3.5 py-3 text-left text-sm transition ${
                    (category.rawName === 'All' && !selectedCategory) ||
                    category.rawName === selectedCategory
                      ? 'bg-zinc-950 text-white shadow-sm'
                      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950'
                  }`}
                >
                  {category.displayName}
                </button>
              ))}
            </div>
            {collectionNavigation.length > visibleCategories.length ? (
              <button
                type="button"
                onClick={() => setShowAllCategories(true)}
                className="mt-4 text-sm font-semibold text-zinc-950 underline-offset-4 transition hover:underline"
              >
                View all categories
              </button>
            ) : null}
            {showAllCategories && collectionNavigation.length > 6 ? (
              <button
                type="button"
                onClick={() => setShowAllCategories(false)}
                className="mt-4 block text-sm font-semibold text-zinc-500 underline-offset-4 transition hover:text-zinc-950 hover:underline"
              >
                Show fewer
              </button>
            ) : null}
          </aside>
        </div>

        <div>
          <div className="mb-5 flex items-center justify-between gap-3 border-b border-zinc-200 pb-4 lg:mb-10 lg:items-end lg:pb-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                {selectedCategoryLabel}
              </p>
              <p className="mt-1 text-sm text-zinc-500 lg:mt-2">
                <span className="font-semibold text-zinc-950">
                  {sortedProducts.length}
                </span>{' '}
                products
              </p>
            </div>
            <label className="flex shrink-0 flex-col gap-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-zinc-500 sm:w-auto lg:gap-2 lg:text-xs">
              <span className="sr-only lg:not-sr-only">Sort</span>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                className="max-w-[9rem] rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold normal-case tracking-normal text-zinc-900 shadow-sm outline-none transition hover:border-zinc-300 focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 lg:min-w-48 lg:max-w-none lg:px-4 lg:py-3"
              >
                <option value="featured">Featured</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="newest">Newest</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-5 sm:gap-y-8 xl:grid-cols-3 xl:gap-x-7 xl:gap-y-10">
            {sortedProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={{ ...product, name: getDisplayProductName(product.name) }}
                variant="catalog"
              />
            ))}
          </div>

          {sortedProducts.length === 0 && (
            <div className="py-16 text-center">
              <p className="mb-4 text-lg text-zinc-600">No products found</p>
              <button
                onClick={() => setSelectedCategory(null)}
                className="font-medium text-zinc-950 underline-offset-4 hover:underline"
              >
                View all products
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
