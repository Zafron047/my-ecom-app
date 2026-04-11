'use client';

import { useCart } from '@/components/CartProvider';
import { useState } from 'react';
import Link from 'next/link';

interface Product {
  id: string;
  detailId?: string;
  name: string;
  price: number;
  salePrice?: number;
  image: string;
  badge?: string;
}

export default function ProductCard({ product }: { product: Product }) {
  const [imageFailed, setImageFailed] = useState(false);
  const { addToCart } = useCart();

  const discount = product.salePrice
    ? Math.round(((product.price - product.salePrice) / product.price) * 100)
    : 0;

  return (
    <div className="group flex h-full flex-col">
      <Link
        href={`/products/${product.detailId ?? product.id}`}
        className="flex flex-1 cursor-pointer flex-col"
      >
        {/* Image Container */}
        <div className="mb-4 rounded-md border border-gray-200 bg-slate-200/45 transition group-hover:border-gray-300">
          <div className="relative m-[6px] aspect-square overflow-hidden bg-white">
            {product.image && !imageFailed ? (
              <img
                src={product.image}
                alt={product.name}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                onError={() => setImageFailed(true)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 via-white to-slate-200 text-center">
                <div>
                  <p className="px-3 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    {product.name}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">Product Preview</p>
                </div>
              </div>
            )}
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

        {/* Product Info */}
        <p className="mb-3 min-h-[2.5rem] line-clamp-2 text-center text-[0.8rem] font-normal leading-5 text-gray-900">
          {product.name}
        </p>

        {/* Price */}
        <div className="flex min-h-[1.75rem] items-center justify-center gap-2">
          {product.salePrice ? (
            <>
              <span className="text-[0.85rem] text-gray-500 line-through">
                ৳{product.price.toFixed(2)}
              </span>
              <span className="text-[0.96rem] font-medium text-gray-900">
                ৳{product.salePrice.toFixed(2)}
              </span>
            </>
          ) : (
            <span className="text-[0.96rem] font-medium text-gray-900">
              ৳{product.price.toFixed(2)}
            </span>
          )}
        </div>
      </Link>

      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          addToCart(product);
        }}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-[#2d5db3] bg-[#2d5db3] px-4 py-2.5 text-[0.8rem] font-medium text-white transition duration-300 hover:-translate-y-0.5 hover:border-[#d94d9a] hover:bg-[#d94d9a] hover:shadow-md"
      >
        <span className="transition-transform duration-300 group-hover:translate-x-0.5">
          Add to Cart
        </span>
        <span className="text-sm leading-none transition-transform duration-300 group-hover:translate-x-1">
          +
        </span>
      </button>
    </div>
  );
}
