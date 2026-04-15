import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-blue-50 to-green-50">
      <div className="text-center max-w-md">
        <div className="text-9xl font-bold text-blue-600 mb-4">404</div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          Page Not Found
        </h1>
        <p className="text-gray-600 mb-8">
          Oops! We couldn&apos;t find the page you&apos;re looking for. It might have been
          moved or deleted.
        </p>

        <div className="bg-white rounded-lg p-8 mb-8">
          <div className="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center mb-6">
            <svg
              className="w-24 h-24 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-gray-500 text-sm mb-6">
            Let&apos;s get you back on track. Here are some helpful links:
          </p>
          <div className="space-y-2">
            <Link
              href="/"
              className="block text-blue-600 hover:text-blue-700 font-medium"
            >
              → Back to Home
            </Link>
            <Link
              href="/products"
              className="block text-blue-600 hover:text-blue-700 font-medium"
            >
              → Browse Products
            </Link>
            <a
              href="#"
              className="block text-blue-600 hover:text-blue-700 font-medium"
            >
              → Contact Support
            </a>
          </div>
        </div>

        <div className="flex gap-4">
          <Link
            href="/"
            className="flex-1 bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition"
          >
            Go Home
          </Link>
          <button className="flex-1 border-2 border-blue-600 text-blue-600 font-semibold py-3 rounded-lg hover:bg-blue-50 transition">
            Report Issue
          </button>
        </div>

        <p className="text-gray-500 text-xs mt-8">
          Error Code: 404 | If you think this is a mistake, please contact our
          support team.
        </p>
      </div>
    </div>
  );
}
