'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function Login() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [rememberMe, setRememberMe] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle login logic
    console.log('Login:', formData);
  };

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-lg shadow-lg p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-green-600 rounded-md flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-lg">VP</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome Back</h1>
          <p className="text-gray-600 text-sm mt-2">
            Sign in to access your account
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 mb-6">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-900 mb-2"
            >
              Email Address
            </label>
            <input
              id="email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@example.com"
              required
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-900"
              >
                Password
              </label>
              <Link
                href="#"
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                Forgot?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div className="flex items-center">
            <input
              id="remember"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-gray-200 cursor-pointer"
            />
            <label
              htmlFor="remember"
              className="ml-2 text-sm text-gray-600 cursor-pointer"
            >
              Keep me signed in
            </label>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white font-semibold py-2 rounded-lg hover:bg-blue-700 transition mt-6"
          >
            Sign In
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-500">or</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Social Buttons */}
        <div className="space-y-2 mb-6">
          <button className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition text-sm font-medium">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M15.545 6.558a9.42 9.42 0 011.946 2.921c.881-1.12 1.579-2.436 1.974-3.85.084-.251.166-.502.252-.752-.635.159-1.302.299-1.99.322a4.42 4.42 0 002.048-1.953 8.875 8.875 0 01-2.805.98 4.444 4.444 0 00-7.768 4.05A12.6 12.6 0 002.33 3.06a4.46 4.46 0 001.374 5.93 4.386 4.386 0 01-2.01-.556v.056a4.432 4.432 0 003.562 4.344 4.419 4.419 0 01-2.005.078 4.434 4.434 0 004.14 3.08 8.88 8.88 0 01-5.513 1.9c-.358 0-.716-.02-1.066-.065A12.515 12.515 0 007.738 19.67c7.76 0 11.946-6.435 11.946-12.008 0-.183-.005-.365-.015-.544a8.532 8.532 0 002.087-2.17z" />
            </svg>
            Continue with Google
          </button>
          <button className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition text-sm font-medium">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M8.42 16.91a7.51 7.51 0 100-15.02A7.568 7.568 0 003.06 4.375a7.52 7.52 0 1010.86 9.83c-.165.25-.373.477-.62.657m4.04-12.93a7.51 7.51 0 11-15.02 0 7.51 7.51 0 0115.02 0z" />
            </svg>
            Continue with Apple
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-600">
          Don't have an account?{' '}
          <Link
            href="/register"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
