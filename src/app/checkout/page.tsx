'use client';

import { useCart } from '@/components/CartProvider';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

export default function Checkout() {
  const router = useRouter();
  const { selectedCartItems, subtotal } = useCart();
  const [paymentMethod, setPaymentMethod] = useState<'bkash' | 'cod' | ''>('');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    customerMobile: '',
    receiverMobile: '',
    division: '',
    district: '',
    thana: '',
    address: '',
    cardNumber: '',
    expiryDate: '',
    cvv: '',
  });

  const shippingCharge = useMemo(() => {
    if (!formData.division) return 0;

    if (formData.division === 'Dhaka') {
      if (!formData.district) return 0;
      return formData.district === 'Dhaka' ? 80 : 120;
    }

    return 150;
  }, [formData.district, formData.division]);

  const orderTotal = subtotal + shippingCharge;

  const handlePlaceOrder = () => {
    // Basic validation
    if (
      !formData.firstName ||
      !formData.lastName ||
      !formData.customerMobile ||
      !formData.division ||
      !formData.district ||
      !formData.thana ||
      !formData.address
    ) {
      return;
    }

    if (!paymentMethod) {
      return;
    }

    // Generate order ID
    const orderId = 'ORD-' + Date.now();

    // Create order object
    const orderData = {
      id: orderId,
      customer: {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        customerMobile: formData.customerMobile,
        receiverMobile: formData.receiverMobile,
      },
      shipping: {
        division: formData.division,
        district: formData.district,
        thana: formData.thana,
        address: formData.address,
      },
      payment: {
        method: paymentMethod,
        ...(paymentMethod === 'bkash' && {
          cardNumber: formData.cardNumber,
          expiryDate: formData.expiryDate,
          cvv: formData.cvv,
        }),
      },
      items: selectedCartItems,
      totals: {
        subtotal,
        shipping: shippingCharge,
        total: orderTotal,
      },
      orderDate: new Date().toISOString(),
    };

    // Store order data (in a real app, this would be sent to a server)
    localStorage.setItem(`order_${orderId}`, JSON.stringify(orderData));

    // Navigate to order confirmation page
    router.push(`/order-confirmation?orderId=${orderId}`);
  };

  // Bangladesh Administrative Divisions Data
  const divisions = [
    'Dhaka',
    'Chittagong',
    'Rajshahi',
    'Khulna',
    'Barisal',
    'Sylhet',
    'Rangpur',
    'Mymensingh',
  ];

  const districts: Record<string, string[]> = {
    Dhaka: [
      'Dhaka',
      'Gazipur',
      'Narayanganj',
      'Manikganj',
      'Munshiganj',
      'Narsingdi',
      'Tangail',
      'Kishoreganj',
      'Netrokona',
      'Sherpur',
      'Mymensingh',
      'Jamalpur',
    ],
    Chittagong: [
      'Chittagong',
      "Cox's Bazar",
      'Rangamati',
      'Bandarban',
      'Khagrachhari',
      'Feni',
      'Lakshmipur',
      'Noakhali',
      'Brahmanbaria',
      'Comilla',
    ],
    Rajshahi: [
      'Rajshahi',
      'Natore',
      'Naogaon',
      'Chapainawabganj',
      'Pabna',
      'Sirajganj',
      'Bogra',
      'Joypurhat',
    ],
    Khulna: [
      'Khulna',
      'Bagerhat',
      'Chuadanga',
      'Jessore',
      'Jhenaidah',
      'Kushtia',
      'Magura',
      'Meherpur',
      'Narail',
      'Satkhira',
    ],
    Barisal: [
      'Barisal',
      'Barguna',
      'Bhola',
      'Jhalokati',
      'Patuakhali',
      'Pirojpur',
    ],
    Sylhet: ['Sylhet', 'Habiganj', 'Moulvibazar', 'Sunamganj'],
    Rangpur: [
      'Rangpur',
      'Dinajpur',
      'Gaibandha',
      'Kurigram',
      'Lalmonirhat',
      'Nilphamari',
      'Panchagarh',
      'Thakurgaon',
    ],
    Mymensingh: ['Mymensingh', 'Jamalpur', 'Netrokona', 'Sherpur'],
  };

  const thanas: Record<string, string[]> = {
    // Dhaka Division - Dhaka District
    Dhaka: [
      'Dhanmondi',
      'Gulshan',
      'Banani',
      'Uttara',
      'Mirpur',
      'Mohammadpur',
      'Tejgaon',
      'Ramna',
      'Motijheel',
      'Sabujbagh',
    ],
    // Add more thanas for other districts as needed
    Gazipur: ['Gazipur Sadar', 'Kaliakair', 'Kapasia', 'Sreepur', 'Kaliganj'],
    Narayanganj: [
      'Narayanganj Sadar',
      'Araihazar',
      'Bandar',
      'Rupganj',
      'Sonargaon',
    ],
    // Default fallback
    default: ['Sadar', 'Municipality'],
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      // Reset dependent fields when parent changes
      ...(name === 'division' && { district: '', thana: '' }),
      ...(name === 'district' && { thana: '' }),
    }));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-12">
        <Link
          href="/"
          className="text-blue-600 hover:text-blue-700 text-sm mb-4 inline-block"
        >
          ← Continue Shopping
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>
      </div>

      <div className="max-w-2xl">
        <form className="space-y-6">
          {/* Your Details - Merged Contact Section */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-8">
              Your Details
            </h2>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg
                className="w-5 h-5 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              Your Contact
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label
                  htmlFor="firstName"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  First Name *
                </label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  placeholder="Osman"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="lastName"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Last Name *
                </label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  placeholder="Hadi"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  required
                />
              </div>
            </div>
            <div className="mb-4">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                placeholder="your@email.com"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="customerMobile"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Customer Mobile Number *
                </label>
                <input
                  type="tel"
                  id="customerMobile"
                  name="customerMobile"
                  placeholder="+880 1XX-XXXXXXX"
                  value={formData.customerMobile}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="receiverMobile"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Parcel Receiver&apos;s Mobile Number
                </label>
                <input
                  type="tel"
                  id="receiverMobile"
                  name="receiverMobile"
                  placeholder="+880 1XX-XXXXXXX (optional)"
                  value={formData.receiverMobile}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg
                className="w-5 h-5 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Delivery Address
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label
                  htmlFor="division"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Division *
                </label>
                <select
                  id="division"
                  name="division"
                  value={formData.division}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 pr-10 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 appearance-none bg-white"
                  required
                >
                  <option value="">Select Division</option>
                  {divisions.map((division) => (
                    <option key={division} value={division}>
                      {division}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="district"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  District *
                </label>
                <select
                  id="district"
                  name="district"
                  value={formData.district}
                  onChange={handleInputChange}
                  disabled={!formData.division}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 pr-10 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 appearance-none bg-white disabled:bg-gray-50 disabled:cursor-not-allowed"
                  required
                >
                  <option value="">Select District</option>
                  {formData.division &&
                    districts[formData.division]?.map((district) => (
                      <option key={district} value={district}>
                        {district}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="thana"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Thana / Upazila *
                </label>
                <select
                  id="thana"
                  name="thana"
                  value={formData.thana}
                  onChange={handleInputChange}
                  disabled={!formData.district}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 pr-10 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 appearance-none bg-white disabled:bg-gray-50 disabled:cursor-not-allowed"
                  required
                >
                  <option value="">Select Thana</option>
                  {formData.district &&
                    (thanas[formData.district] || thanas['default'])?.map(
                      (thana) => (
                        <option key={thana} value={thana}>
                          {thana}
                        </option>
                      ),
                    )}
                </select>
              </div>
            </div>
            <div>
              <label
                htmlFor="address"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Street Address *
              </label>
              <textarea
                id="address"
                name="address"
                placeholder="House/Road/Area details"
                value={formData.address}
                onChange={handleInputChange}
                rows={3}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none"
                required
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Shipping Charge
                </h3>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-2xl bg-orange-50 px-4 py-3">
                <p className="text-sm font-semibold text-gray-900">
                  ৳{shippingCharge.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4">
              <span className="text-sm font-medium text-gray-600">
                  Cart Subtotal
              </span>
              <span className="text-sm font-semibold text-gray-900">
                ৳{subtotal.toFixed(2)}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-gray-200 pt-3">
              <span className="text-sm font-medium text-gray-600">
                Total
              </span>
              <span className="text-lg font-semibold text-gray-900">
                ৳{orderTotal.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Payment Method Section */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-8 mt-12">
              Payment Method
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Bkash */}
            <div
              onClick={() => setPaymentMethod('bkash')}
              className={`relative flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer
    ${
      paymentMethod === 'bkash'
        ? 'scale-[1.02] border-2 border-pink-500 bg-pink-50 ring-2 ring-pink-100 shadow-[0_8px_18px_rgba(236,72,153,0.2)]'
        : 'border-pink-200 bg-pink-50/70 hover:bg-pink-100/70 hover:shadow-md'
    }`}
            >
              {/* BIG Icon */}
              <div className="w-11 h-11 bg-pink-100 rounded-2xl flex items-center justify-center">
                <span className="text-pink-600 font-bold text-lg">Bk</span>
              </div>

              {/* Text */}
              <div className="flex-1">
                <h3 className="text-base font-semibold text-gray-900">bKash</h3>
                <p className="text-sm text-gray-500">Pay via mobile wallet</p>
              </div>

              {/* Checkmark placeholder - always present to maintain consistent width */}
              <div className="w-6 h-6 flex items-center justify-center">
                {paymentMethod === 'bkash' && (
                  <div className="w-6 h-6 bg-pink-500 rounded-full flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                )}
              </div>
            </div>

            {/* COD */}
            <div
              onClick={() => setPaymentMethod('cod')}
              className={`relative flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer
    ${
      paymentMethod === 'cod'
        ? 'scale-[1.02] border-2 border-blue-500 bg-blue-50 ring-2 ring-blue-100 shadow-[0_8px_18px_rgba(59,130,246,0.2)]'
        : 'border-blue-200 bg-blue-50/70 hover:bg-blue-100/70 hover:shadow-md'
    }`}
            >
              {/* BIG Icon */}
              <div className="w-11 h-11 bg-blue-100 rounded-2xl flex items-center justify-center text-2xl">
                💵
              </div>

              {/* Text */}
              <div className="flex-1">
                <h3 className="text-base font-semibold text-gray-900">
                  Cash on Delivery
                </h3>
                <p className="text-sm text-gray-500">Pay when you receive</p>
              </div>

              {/* Checkmark placeholder - always present to maintain consistent width */}
              <div className="w-6 h-6 flex items-center justify-center">
                {paymentMethod === 'cod' && (
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Place Order Button */}
          <div className="pt-8">
            <button
              type="button"
              onClick={handlePlaceOrder}
              disabled={!paymentMethod}
              className={`w-full font-semibold py-4 rounded-xl transition-all text-lg ${
                paymentMethod
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                  : 'cursor-not-allowed bg-gray-200 text-gray-500'
              }`}
            >
              Place Order
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


