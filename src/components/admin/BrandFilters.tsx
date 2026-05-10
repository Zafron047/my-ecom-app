'use client';

import type { ReactNode } from 'react';

type BrandFiltersProps = {
  activeControl?: ReactNode;
  query: string;
  status: string;
};

export default function BrandFilters({
  activeControl,
  query,
  status,
}: BrandFiltersProps) {
  return (
    <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]">
      <input
        name="q"
        defaultValue={query}
        placeholder="Search brands"
        className="h-10 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-300"
      />
      <select
        name="status"
        defaultValue={status}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-300"
      >
        <option value="">All statuses</option>
        <option value="active">Active</option>
        <option value="archived">Archived</option>
      </select>
      {activeControl ? (
        <div className="flex items-center">{activeControl}</div>
      ) : null}
    </form>
  );
}
