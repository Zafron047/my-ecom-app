'use client';

import { useCart } from '@/components/CartProvider';
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
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [product, setProduct] = useState<StorefrontProductDetail | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<StorefrontCatalogProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notFoundState, setNotFoundState] = useState(false);

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

  const discount = useMemo(() => {
    if (!product?.salePrice) return 0;
    return Math.round(((product.price - product.salePrice) / product.price) * 100);
  }, [product]);

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-16">
        <div>
          <div className="mb-4 overflow-hidden rounded-lg bg-gray-100 aspect-square">
            {safeSelectedImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={safeSelectedImage}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full grid place-items-center text-slate-500">
                No image
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {product.images.map((image, index) => (
              <button
                key={`${image}-${index}`}
                onClick={() => setSelectedImage(index)}
                className={`w-20 h-20 rounded overflow-hidden border-2 transition ${
                  selectedImage === index
                    ? 'border-blue-600'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt={`View ${index + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{product.name}</h1>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm text-gray-600">
                  {product.rating} ({product.reviews} reviews)
                </span>
              </div>
            </div>
            {discount > 0 && (
              <div className="bg-red-500 text-white px-3 py-1 rounded font-semibold">
                -{discount}%
              </div>
            )}
          </div>

          <div className="mb-6">
            <div className="flex items-baseline gap-3 mb-2">
              {product.salePrice ? (
                <>
                  <span className="text-3xl font-bold text-gray-900">
                    ৳{product.salePrice.toFixed(2)}
                  </span>
                  <span className="text-lg text-gray-500 line-through">
                    ৳{product.price.toFixed(2)}
                  </span>
                </>
              ) : (
                <span className="text-3xl font-bold text-gray-900">
                  ৳{product.price.toFixed(2)}
                </span>
              )}
            </div>
            <p className={product.inStock ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
              {product.inStock ? 'In Stock' : 'Out of Stock'}
            </p>
          </div>

          <div className="mb-8 border-t border-gray-200 pt-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Specifications</h3>
            <dl className="space-y-3">
              {product.specs.map((spec) => (
                <div key={`${spec.name}-${spec.value}`} className="flex justify-between gap-4">
                  <dt className="text-gray-600">{spec.name}:</dt>
                  <dd className="text-gray-900 font-medium text-right">{spec.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <p className="text-gray-600 mb-6">{product.description}</p>

          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Features</h3>
            <ul className="space-y-2">
              {product.benefits.map((benefit, index) => (
                <li key={`${benefit}-${index}`} className="flex items-start gap-3 text-gray-700">
                  <span className="mt-1 h-2 w-2 rounded-full bg-green-600" />
                  {benefit}
                </li>
              ))}
            </ul>
          </div>

          <div className="mb-8">
            <label className="block text-sm font-semibold text-gray-900 mb-2">Quantity</label>
            <div className="flex items-center gap-4 mb-6">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="px-4 py-2 border border-gray-200 rounded hover:bg-gray-100"
              >
                -
              </button>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-16 text-center border border-gray-200 rounded py-2"
              />
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="px-4 py-2 border border-gray-200 rounded hover:bg-gray-100"
              >
                +
              </button>
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() =>
                  addToCart(
                    {
                      id: product.id,
                      detailId: product.id,
                      name: product.name,
                      price: product.price,
                      salePrice: product.salePrice,
                      image: product.image,
                    },
                    quantity,
                  )
                }
                className="flex-1 bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition"
              >
                Add to Cart
              </button>
              <button className="flex-1 border-2 border-blue-600 text-blue-600 font-semibold py-3 rounded-lg hover:bg-blue-50 transition">
                Wishlist
              </button>
            </div>
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
                ৳{(relatedProduct.salePrice ?? relatedProduct.price).toFixed(2)}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
