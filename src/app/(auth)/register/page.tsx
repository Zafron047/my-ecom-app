'use client';

import { FacebookIcon, GoogleIcon } from '@/components/SocialAuthIcons';
import { trackMetaCompleteRegistration, trackMetaEvent } from '@/lib/meta-pixel';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function Register() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Validate password match
    if (name === 'confirmPassword' && formData.password !== value) {
      setPasswordError('Passwords do not match');
    } else if (
      name === 'password' &&
      formData.confirmPassword &&
      value !== formData.confirmPassword
    ) {
      setPasswordError('Passwords do not match');
    } else {
      setPasswordError('');
    }
  };

  const handleSocialSignup = (provider: 'google' | 'facebook') => {
    window.location.href = `/api/auth/${provider}/start?next=/`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    if (formData.password !== formData.confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    if (!agreedToTerms) {
      setSubmitError('Please agree to the Terms & Conditions.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        metaEventId?: string;
        redirectTo?: string;
      };
      if (!response.ok) {
        setSubmitError(data.error ?? 'Registration failed. Please try again.');
        return;
      }

      setSubmitSuccess('Account created successfully. You are signed in.');
      if (data.metaEventId) {
        trackMetaEvent('CompleteRegistration', { status: true }, data.metaEventId);
      } else {
        trackMetaCompleteRegistration();
      }
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: '',
      });
      setAgreedToTerms(false);
      setPasswordError('');
      router.push(data.redirectTo ?? '/');
      router.refresh();
    } catch {
      setSubmitError('Registration failed. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-lg shadow-lg p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-green-600 rounded-md flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-lg">VP</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create Account</h1>
          <p className="text-gray-600 text-sm mt-2">
            Join our shopping community
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 mb-6">
          {submitError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {submitError}
            </div>
          )}
          {submitSuccess && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {submitSuccess}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="firstName"
                className="block text-sm font-medium text-gray-900 mb-2"
              >
                First Name
              </label>
              <input
                id="firstName"
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="John"
                required
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
            </div>
            <div>
              <label
                htmlFor="lastName"
                className="block text-sm font-medium text-gray-900 mb-2"
              >
                Last Name
              </label>
              <input
                id="lastName"
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Doe"
                required
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="phone"
              className="block text-sm font-medium text-gray-900 mb-2"
            >
              Phone Number
            </label>
            <input
              id="phone"
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+8801XXXXXXXXX"
              required
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            />
          </div>

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
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-900 mb-2"
            >
              Password
            </label>
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
            <p className="text-xs text-gray-500 mt-1">At least 8 characters</p>
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-gray-900 mb-2"
            >
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="••••••••"
              required
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-1 ${
                passwordError
                  ? 'border-red-500 focus:border-red-600 focus:ring-red-600'
                  : 'border-gray-200 focus:border-blue-600 focus:ring-blue-600'
              }`}
            />
            {passwordError && (
              <p className="text-xs text-red-600 mt-1">{passwordError}</p>
            )}
          </div>

          <div className="flex items-start gap-2 pt-2">
            <input
              id="terms"
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="w-4 h-4 rounded border-gray-200 cursor-pointer mt-1"
            />
            <label
              htmlFor="terms"
              className="text-xs text-gray-600 cursor-pointer leading-relaxed"
            >
              I agree to the{' '}
              <Link href="#" className="text-blue-600 hover:text-blue-700">
                Terms & Conditions
              </Link>{' '}
              and{' '}
              <Link href="#" className="text-blue-600 hover:text-blue-700">
                Privacy Policy
              </Link>
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 text-white font-semibold py-2 rounded-lg hover:bg-blue-700 transition mt-6 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? 'Creating Account...' : 'Create Account'}
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
          <button
            type="button"
            onClick={() => handleSocialSignup('google')}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition text-sm font-medium"
          >
            <GoogleIcon />
            Sign up with Google
          </button>
          <button
            type="button"
            onClick={() => handleSocialSignup('facebook')}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition text-sm font-medium"
          >
            <FacebookIcon />
            Sign up with Facebook
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link
            href="/login"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
