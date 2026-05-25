'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

export default function CustomerForgotPasswordForm() {
  const searchParams = useSearchParams();
  const isAdminReset = searchParams.get('account') === 'admin';
  const [identifier, setIdentifier] = useState('');
  const [feedback, setFeedback] = useState<{
    kind: 'error' | 'success';
    message: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(
        isAdminReset
          ? '/api/admin/password-reset/request'
          : '/api/password-reset/request',
        {
          body: JSON.stringify(
            isAdminReset ? { email: identifier } : { identifier },
          ),
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        },
      );
      const payload = (await response.json()) as {
        error?: string;
        success?: boolean;
      };

      if (!response.ok || !payload.success) {
        setFeedback({
          kind: 'error',
          message: payload.error ?? 'Could not request password reset.',
        });
        return;
      }

      setFeedback({
        kind: 'success',
        message:
          isAdminReset
            ? 'If an active admin account matches that email, a password reset link will be emailed shortly.'
            : 'If an account matches that phone or email, a password reset link will be emailed shortly.',
      });
    } catch {
      setFeedback({
        kind: 'error',
        message: 'Could not request password reset. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Reset Password</h1>
        <p className="mt-2 text-sm text-gray-600">
          {isAdminReset
            ? 'Enter your admin email to get a reset link.'
            : 'Enter your phone or email to get a reset link.'}
        </p>
      </div>

      {feedback ? (
        <div
          className={`mb-4 rounded-lg border px-3 py-2 text-sm ${
            feedback.kind === 'error'
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          <p>{feedback.message}</p>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-gray-900">
            {isAdminReset ? 'Admin email' : 'Phone or email'}
          </span>
          <input
            type={isAdminReset ? 'email' : 'text'}
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            autoComplete="username"
            required
            className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
        </label>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-blue-600 py-2 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? 'Sending...' : 'Request reset'}
        </button>
      </form>

      <Link
        href="/login"
        className="mt-4 inline-flex w-full items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
      >
        Back to login
      </Link>
    </div>
  );
}
