'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formData, setFormData] = useState({
    identifier: '',
    password: '',
  });
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15000);

    try {
      const nextPath = searchParams.get('next') ?? '/';
      const isAdminLogin = nextPath.startsWith('/admin');
      const endpoint = isAdminLogin ? '/api/admin/login' : '/api/login';
      const payload = isAdminLogin
        ? {
            email: formData.identifier,
            password: formData.password,
            rememberMe,
            nextPath,
          }
        : {
            identifier: formData.identifier,
            password: formData.password,
            rememberMe,
            nextPath,
          };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as {
        error?: string;
        redirectTo?: string;
      };

      if (!response.ok) {
        setError(data.error ?? 'Login failed. Please try again.');
        return;
      }

      router.push(data.redirectTo ?? nextPath);
      router.refresh();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setError('Login is taking too long. Please try again.');
        return;
      }

      setError('Login failed. Please check your connection and try again.');
    } finally {
      window.clearTimeout(timeoutId);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="rounded-lg bg-white p-8 shadow-lg">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-gradient-to-br from-blue-600 to-green-600">
            <span className="text-lg font-bold text-white">VP</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome Back</h1>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to access your account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mb-6 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="identifier"
              className="mb-2 block text-sm font-medium text-gray-900"
            >
              Email Address or Phone Number
            </label>
            <input
              id="identifier"
              type="text"
              name="identifier"
              value={formData.identifier}
              onChange={handleChange}
              placeholder="you@example.com or +8801XXXXXXXXX"
              required
              className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-900"
              >
                Password
              </label>
              <Link href="#" className="text-xs text-blue-600 hover:text-blue-700">
                Forgot?
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="********"
                required
                className="w-full rounded-lg border border-gray-200 px-4 py-2 pr-11 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((current) => !current)}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-gray-500 transition hover:text-gray-900"
              >
                {showPassword ? (
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 3l18 18" />
                    <path d="M10.6 10.6A2 2 0 0012 14a2 2 0 001.4-.6" />
                    <path d="M9.9 4.2A10.8 10.8 0 0112 4c5 0 9 4.5 10 8a11.8 11.8 0 01-2.2 3.8" />
                    <path d="M6.6 6.6A11.8 11.8 0 002 12c1 3.5 5 8 10 8a10.8 10.8 0 004.1-.8" />
                  </svg>
                ) : (
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center">
            <input
              id="remember"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-gray-200"
            />
            <label
              htmlFor="remember"
              className="ml-2 cursor-pointer text-sm text-gray-600"
            >
              Keep me signed in
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-6 w-full rounded-lg bg-blue-600 py-2 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="mb-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs text-gray-500">or</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <div className="mb-6 space-y-2">
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium transition hover:bg-gray-50"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M15.545 6.558a9.42 9.42 0 011.946 2.921c.881-1.12 1.579-2.436 1.974-3.85.084-.251.166-.502.252-.752-.635.159-1.302.299-1.99.322a4.42 4.42 0 002.048-1.953 8.875 8.875 0 01-2.805.98 4.444 4.444 0 00-7.768 4.05A12.6 12.6 0 002.33 3.06a4.46 4.46 0 001.374 5.93 4.386 4.386 0 01-2.01-.556v.056a4.432 4.432 0 003.562 4.344 4.419 4.419 0 01-2.005.078 4.434 4.434 0 004.14 3.08 8.88 8.88 0 01-5.513 1.9c-.358 0-.716-.02-1.066-.065A12.515 12.515 0 007.738 19.67c7.76 0 11.946-6.435 11.946-12.008 0-.183-.005-.365-.015-.544a8.532 8.532 0 002.087-2.17z" />
            </svg>
            Continue with Google
          </button>
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium transition hover:bg-gray-50"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M8.42 16.91a7.51 7.51 0 100-15.02A7.568 7.568 0 003.06 4.375a7.52 7.52 0 1010.86 9.83c-.165.25-.373.477-.62.657m4.04-12.93a7.51 7.51 0 11-15.02 0 7.51 7.51 0 0115.02 0z" />
            </svg>
            Continue with Apple
          </button>
        </div>

        <p className="text-center text-sm text-gray-600">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-medium text-blue-600 hover:text-blue-700">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function Login() {
  return (
    <Suspense fallback={<div className="w-full max-w-md text-center text-sm text-gray-600">Loading login form...</div>}>
      <LoginContent />
    </Suspense>
  );
}
