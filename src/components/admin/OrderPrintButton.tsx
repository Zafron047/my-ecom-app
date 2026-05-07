'use client';

import { useEffect, useState } from 'react';

export default function OrderPrintButton() {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    function handleDirtyState(event: Event) {
      const customEvent = event as CustomEvent<{ dirty?: boolean }>;
      setHasUnsavedChanges(Boolean(customEvent.detail?.dirty));
    }

    window.addEventListener('admin-order-dirty', handleDirtyState as EventListener);
    return () => {
      window.removeEventListener('admin-order-dirty', handleDirtyState as EventListener);
    };
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.print()}
      disabled={hasUnsavedChanges}
      aria-label="Print order"
      title={
        hasUnsavedChanges
          ? 'Update or cancel changes before printing'
          : 'Print order document'
      }
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
        <path d="M5 2h10v4H5V2Zm10 11v5H5v-5h10Zm1-6a2 2 0 0 1 2 2v5h-3v-3H5v3H2V9a2 2 0 0 1 2-2h12Z" />
      </svg>
    </button>
  );
}

