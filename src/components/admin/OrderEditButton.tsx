'use client';

type OrderEditButtonProps = {
  orderId: string;
};

export default function OrderEditButton({ orderId }: OrderEditButtonProps) {
  return (
    <button
      type="button"
      aria-label="Edit order"
      title="Edit order"
      onClick={() => {
        window.dispatchEvent(
          new CustomEvent('admin-order-edit-request', {
            detail: { orderId },
          }),
        );
      }}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
    >
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
        <path d="M14.69 2.86a1.5 1.5 0 0 1 2.12 2.12l-8.3 8.3-3.35.85.84-3.35 8.7-7.92Zm-9 9.6 1.86 1.86" />
      </svg>
    </button>
  );
}

