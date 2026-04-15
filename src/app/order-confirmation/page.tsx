'use client';

import { type CartItem, useCart } from '@/components/CartProvider';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef } from 'react';

const CHECKOUT_PENDING_ORDER_KEY = 'buy-easy-pending-order-id';

interface OrderData {
  id: string;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    customerMobile: string;
    receiverMobile: string;
  };
  shipping: {
    division: string;
    district: string;
    thana: string;
    address: string;
  };
  payment: {
    method: string;
    cardNumber?: string;
    expiryDate?: string;
    cvv?: string;
  };
  items: CartItem[];
  totals: {
    subtotal: number;
    shipping: number;
    total: number;
  };
  orderDate: string;
}

function OrderConfirmationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { clearSelectedItems } = useCart();
  const hasLoadedRef = useRef(false);
  const orderId = searchParams.get('orderId');
  const orderData = useMemo<OrderData | null>(() => {
    if (!orderId || typeof window === 'undefined') return null;

    const storedOrder = localStorage.getItem(`order_${orderId}`);
    if (!storedOrder) return null;

    try {
      return JSON.parse(storedOrder) as OrderData;
    } catch {
      return null;
    }
  }, [orderId]);

  useEffect(() => {
    if (hasLoadedRef.current || !orderData || !orderId) return;

    const pendingOrderId = localStorage.getItem(CHECKOUT_PENDING_ORDER_KEY);
    if (pendingOrderId === orderId) {
      // Remove only checked-out items and keep unselected items in cart.
      clearSelectedItems();
      localStorage.removeItem(CHECKOUT_PENDING_ORDER_KEY);
    }

    hasLoadedRef.current = true; // Prevent re-execution
  }, [clearSelectedItems, orderData, orderId]);

  if (!orderData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading order details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-gray-900 mb-2">
            Order Submitted
          </h1>
          <p className="text-gray-600">
            Thank you for your order. Please wait for our call to confirm this
            order.
          </p>
        </div>

        {/* Order Details */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Order Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-600">
                <strong>Order ID:</strong> {orderData.id}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Date:</strong>{' '}
                {new Date(orderData.orderDate).toLocaleDateString()}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Payment Method:</strong>{' '}
                {orderData.payment.method === 'bkash'
                  ? 'bKash'
                  : 'Cash on Delivery'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">
                <strong>Name:</strong> {orderData.customer.firstName}{' '}
                {orderData.customer.lastName}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Email:</strong>{' '}
                {orderData.customer.email || 'Not provided'}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Mobile:</strong> {orderData.customer.customerMobile}
              </p>
              {orderData.customer.receiverMobile && (
                <p className="text-sm text-gray-600">
                  <strong>Receiver Mobile:</strong>{' '}
                  {orderData.customer.receiverMobile}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Shipping Address */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Shipping Address
          </h2>
          <div className="text-sm text-gray-600">
            <p>{orderData.shipping.address}</p>
            <p>
              {orderData.shipping.thana}, {orderData.shipping.district}
            </p>
            <p>{orderData.shipping.division}, Bangladesh</p>
          </div>
        </div>

        {/* Items */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Items
          </h2>
          <div className="space-y-4">
            {orderData.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 py-4 border-b border-gray-100 last:border-b-0"
              >
                <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{item.name}</h3>
                  <p className="text-sm text-gray-600">
                    Quantity: {item.quantity}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">
                    ৳{(item.salePrice ?? item.price).toFixed(2)}
                  </p>
                  {item.salePrice && (
                    <p className="text-sm text-gray-400 line-through">
                      ৳{item.price.toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Order Summary */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Order Summary
          </h2>
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal:</span>
              <span>৳{orderData.totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Shipping:</span>
              <span>৳{orderData.totals.shipping.toFixed(2)}</span>
            </div>
            <div className="border-t border-gray-200 pt-2">
              <div className="flex justify-between text-lg font-semibold text-gray-900">
                <span>Total:</span>
                <span>৳{orderData.totals.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Home
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OrderConfirmation() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading order details...</p>
          </div>
        </div>
      }
    >
      <OrderConfirmationContent />
    </Suspense>
  );
}
