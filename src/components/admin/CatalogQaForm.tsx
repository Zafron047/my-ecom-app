'use client';

import { useActionState } from 'react';
import {
  type CatalogQaState,
  runCatalogQaChecksAction,
} from '@/app/(admin)/admin/settings/backup/actions';

const initialState: CatalogQaState = {
  error: null,
  message: null,
  checkedProducts: 0,
  checkedVariants: 0,
  totalIssues: 0,
  issueCounts: {
    missing_required: 0,
    duplicate_sku: 0,
    duplicate_slug: 0,
    broken_image_url: 0,
    invalid_stock: 0,
    draft_item: 0,
  },
  issues: [],
};

export default function CatalogQaForm() {
  const [state, formAction, isPending] = useActionState(
    runCatalogQaChecksAction,
    initialState,
  );
  const safe = state ?? initialState;

  return (
    <form action={formAction} className="mt-4 space-y-4">
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? 'Running QA...' : 'Run Catalog QA Checks'}
      </button>

      {safe.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {safe.error}
        </p>
      ) : null}

      {safe.message ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">{safe.message}</p>
          <p className="mt-1">
            Products: {safe.checkedProducts} | Variants: {safe.checkedVariants} | Issues:{' '}
            {safe.totalIssues}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Missing: {safe.issueCounts.missing_required} | Duplicate SKU:{' '}
            {safe.issueCounts.duplicate_sku} | Duplicate Slug:{' '}
            {safe.issueCounts.duplicate_slug} | Broken Image URL:{' '}
            {safe.issueCounts.broken_image_url} | Invalid Stock:{' '}
            {safe.issueCounts.invalid_stock} | Draft: {safe.issueCounts.draft_item}
          </p>
        </div>
      ) : null}

      {safe.issues.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
          <p className="font-semibold">Catalog QA Issues (showing up to 500)</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
            {safe.issues.map((issue) => (
              <li key={`${issue.code}-${issue.entityType}-${issue.entityId}-${issue.message}`}>
                <span className="font-semibold uppercase">{issue.code}</span> - {issue.label}: {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </form>
  );
}

