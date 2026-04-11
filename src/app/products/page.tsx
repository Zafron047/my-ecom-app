'use client';

import ProductCard from '@/components/ProductCard';
import Link from 'next/link';
import { useState } from 'react';

export default function Products() {
  const [sortBy, setSortBy] = useState('featured');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const allProducts = [
    {
      id: '1',
      name: 'Wireless Earbuds Pro',
      price: 49.99,
      salePrice: 34.99,
      image:
        'https://images.unsplash.com/photo-1638701019412-374b39a9fb0c?w=500&h=500&fit=crop',
      category: 'Gadgets',
    },
    {
      id: '2',
      name: 'Mini Portable Blender Bottle',
      price: 32.99,
      salePrice: 24.99,
      image:
        'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=500&h=500&fit=crop',
      category: 'Home Finds',
    },
    {
      id: '3',
      name: 'Magnetic Car Phone Holder',
      price: 28.99,
      salePrice: 26.99,
      image:
        'https://images.unsplash.com/photo-1631217553387-bdb5c5c36748?w=500&h=500&fit=crop',
      category: 'Car Accessories',
    },
    {
      id: '4',
      name: 'USB Rechargeable Table Lamp',
      price: 34.99,
      image:
        'https://images.unsplash.com/photo-1576091160501-112173d7f5a0?w=500&h=500&fit=crop',
      category: 'Home Finds',
    },
    {
      id: '5',
      name: 'Foldable Laptop Stand',
      price: 17.99,
      salePrice: 14.99,
      image:
        'https://images.unsplash.com/photo-1584308666744-24d5f15714ce?w=500&h=500&fit=crop',
      category: 'Office Setup',
    },
    {
      id: '6',
      name: '40oz Stainless Steel Tumbler',
      price: 12.99,
      image:
        'https://images.unsplash.com/photo-1559056199-641a0ac8b3f4?w=500&h=500&fit=crop',
      category: 'Kitchen Picks',
    },
    {
      id: '7',
      name: 'Pet Grooming Glove',
      price: 24.99,
      salePrice: 19.99,
      image:
        'https://images.unsplash.com/photo-1630497682759-61b5fa9d66d0?w=500&h=500&fit=crop',
      category: 'Pet Essentials',
    },
    {
      id: '8',
      name: 'Travel Packing Cubes Set',
      price: 39.99,
      salePrice: 31.99,
      image:
        'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=500&h=500&fit=crop',
      category: 'Travel Gear',
    },
  ];

  const categories = [
    'All',
    'Gadgets',
    'Home Finds',
    'Car Accessories',
    'Office Setup',
    'Kitchen Picks',
    'Pet Essentials',
    'Travel Gear',
  ];

  const filteredProducts =
    selectedCategory && selectedCategory !== 'All'
      ? allProducts.filter((p) => p.category === selectedCategory)
      : allProducts;

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortBy === 'price-low')
      return (a.salePrice || a.price) - (b.salePrice || b.price);
    if (sortBy === 'price-high')
      return (b.salePrice || b.price) - (a.salePrice || a.price);
    return 0;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/"
          className="text-blue-600 hover:text-blue-700 text-sm mb-4 inline-block"
        >
          ← Back to Home
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">More to love</h1>
        <p className="text-gray-600">
          Browse our complete selection of trending marketplace finds
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Filters */}
        <div className="lg:col-span-1">
          <div className="bg-gray-50 rounded-lg p-6 sticky top-24">
            {/* Categories */}
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

            {/* Price Range */}
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

            {/* Stock Status */}
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

        {/* Products */}
        <div className="lg:col-span-3">
          {/* Sort Bar */}
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

          {/* Products Grid */}
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
