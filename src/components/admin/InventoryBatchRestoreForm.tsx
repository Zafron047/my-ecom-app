'use client';

import { useEffect, useMemo } from 'react';
import { useActionState } from 'react';
import {
  type InventoryBatchRestoreState,
  restoreInventoryBatchesBackupAction,
} from '@/app/(admin)/admin/settings/backup/actions';

const initialState: InventoryBatchRestoreState = {
  error: null,
  message: null,
  processed: 0,
  toCreate: 0,
  skipped: 0,
  errors: [],
  errorCsv: null,
  preview: [],
};

export default function InventoryBatchRestoreForm() {
  const [state, formAction, isPending] = useActionState(
    restoreInventoryBatchesBackupAction,
    initialState,
  );
  const safeState = state ?? initialState;
  const safeErrors = Array.isArray(safeState.errors) ? safeState.errors : [];
  const safePreview = Array.isArray(safeState.preview)
    ? safeState.preview.filter((item) => item.action !== 'no-change')
    : [];
  const errorCsvDownloadUrl = useMemo(() => {
    if (!safeState.errorCsv) return null;
    const blob = new Blob([safeState.errorCsv], { type: 'text/csv;charset=utf-8' });
    return URL.createObjectURL(blob);
  }, [safeState.errorCsv]);

  useEffect(() => {
    return () => {
      if (errorCsvDownloadUrl) URL.revokeObjectURL(errorCsvDownloadUrl);
    };
  }, [errorCsvDownloadUrl]);

  return (
    <form action={formAction} className="mt-4 space-y-4">
      <label className="block space-y-2 text-sm font-medium text-slate-700">
        <span>Upload Inventory Batch CSV</span>
        <input
          type="file"
          name="inventoryBackupFile"
          accept=".csv,text/csv"
          required
          className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          name="mode"
          value="dry-run"
          disabled={isPending}
          className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? 'Processing...' : 'Dry Run'}
        </button>
        <button
          type="submit"
          name="mode"
          value="apply"
          disabled={isPending}
          className="inline-flex items-center rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? 'Applying...' : 'Apply Batch Restore'}
        </button>
      </div>

      {safeState.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {safeState.error}
        </p>
      ) : null}

      {safeState.message ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">{safeState.message}</p>
          <p className="mt-1">
            Processed: {safeState.processed} | Create: {safeState.toCreate} |
            {' '}Skipped: {safeState.skipped}
          </p>
        </div>
      ) : null}

      {safeErrors.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p className="font-semibold">Validation issues</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {safeErrors.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {errorCsvDownloadUrl ? (
            <a
              href={errorCsvDownloadUrl}
              download="inventory-batches-restore-errors.csv"
              className="mt-3 inline-flex items-center rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100"
            >
              Download Error CSV
            </a>
          ) : null}
        </div>
      ) : null}

      {safePreview.length > 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800">
          <p className="font-semibold text-slate-900">Dry Run Preview</p>
          <p className="mt-1 text-xs text-slate-600">
            Showing up to 50 changed rows only.
          </p>
          <div className="mt-3 space-y-3">
            {safePreview.map((item) => (
              <div key={`${item.row}-${item.batchNumber}`} className="rounded-md border border-slate-200 p-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Row {item.row} - {item.batchNumber} - {item.action}
                </p>
                {item.changes.length === 0 ? (
                  <p className="mt-1 text-xs text-slate-600">No field changes.</p>
                ) : (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                    {item.changes.map((change) => (
                      <li key={`${item.row}-${item.batchNumber}-${change.field}`}>
                        <span className="font-semibold">{change.field}</span>: {change.from} - {change.to}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </form>
  );
}
