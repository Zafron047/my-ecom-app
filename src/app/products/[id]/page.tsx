'use client';

import { useCart } from '@/components/CartProvider';
import { catalogProducts } from '@/data/products';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { useState } from 'react';

const productDetails = {
  '1': {
    images: [
      'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&h=800&fit=crop',
    ],
    description:
      'Compact wireless earbuds with a charging case, clear call audio, and an everyday design made for commuting, work, and casual listening.',
    benefits: [
      'Lightweight fit for daily use',
      'Fast pairing with phones and tablets',
      'Portable charging case for extra battery',
      'Touch controls for music and calls',
      'Clean, minimal design that works as a giftable item',
    ],
    specs: {
      highlight1Label: 'Battery',
      highlight1Value: 'Up to 24 Hours with Case',
      highlight2Label: 'Connection',
      highlight2Value: 'Bluetooth 5.3',
      highlight3Label: 'Materials',
      highlight3Value: 'ABS, Silicone',
      highlight4Label: 'Compatibility',
      highlight4Value: 'iOS, Android, Tablets',
      highlight5Label: 'Charging',
      highlight5Value: 'USB-C',
    },
  },
  '2': {
    images: [
      'https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1514996937319-344454492b37?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=800&fit=crop',
    ],
    description:
      'A compact portable blender bottle designed for quick smoothies, shakes, and iced drinks at home, in the office, or on the go.',
    benefits: [
      'USB charging for cable-free blending',
      'Compact design that fits in tote bags and backpacks',
      'Easy-rinse cup and lid design',
      'Great for protein shakes, juices, and fruit blends',
      'Popular giftable gadget for everyday use',
    ],
    specs: {
      highlight1Label: 'Capacity',
      highlight1Value: '420ml',
      highlight2Label: 'Power',
      highlight2Value: 'USB Rechargeable',
      highlight3Label: 'Cup Material',
      highlight3Value: 'BPA-Free Plastic',
      highlight4Label: 'Blade Type',
      highlight4Value: 'Stainless Steel',
      highlight5Label: 'Best For',
      highlight5Value: 'Smoothies and Shakes',
    },
  },
  '3': {
    images: [
      'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1489824904134-891ab64532f1?w=800&h=800&fit=crop',
    ],
    description:
      'A simple magnetic phone holder for dashboards and vents that keeps maps, calls, and music controls easy to view while driving.',
    benefits: [
      'Strong magnetic grip for everyday driving',
      'Compact form with minimal dashboard clutter',
      'Easy one-hand mount and release',
      'Works with most common phone sizes',
      'A practical low-ticket add-on item',
    ],
    specs: {
      highlight1Label: 'Mount Type',
      highlight1Value: 'Dashboard / Vent',
      highlight2Label: 'Material',
      highlight2Value: 'Metal Alloy + Silicone',
      highlight3Label: 'Rotation',
      highlight3Value: '360 Degrees',
      highlight4Label: 'Compatibility',
      highlight4Value: 'Universal Smartphones',
      highlight5Label: 'Install',
      highlight5Value: 'Peel-and-Stick Base',
    },
  },
  '4': {
    images: [
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800&h=800&fit=crop',
    ],
    description:
      'A rechargeable table lamp that adds warm ambient light to desks, bedside tables, and cozy corners without messy cords.',
    benefits: [
      'Cordless placement around the home',
      'Soft ambient light for reading and relaxing',
      'Minimal shape that suits modern interiors',
      'Rechargeable base for easy daily use',
      'Easy cross-sell for home and decor shoppers',
    ],
    specs: {
      highlight1Label: 'Power',
      highlight1Value: 'USB Rechargeable',
      highlight2Label: 'Lighting',
      highlight2Value: 'Warm LED',
      highlight3Label: 'Use Area',
      highlight3Value: 'Desk / Bedside / Dining',
      highlight4Label: 'Material',
      highlight4Value: 'Metal + Acrylic',
      highlight5Label: 'Style',
      highlight5Value: 'Modern Minimal',
    },
  },
  '5': {
    images: [
      'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=800&h=800&fit=crop',
    ],
    description:
      'A foldable laptop stand that improves desk posture and airflow while staying compact enough for remote work and travel setups.',
    benefits: [
      'Raises screen height for a cleaner desk posture',
      'Fold-flat design for bags and drawers',
      'Lightweight but stable for everyday laptops',
      'Improves airflow under the device',
      'Useful for office, student, and creator audiences',
    ],
    specs: {
      highlight1Label: 'Material',
      highlight1Value: 'Aluminum Alloy',
      highlight2Label: 'Foldability',
      highlight2Value: 'Portable Fold-Flat',
      highlight3Label: 'Suitable For',
      highlight3Value: '11 to 17 inch Laptops',
      highlight4Label: 'Use Case',
      highlight4Value: 'Desk / Remote Work',
      highlight5Label: 'Feature',
      highlight5Value: 'Heat Dissipation',
    },
  },
  '6': {
    images: [
      'https://images.unsplash.com/photo-1577937927133-66ef06acdf18?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1514228742587-6b1558fcf93a?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=800&h=800&fit=crop',
    ],
    description:
      'A large stainless steel tumbler built for iced drinks, long commutes, and keeping beverages colder for longer through the day.',
    benefits: [
      'Large-capacity cup for all-day hydration',
      'Stainless steel body with insulated feel',
      'Easy carry handle for commuting',
      'Works for water, coffee, and iced drinks',
      'High-appeal item for lifestyle shoppers',
    ],
    specs: {
      highlight1Label: 'Capacity',
      highlight1Value: '40oz',
      highlight2Label: 'Material',
      highlight2Value: 'Stainless Steel',
      highlight3Label: 'Insulation',
      highlight3Value: 'Double-Wall',
      highlight4Label: 'Handle',
      highlight4Value: 'Ergonomic Grip',
      highlight5Label: 'Use',
      highlight5Value: 'Hot and Cold Drinks',
    },
  },
  '7': {
    images: [
      'https://images.unsplash.com/photo-1517849845537-4d257902454a?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1518717758536-85ae29035b6d?w=800&h=800&fit=crop',
    ],
    description:
      'A gentle grooming glove that helps lift loose fur while turning everyday pet care into a quicker and easier routine.',
    benefits: [
      'Helps remove loose fur with less mess',
      'Comfortable glove fit for easy handling',
      'Useful during bath time and dry grooming',
      'Works well for cats and dogs',
      'A dependable repeat-purchase pet item',
    ],
    specs: {
      highlight1Label: 'Use',
      highlight1Value: 'Bathing and Dry Grooming',
      highlight2Label: 'Material',
      highlight2Value: 'Silicone + Mesh',
      highlight3Label: 'Fit',
      highlight3Value: 'Adjustable Wrist Strap',
      highlight4Label: 'Pet Type',
      highlight4Value: 'Cats and Dogs',
      highlight5Label: 'Feature',
      highlight5Value: 'Loose Fur Removal',
    },
  },
  '8': {
    images: [
      'https://images.unsplash.com/photo-1527631746610-bca00a040d60?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&h=800&fit=crop',
    ],
    description:
      'A travel packing cube set that keeps clothes, accessories, and toiletries separated for cleaner suitcase organization.',
    benefits: [
      'Makes luggage easier to sort and unpack',
      'Helps save space inside travel bags',
      'Lightweight fabric for carry-on use',
      'Useful for vacations, business trips, and storage',
      'Strong impulse-buy potential for travel shoppers',
    ],
    specs: {
      highlight1Label: 'Set Size',
      highlight1Value: '6 Pieces',
      highlight2Label: 'Material',
      highlight2Value: 'Lightweight Nylon',
      highlight3Label: 'Closure',
      highlight3Value: 'Smooth Zip',
      highlight4Label: 'Use',
      highlight4Value: 'Suitcase Organization',
      highlight5Label: 'Best For',
      highlight5Value: 'Travel and Storage',
    },
  },
} as const;

export default function ProductDetail() {
  const params = useParams();
  const { addToCart } = useCart();
  const catalogProduct = catalogProducts.find(
    (product) => product.id === params.id,
  );
  const productDetailConfig =
    productDetails[params.id as keyof typeof productDetails];
  const detailProduct =
    catalogProduct && productDetailConfig
      ? {
          ...catalogProduct,
          rating: 4.5,
          reviews: 124,
          inStock: true,
          ...productDetailConfig,
          images: [
            catalogProduct.image,
            ...productDetailConfig.images.slice(1),
          ],
        }
      : null;

  if (!detailProduct) {
    notFound();
  }

  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const relatedProducts = [
    {
      name: 'Phone Stand with Wireless Charging',
      price: 29.99,
      image:
        'https://images.unsplash.com/photo-1512499617640-c2f999098c01?w=400&h=400&fit=crop',
    },
    {
      name: 'Compact Bluetooth Speaker',
      price: 24.99,
      image:
        'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=400&h=400&fit=crop',
    },
    {
      name: 'Minimalist Smart Watch',
      price: 49.99,
      image:
        'https://images.unsplash.com/photo-1544117519-31a4b719223d?w=400&h=400&fit=crop',
    },
    {
      name: 'Magnetic Charging Cable Set',
      price: 14.99,
      image:
        'https://images.unsplash.com/photo-1580894908361-967195033215?w=400&h=400&fit=crop',
    },
  ];

  const discount = detailProduct.salePrice
    ? Math.round(
        ((detailProduct.price - detailProduct.salePrice) /
          detailProduct.price) *
          100,
      )
    : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Breadcrumb */}
      <nav className="mb-8 flex items-center space-x-2 text-sm">
        <Link href="/" className="text-blue-600 hover:text-blue-700">
          Home
        </Link>
        <span className="text-gray-400">/</span>
        <Link href="#" className="text-blue-600 hover:text-blue-700">
          Products
        </Link>
        <span className="text-gray-400">/</span>
        <span className="text-gray-600">{detailProduct.name}</span>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-16">
        {/* Image Gallery */}
        <div>
          <div className="mb-4 overflow-hidden rounded-lg bg-gray-100 aspect-square">
            <img
              src={detailProduct.images[selectedImage]}
              alt={detailProduct.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex gap-2">
            {detailProduct.images.map((image, index) => (
              <button
                key={index}
                onClick={() => setSelectedImage(index)}
                className={`w-20 h-20 rounded overflow-hidden border-2 transition ${
                  selectedImage === index
                    ? 'border-blue-600'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <img
                  src={image}
                  alt={`View ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>

        {/* Product Info */}
        <div>
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {detailProduct.name}
              </h1>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg
                      key={i}
                      className={`w-4 h-4 ${
                        i < Math.floor(detailProduct.rating)
                          ? 'text-yellow-400'
                          : 'text-gray-300'
                      }`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <span className="text-sm text-gray-600">
                  {detailProduct.rating} ({detailProduct.reviews} reviews)
                </span>
              </div>
            </div>
            {discount > 0 && (
              <div className="bg-red-500 text-white px-3 py-1 rounded font-semibold">
                -{discount}%
              </div>
            )}
          </div>

          {/* Price */}
          <div className="mb-6">
            <div className="flex items-baseline gap-3 mb-2">
              {detailProduct.salePrice ? (
                <>
                  <span className="text-3xl font-bold text-gray-900">
                    ৳{detailProduct.salePrice.toFixed(2)}
                  </span>
                  <span className="text-lg text-gray-500 line-through">
                    ৳{detailProduct.price.toFixed(2)}
                  </span>
                </>
              ) : (
                <span className="text-3xl font-bold text-gray-900">
                  ৳{detailProduct.price.toFixed(2)}
                </span>
              )}
            </div>
            {detailProduct.inStock ? (
              <p className="text-green-600 font-semibold">In Stock</p>
            ) : (
              <p className="text-red-600 font-semibold">Out of Stock</p>
            )}
          </div>

          {/* Description */}
          <p className="text-gray-600 mb-6">{detailProduct.description}</p>

          {/* Benefits */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Key Features
            </h3>
            <ul className="space-y-2">
              {detailProduct.benefits.map((benefit, index) => (
                <li
                  key={index}
                  className="flex items-start gap-3 text-gray-700"
                >
                  <svg
                    className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {benefit}
                </li>
              ))}
            </ul>
          </div>

          {/* Quantity and Add to Cart */}
          <div className="mb-8">
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Quantity
            </label>
            <div className="flex items-center gap-4 mb-6">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="px-4 py-2 border border-gray-200 rounded hover:bg-gray-100"
              >
                −
              </button>
              <input
                type="number"
                value={quantity}
                onChange={(e) =>
                  setQuantity(Math.max(1, parseInt(e.target.value) || 1))
                }
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
                      id: detailProduct.id,
                      detailId: detailProduct.id,
                      name: detailProduct.name,
                      price: detailProduct.price,
                      salePrice: detailProduct.salePrice,
                      image: detailProduct.image,
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

          {/* Product Specs */}
          <div className="border-t border-gray-200 pt-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Specifications
            </h3>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-gray-600">
                  {detailProduct.specs.highlight1Label}:
                </dt>
                <dd className="text-gray-900 font-medium">
                  {detailProduct.specs.highlight1Value}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">
                  {detailProduct.specs.highlight2Label}:
                </dt>
                <dd className="text-gray-900 font-medium">
                  {detailProduct.specs.highlight2Value}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">
                  {detailProduct.specs.highlight3Label}:
                </dt>
                <dd className="text-gray-900 font-medium">
                  {detailProduct.specs.highlight3Value}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">
                  {detailProduct.specs.highlight4Label}:
                </dt>
                <dd className="text-gray-900 font-medium">
                  {detailProduct.specs.highlight4Value}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">
                  {detailProduct.specs.highlight5Label}:
                </dt>
                <dd className="text-gray-900 font-medium">
                  {detailProduct.specs.highlight5Value}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* Reviews Section */}
      <section className="border-t border-gray-200 pt-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-8">
          Customer Reviews
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-3">
                {Array.from({ length: 5 }).map((_, j) => (
                  <svg
                    key={j}
                    className="w-4 h-4 text-yellow-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <h4 className="font-semibold text-gray-900 mb-1">
                Great Everyday Buy
              </h4>
              <p className="text-gray-600 text-sm mb-3">
                Solid build, easy pairing, and the battery lasts longer than I
                expected for the price.
              </p>
              <p className="text-xs text-gray-500">By John D. • 2 weeks ago</p>
            </div>
          ))}
        </div>
      </section>

      {/* Related Products */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-8">
          Related Products
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {relatedProducts.map((product) => (
            <div key={product.name} className="group cursor-pointer">
              <div className="relative overflow-hidden bg-gray-100 aspect-square rounded-lg mb-3">
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              </div>
              <h3 className="text-sm font-medium text-gray-900 line-clamp-2 mb-2">
                {product.name}
              </h3>
              <span className="text-gray-900 font-semibold">
                ৳{product.price.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
