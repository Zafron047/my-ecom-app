'use client';

import ProductCard from '@/components/ProductCard';
import type { StorefrontCatalogProduct } from '@/lib/storefront-types';
import Link from 'next/link';
import { useState } from 'react';

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <Link
          href="/"
          className="text-blue-600 hover:text-blue-700 text-sm mb-4 inline-block"
        >
          {'< Back to Home'}
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{title}</h1>
        <p className="text-gray-600">{description}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1">
          <div className="bg-gray-50 rounded-lg p-6 sticky top-24">
            <h3 className="font-semibold text-gray-900 mb-4">Categories</h3>
            <div className="space-y-2 mb-6">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() =>
                    setSelectedCategory(cat === 'All' ? null : cat)
                  }
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

            <h3 className="font-semibold text-gray-900 mb-4">Price Range</h3>
            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded" />
                <span className="text-gray-700">Under ৳20</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded" />
                <span className="text-gray-700">৳20 - ৳40</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded" />
                <span className="text-gray-700">Over ৳40</span>
              </label>
            </div>

            <h3 className="font-semibold text-gray-900 mt-6 mb-4">
              Stock Status
            </h3>
            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded" defaultChecked />
                <span className="text-gray-700">In Stock</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded" />
                <span className="text-gray-700">On Sale</span>
              </label>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="flex justify-between items-center mb-8">
            <p className="text-gray-600">
              Showing{' '}
              <span className="font-semibold">{sortedProducts.length}</span>{' '}
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
