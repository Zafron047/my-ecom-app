'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type PurchaseOrderDraftDeleteButtonProps = {
  action: (formData: FormData) => Promise<{ error?: string; message?: string }>;
  draftId: string;
};

function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      className="block h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </svg>
  );
}

export default function PurchaseOrderDraftDeleteButton({
  action,
  draftId,
}: PurchaseOrderDraftDeleteButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  async function deleteDraft() {
    if (isDeleting) return;
    const confirmed = window.confirm('Delete this PO Draft?');
    if (!confirmed) return;

    const formData = new FormData();
    formData.set('purchaseOrderId', draftId);

    setIsDeleting(true);
    try {
      const result = await action(formData);
      if (result.error) {
        window.alert(result.error);
        return;
      }
      router.replace('/admin/purchase-order/draft');
      router.refresh();
    } catch {
      window.alert('Failed to delete PO Draft.');
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <button
      type="button"
      aria-label="Delete PO Draft"
      title="Delete PO Draft"
      disabled={isDeleting}
      onClick={deleteDraft}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600 transition hover:bg-rose-100 hover:text-rose-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
    >
      <TrashIcon />
    </button>
  );
}
