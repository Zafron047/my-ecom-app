'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type VariantInventoryInlineFormProps = {
  startInEditMode?: boolean;
  initialReorderLevel: number;
  initialStockQuantity: number;
  level: string;
  onSubmit: (formData: FormData) => void | Promise<void>;
  q: string;
  updatedAtDateLabel: string;
  updatedAtTimeLabel: string;
  variantId: string;
};

export default function VariantInventoryInlineForm({
  startInEditMode = false,
  initialReorderLevel,
  initialStockQuantity,
  level,
  onSubmit,
  q,
  updatedAtDateLabel,
  updatedAtTimeLabel,
  variantId,
}: VariantInventoryInlineFormProps) {
  const router = useRouter();
  const [isEditingInline, setIsEditingInline] = useState(startInEditMode);
  const [savedStockQuantity, setSavedStockQuantity] = useState(
    String(initialStockQuantity),
  );
  const [savedReorderLevel, setSavedReorderLevel] = useState(
    String(initialReorderLevel),
  );
  const [stockQuantity, setStockQuantity] = useState(savedStockQuantity);
  const [reorderLevel, setReorderLevel] = useState(savedReorderLevel);

  const hasChanges = useMemo(
    () =>
      stockQuantity.trim() !== savedStockQuantity ||
      reorderLevel.trim() !== savedReorderLevel,
    [reorderLevel, savedReorderLevel, savedStockQuantity, stockQuantity],
  );

  const effectiveStock = Number(savedStockQuantity) || 0;
  const effectiveReorder = Number(savedReorderLevel) || 0;
  const effectiveBadge = useMemo(() => {
    if (effectiveStock <= 0) {
      return {
        className: 'bg-rose-50 text-rose-700 border-rose-200',
        label: 'Out of stock',
      };
    }

    if (effectiveStock <= effectiveReorder) {
      return {
        className: 'bg-amber-50 text-amber-700 border-amber-200',
        label: 'Low stock',
      };
    }

    return {
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      label: 'Healthy',
    };
  }, [effectiveReorder, effectiveStock]);

  async function handleSubmit(formData: FormData) {
    await onSubmit(formData);
    setSavedStockQuantity(stockQuantity.trim());
    setSavedReorderLevel(reorderLevel.trim());
    setIsEditingInline(false);
    router.refresh();
  }

  if (!isEditingInline) {
    return (
      <>
        <td className="px-3 py-3 text-right font-semibold text-slate-900">
          {savedStockQuantity}
        </td>
        <td className="px-3 py-3 text-right text-slate-700">{savedReorderLevel}</td>
        <td className="px-3 py-3">
          <span
            className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${effectiveBadge.className}`}
          >
            {effectiveBadge.label}
          </span>
        </td>
        <td className="px-3 py-3 text-[10px] text-slate-600">
          <div>{updatedAtDateLabel}</div>
          <div>{updatedAtTimeLabel}</div>
        </td>
        <td className="px-3 py-3 text-right whitespace-nowrap">
          <button
            type="button"
            onClick={() => setIsEditingInline(true)}
            suppressHydrationWarning
            className="w-[62px] rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Update
          </button>
        </td>
      </>
    );
  }

  return (
    <>
      <td className="px-3 py-3 text-right font-semibold text-slate-900">
        <input
          type="number"
          min={0}
          value={stockQuantity}
          onChange={(event) => setStockQuantity(event.target.value)}
          className="w-12 rounded-md border border-slate-300 px-1 py-1 text-right text-xs outline-none focus:border-blue-300"
        />
      </td>
      <td className="px-3 py-3 text-right text-slate-700">
        <input
          type="number"
          min={0}
          value={reorderLevel}
          onChange={(event) => setReorderLevel(event.target.value)}
          className="w-12 rounded-md border border-slate-300 px-1 py-1 text-right text-xs outline-none focus:border-blue-300"
        />
      </td>
      <td className="px-3 py-3">
        <span
          className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${effectiveBadge.className}`}
        >
          {effectiveBadge.label}
        </span>
      </td>
      <td className="px-3 py-3 text-[10px] text-slate-600">
        <div>{updatedAtDateLabel}</div>
        <div>{updatedAtTimeLabel}</div>
      </td>
      <td className="px-3 py-3 text-right whitespace-nowrap">
        <div className="inline-flex items-center gap-1.5">
          <form action={handleSubmit} className="inline">
            <input type="hidden" name="variantId" value={variantId} />
            <input type="hidden" name="q" value={q} />
            <input type="hidden" name="level" value={level} />
            <input type="hidden" name="stockQuantity" value={stockQuantity} />
            <input type="hidden" name="reorderLevel" value={reorderLevel} />
            <button
              type="submit"
              disabled={!hasChanges}
              suppressHydrationWarning
              className="w-[62px] rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-emerald-50"
            >
              Finish
            </button>
          </form>
          <button
            type="button"
            onClick={() => {
              setStockQuantity(savedStockQuantity);
              setReorderLevel(savedReorderLevel);
              setIsEditingInline(false);
            }}
            suppressHydrationWarning
            className="w-[62px] rounded-md border border-slate-200 bg-white px-2 py-1 text-center text-xs font-semibold whitespace-nowrap text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </td>
    </>
  );
}
