'use client';

import { useRef } from 'react';

type ProductsFiltersProps = {
  query: string;
  status: string;
};

export default function ProductsFilters({ query, status }: ProductsFiltersProps) {
  const formRef = useRef<HTMLFormElement | null>(null);

  return (
    <form
      ref={formRef}
      className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]"
    >
      <input
        name="q"
        defaultValue={query}
        placeholder="Search products or SKU"
        className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-300"
      />
      <select
        name="status"
        defaultValue={status}
        onChange={() => formRef.current?.requestSubmit()}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-300"
      >
        <option value="">All statuses</option>
        <option value="draft">Draft</option>
        <option value="active">Active</option>
        <option value="archived">Archived</option>
      </select>
      <button
        type="submit"
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
      >
        Filter
      </button>
    </form>
  );
}

