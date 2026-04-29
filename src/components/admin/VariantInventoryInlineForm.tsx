'use client';

import { useMemo, useState } from 'react';

type VariantInventoryInlineFormProps = {
  initialReorderLevel: number;
  initialStockQuantity: number;
  levelBadgeClassName: string;
  levelBadgeLabel: string;
  level: string;
  onSubmit: (formData: FormData) => void | Promise<void>;
  q: string;
  updatedAtLabel: string;
  variantId: string;
};

export default function VariantInventoryInlineForm({
  initialReorderLevel,
  initialStockQuantity,
  levelBadgeClassName,
  levelBadgeLabel,
  level,
  onSubmit,
  q,
  updatedAtLabel,
  variantId,
}: VariantInventoryInlineFormProps) {
  const [stockQuantity, setStockQuantity] = useState(String(initialStockQuantity));
  const [reorderLevel, setReorderLevel] = useState(String(initialReorderLevel));

  const hasChanges = useMemo(
    () =>
      stockQuantity.trim() !== String(initialStockQuantity) ||
      reorderLevel.trim() !== String(initialReorderLevel),
    [initialReorderLevel, initialStockQuantity, reorderLevel, stockQuantity],
  );

  return (
    <>
      <td className="px-3 py-3 text-right font-semibold text-slate-900">
        <input
          type="number"
          min={0}
          value={stockQuantity}
          onChange={(event) => setStockQuantity(event.target.value)}
          className="w-24 rounded-md border border-slate-300 px-2 py-1 text-right text-sm outline-none focus:border-blue-300"
        />
      </td>
      <td className="px-3 py-3 text-right text-slate-700">
        <input
          type="number"
          min={0}
          value={reorderLevel}
          onChange={(event) => setReorderLevel(event.target.value)}
          className="w-24 rounded-md border border-slate-300 px-2 py-1 text-right text-sm outline-none focus:border-blue-300"
        />
      </td>
      <td className="px-3 py-3">
        <span
          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${levelBadgeClassName}`}
        >
          {levelBadgeLabel}
        </span>
      </td>
      <td className="px-3 py-3 text-xs text-slate-600">{updatedAtLabel}</td>
      <td className="px-3 py-3 text-right">
        <form action={onSubmit} className="inline">
          <input type="hidden" name="variantId" value={variantId} />
          <input type="hidden" name="q" value={q} />
          <input type="hidden" name="level" value={level} />
          <input type="hidden" name="stockQuantity" value={stockQuantity} />
          <input type="hidden" name="reorderLevel" value={reorderLevel} />
          <button
            type="submit"
            disabled={!hasChanges}
            className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-emerald-50"
          >
            Finish
          </button>
        </form>
      </td>
    </>
  );
}
