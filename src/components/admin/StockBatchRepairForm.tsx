'use client';

import { useActionState } from 'react';
import {
  repairMissingStockBatchesAction,
  type StockBatchRepairState,
} from '@/app/(admin)/admin/settings/backup/actions';

const initialState: StockBatchRepairState = {
  error: null,
  message: null,
  stockBatchesCreated: 0,
  stockBatchesToCreate: 0,
  totalQuantity: 0,
};

export default function StockBatchRepairForm() {
  const [state, formAction, isPending] = useActionState(
    repairMissingStockBatchesAction,
    initialState,
  );
  const safeState = state ?? initialState;

  return (
    <form action={formAction} className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          name="mode"
          value="dry-run"
          disabled={isPending}
          className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? 'Checking...' : 'Check Missing Batches'}
        </button>
        <button
          type="submit"
          name="mode"
          value="apply"
          disabled={isPending}
          className="inline-flex items-center rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? 'Creating...' : 'Create Repair Batches'}
        </button>
      </div>

      {safeState.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {safeState.error}
        </p>
      ) : null}

      {safeState.message ? (
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">{safeState.message}</p>
          <p className="mt-1">
            Variants: {safeState.stockBatchesCreated || safeState.stockBatchesToCreate}
            {' '}| Units: {safeState.totalQuantity}
          </p>
        </div>
      ) : null}
    </form>
  );
}
