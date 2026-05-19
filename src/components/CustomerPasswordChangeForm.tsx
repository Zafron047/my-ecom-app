'use client';

import { useState, useTransition } from 'react';

export default function CustomerPasswordChangeForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [feedback, setFeedback] = useState<{
    kind: 'error' | 'success';
    message: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    if (newPassword !== confirmPassword) {
      setFeedback({ kind: 'error', message: 'New passwords do not match.' });
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch('/api/account/password', {
          body: JSON.stringify({ currentPassword, newPassword }),
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
            message: payload.error ?? 'Could not change password.',
          });
          return;
        }

        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setFeedback({ kind: 'success', message: 'Password changed.' });
      } catch {
        setFeedback({
          kind: 'error',
          message: 'Could not change password. Please try again.',
        });
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
    >
      <h2 className="text-base font-semibold text-slate-900">Password</h2>
      <div className="mt-4 space-y-3">
        <label className="block text-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Current password
          </span>
          <input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-300"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            New password
          </span>
          <input
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-300"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Confirm new password
          </span>
          <input
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-300"
            required
          />
        </label>
      </div>

      {feedback ? (
        <p
          className={`mt-3 rounded-lg border px-3 py-2 text-sm font-medium ${
            feedback.kind === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {feedback.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {isPending ? 'Changing...' : 'Change password'}
      </button>
    </form>
  );
}
