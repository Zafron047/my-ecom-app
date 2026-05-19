'use client';

import Link from 'next/link';
import { useState } from 'react';

type CustomerResetPasswordFormProps = {
  token: string;
};

export default function CustomerResetPasswordForm({
  token,
}: CustomerResetPasswordFormProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [feedback, setFeedback] = useState<{
    kind: 'error' | 'success';
    message: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    if (newPassword !== confirmPassword) {
      setFeedback({ kind: 'error', message: 'New passwords do not match.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/password-reset/consume', {
        body: JSON.stringify({ newPassword, token }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      const payload = (await response.json()) as {
        error?: string;
        success?: boolean;
      };

      if (!response.ok || !payload.success) {
        setFeedback({
          kind: 'error',
          message: payload.error ?? 'Password reset failed.',
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
        <h1 className="text-2xl font-bold text-gray-900">Set New Password</h1>
      </div>

      {feedback ? (
        <div
          className={`mb-4 rounded-lg border px-3 py-2 text-sm ${
            feedback.kind === 'error'
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-gray-900">
            New password
          </span>
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
            className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-gray-900">
            Confirm new password
          </span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
            className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
        </label>

        <button
          type="submit"
          disabled={isSubmitting || feedback?.kind === 'success'}
          className="w-full rounded-lg bg-blue-600 py-2 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? 'Resetting...' : 'Reset password'}
        </button>
      </form>

      {feedback?.kind === 'success' ? (
        <Link
          href="/login"
          className="mt-4 inline-flex w-full items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
        >
          Go to login
        </Link>
      ) : null}
    </div>
  );
}
