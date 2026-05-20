'use client';

import ProductCard from '@/components/ProductCard';
import type { StorefrontCatalogProduct } from '@/lib/storefront-types';
import Link from 'next/link';
import { useMemo, useState } from 'react';

interface ProductsPageClientProps {
  products: StorefrontCatalogProduct[];
  categories: string[];
}

export default function ProductsPageClient({
  products,
  categories,
}: ProductsPageClientProps) {
  const [sortBy, setSortBy] = useState('featured');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredProducts = useMemo(
    () =>
      selectedCategory && selectedCategory !== 'All'
        ? products.filter((product) => product.category === selectedCategory)
        : products,
    [products, selectedCategory],
  );

  const sortedProducts = useMemo(() => {
    const nextProducts = [...filteredProducts];

    if (sortBy === 'price-low') {
      return nextProducts.sort(
        (a, b) => (a.salePrice || a.price) - (b.salePrice || b.price),
      );
    }

    if (sortBy === 'price-high') {
      return nextProducts.sort(
        (a, b) => (b.salePrice || b.price) - (a.salePrice || a.price),
      );
    }

    return nextProducts;
  }, [filteredProducts, sortBy]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <Link
          href="/"
          className="text-blue-600 hover:text-blue-700 text-sm mb-4 inline-block"
        >
          {'< Back to Home'}
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">More to love</h1>
        <p className="text-gray-600">
          Browse our complete selection of trending marketplace finds
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1">
          <div className="bg-gray-50 rounded-lg p-6 sticky top-24">
            <h3 className="font-semibold text-gray-900 mb-4">Categories</h3>
            <div className="space-y-2 mb-6">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat === 'All' ? null : cat)}
                  className={`block w-full text-left px-3 py-2 rounded transition ${
                    (cat === 'All' && !selectedCategory) ||
                    cat === selectedCategory
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="flex justify-between items-center mb-8">
            <p className="text-gray-600">
              Showing <span className="font-semibold">{sortedProducts.length}</span>{' '}
              products
            </p>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-600"
            >
              <option value="featured">Featured</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="newest">Newest</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {sortedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {sortedProducts.length === 0 && (
            <div className="text-center py-16">
              <p className="text-gray-600 text-lg mb-4">No products found</p>
              <button
                onClick={() => setSelectedCategory(null)}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
