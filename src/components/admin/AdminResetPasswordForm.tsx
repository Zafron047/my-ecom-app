'use client';

import Link from 'next/link';
import { useState } from 'react';

type AdminResetPasswordFormProps = {
  token: string;
};

export default function AdminResetPasswordForm({
  token,
}: AdminResetPasswordFormProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [feedback, setFeedback] = useState<{
    kind: 'error' | 'success';
    message: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    if (newPassword !== confirmPassword) {
      setFeedback({ kind: 'error', message: 'New passwords do not match.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/admin/password-reset/consume', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newPassword,
          token,
        }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setFeedback({
          kind: 'error',
          message: data.error ?? 'Password reset failed.',
        });
        return;
      }

      setNewPassword('');
      setConfirmPassword('');
      setFeedback({
        kind: 'success',
        message: 'Password reset. Sign in with the new password.',
      });
    } catch {
      setFeedback({
        kind: 'error',
        message: 'Password reset failed. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Reset Admin Password</h1>
      </div>

      {feedback && (
        <div
          className={`mb-4 rounded-lg border px-3 py-2 text-sm ${
            feedback.kind === 'error'
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {feedback.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="newPassword"
            className="mb-2 block text-sm font-medium text-gray-900"
          >
            New password
          </label>
          <div className="relative">
            <input
              id="newPassword"
              type={showNewPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              required
              className="w-full rounded-lg border border-gray-200 px-4 py-2 pr-11 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
            <button
              type="button"
              aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
              aria-pressed={showNewPassword}
              onClick={() => setShowNewPassword((current) => !current)}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-gray-500 transition hover:text-gray-900"
            >
              {showNewPassword ? (
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

        <div>
          <label
            htmlFor="confirmPassword"
            className="mb-2 block text-sm font-medium text-gray-900"
          >
            Confirm new password
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              required
              className="w-full rounded-lg border border-gray-200 px-4 py-2 pr-11 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
            <button
              type="button"
              aria-label={showConfirmPassword ? 'Hide confirmed password' : 'Show confirmed password'}
              aria-pressed={showConfirmPassword}
              onClick={() => setShowConfirmPassword((current) => !current)}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-gray-500 transition hover:text-gray-900"
            >
              {showConfirmPassword ? (
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

        <button
          type="submit"
          disabled={isSubmitting || feedback?.kind === 'success'}
          className="w-full rounded-lg bg-blue-600 py-2 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? 'Resetting...' : 'Reset Password'}
        </button>
      </form>

      {feedback?.kind === 'success' && (
        <Link
          href="/login?next=/admin"
          className="mt-4 inline-flex w-full items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
        >
          Go to Admin Login
        </Link>
      )}
    </div>
  );
}
