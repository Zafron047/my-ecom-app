'use client';

import { FacebookIcon, GoogleIcon } from '@/components/SocialAuthIcons';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

function getOAuthErrorMessage(error: string | null) {
  if (!error) return null;
  if (error === 'oauth_not_configured') {
    return 'Social sign in is not configured yet.';
  }
  if (error === 'oauth_cancelled') {
    return 'Social sign in was cancelled.';
  }
  if (error === 'oauth_blocked') {
    return 'This customer account cannot sign in.';
  }
  return 'Social sign in failed. Please try again or use your password.';
}

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

  const handleSocialLogin = (provider: 'google' | 'facebook') => {
    const nextPath = searchParams.get('next') ?? '/';
    window.location.href = `/api/auth/${provider}/start?next=${encodeURIComponent(nextPath)}`;
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
            identifier: formData.identifier,
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

  const visibleError = error ?? getOAuthErrorMessage(searchParams.get('error'));

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
          {visibleError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {visibleError}
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
              <Link href="/forgot-password" className="text-xs text-blue-600 hover:text-blue-700">
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
            onClick={() => handleSocialLogin('google')}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium transition hover:bg-gray-50"
          >
            <GoogleIcon />
            Continue with Google
          </button>
          <button
            type="button"
            onClick={() => handleSocialLogin('facebook')}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium transition hover:bg-gray-50"
          >
            <FacebookIcon />
            Continue with Facebook
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
