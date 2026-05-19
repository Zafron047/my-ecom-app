'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export default function CustomerSessionManagementForm() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleRevokeAll() {
    setError('');
    startTransition(async () => {
      try {
        const response = await fetch('/api/account/sessions/revoke-all', {
          method: 'POST',
        });
        if (!response.ok) {
          const payload = (await response.json()) as { error?: string };
          setError(payload.error ?? 'Could not log out all devices.');
          return;
        }

        router.push('/login');
        router.refresh();
      } catch {
        setError('Could not log out all devices. Please try again.');
      }
    });
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">Sessions</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Log out this account from every browser and device.
      </p>
      {error ? (
        <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={isPending}
        onClick={handleRevokeAll}
        className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? 'Logging out...' : 'Log out all devices'}
      </button>
    </section>
  );
}
