'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

type StockFiltersProps = {
  query: string;
  level: string;
};

export default function StockFilters({ query, level }: StockFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = useState(query);
  const [levelValue, setLevelValue] = useState(level);

  useEffect(() => {
    setSearchValue(query);
  }, [query]);

  useEffect(() => {
    setLevelValue(level);
  }, [level]);

  useEffect(() => {
    const handle = setTimeout(() => {
      const next = new URLSearchParams(searchParams.toString());
      next.delete('edit');
      const trimmed = searchValue.trim();
      if (trimmed) {
        next.set('q', trimmed);
      } else {
        next.delete('q');
      }

      if (levelValue) {
        next.set('level', levelValue);
      } else {
        next.delete('level');
      }

      const current = new URLSearchParams(searchParams.toString());
      current.delete('edit');
      const nextQuery = next.toString();
      const currentQuery = current.toString();

      if (nextQuery === currentQuery) return;

      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
    }, 180);

    return () => clearTimeout(handle);
  }, [levelValue, pathname, router, searchParams, searchValue]);

  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_190px]">
      <div className="relative">
        <input
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          placeholder="Search product, SKU, color, size"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-8 text-sm outline-none transition focus:border-blue-300"
        />
        {searchValue.trim().length > 0 && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setSearchValue('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            ×
          </button>
        )}
      </div>

      <select
        value={levelValue}
        onChange={(event) => setLevelValue(event.target.value)}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-300"
      >
        <option value="">All levels</option>
        <option value="out">Out of stock</option>
        <option value="low">Low stock</option>
        <option value="healthy">Healthy</option>
      </select>
    </div>
  );
}
