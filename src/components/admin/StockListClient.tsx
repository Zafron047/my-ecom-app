'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import VariantInventoryInlineForm from '@/components/admin/VariantInventoryInlineForm';

type StockRow = {
  id: string;
  product: {
    id: string;
    name: string;
    slug: string;
    status: string;
  };
  sku: string;
  color: string | null;
  size: string | null;
  imagePath: string | null;
  stockQuantity: number;
  reorderLevel: number;
  isActive: boolean;
  updatedAt: string;
};

type StockListClientProps = {
  initialLevel: string;
  initialQuery: string;
  initialVariantState: string;
  rows: StockRow[];
  onSubmit: (formData: FormData) => void | Promise<void>;
};

function formatDate(value: Date) {
  return value.toLocaleDateString('en-BD', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(value: Date) {
  return value.toLocaleTimeString('en-BD', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export default function StockListClient({
  initialLevel,
  initialQuery,
  initialVariantState,
  onSubmit,
  rows,
}: StockListClientProps) {
  const [query, setQuery] = useState(initialQuery);
  const [level, setLevel] = useState(initialLevel);
  const [variantState, setVariantState] = useState(initialVariantState);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();

    return rows.filter((row) => {
      const stateMatch =
        variantState === 'active'
          ? row.isActive
          : variantState === 'inactive'
            ? !row.isActive
            : true;
      if (!stateMatch) return false;

      const levelMatch =
        level === 'out'
          ? row.stockQuantity <= 0
          : level === 'low'
            ? row.stockQuantity > 0 && row.stockQuantity <= row.reorderLevel
            : level === 'healthy'
              ? row.stockQuantity > row.reorderLevel
              : true;

      if (!levelMatch) return false;
      if (!q) return true;

      const text = [
        row.product.name,
        row.product.slug,
        row.sku,
        row.color ?? '',
        row.size ?? '',
      ]
        .join(' ')
        .toLowerCase();

      return text.includes(q);
    });
  }, [level, query, rows, variantState]);
  const totalUnits = filteredRows.reduce((sum, row) => sum + row.stockQuantity, 0);
  const outOfStockCount = filteredRows.filter((row) => row.stockQuantity <= 0).length;
  const lowStockCount = filteredRows.filter(
    (row) => row.stockQuantity > 0 && row.stockQuantity <= row.reorderLevel,
  ).length;
  const productCount = new Set(filteredRows.map((row) => row.product.id)).size;

  const cardBaseClass =
    'rounded-2xl border p-4 text-left shadow-sm ring-1 transition hover:shadow-md';
  const isLevelActive = (target: string) => level === target;

  return (
    <>
      <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <button
          type="button"
          onClick={() => setLevel('')}
          className={`${cardBaseClass} ${
            level === ''
              ? 'border-slate-300 bg-slate-100 ring-slate-200'
              : 'border-slate-200/90 bg-gradient-to-br from-white to-slate-50 ring-slate-100'
          }`}
        >
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Products</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{productCount}</p>
        </button>
        <button
          type="button"
          onClick={() => setLevel('')}
          className={`${cardBaseClass} ${
            level === ''
              ? 'border-slate-300 bg-slate-100 ring-slate-200'
              : 'border-slate-200/90 bg-gradient-to-br from-white to-slate-50 ring-slate-100'
          }`}
        >
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Variants</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{filteredRows.length}</p>
        </button>
        <button
          type="button"
          onClick={() => setLevel('')}
          className={`${cardBaseClass} ${
            level === ''
              ? 'border-slate-300 bg-slate-100 ring-slate-200'
              : 'border-slate-200/90 bg-gradient-to-br from-white to-slate-50 ring-slate-100'
          }`}
        >
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Total Units</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{totalUnits}</p>
        </button>
        <button
          type="button"
          onClick={() => setLevel('low')}
          className={`${cardBaseClass} ${
            isLevelActive('low')
              ? 'border-amber-300 bg-amber-100 ring-amber-200'
              : 'border-amber-200/90 bg-gradient-to-br from-amber-50 to-lime-50 ring-amber-100'
          }`}
        >
          <p className="text-xs uppercase tracking-[0.14em] text-amber-700">Low Stock</p>
          <p className="mt-2 text-2xl font-semibold text-amber-900">{lowStockCount}</p>
        </button>
        <button
          type="button"
          onClick={() => setLevel('out')}
          className={`${cardBaseClass} ${
            isLevelActive('out')
              ? 'border-rose-300 bg-rose-100 ring-rose-200'
              : 'border-rose-200/90 bg-gradient-to-br from-rose-50 to-red-50 ring-rose-100'
          }`}
        >
          <p className="text-xs uppercase tracking-[0.14em] text-rose-700">Out of Stock</p>
          <p className="mt-2 text-2xl font-semibold text-rose-900">{outOfStockCount}</p>
        </button>
      </div>

      <div className="sticky top-20 z-30 -mx-1 mb-3 grid gap-3 border-b border-slate-100 bg-white/95 px-1 pb-3 pt-1 backdrop-blur md:grid-cols-[minmax(0,1fr)_170px_170px]">
        <div className="relative">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search product, SKU, color, size"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-8 text-sm outline-none transition focus:border-blue-300"
          />
          {query.trim().length > 0 && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            >
              ×
            </button>
          )}
        </div>
        <div className="relative">
          <select
            value={variantState}
            onChange={(event) => setVariantState(event.target.value)}
            className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 pr-10 text-sm outline-none transition focus:border-blue-300"
          >
            <option value="">All variants</option>
            <option value="active">Active variants</option>
            <option value="inactive">Inactive variants</option>
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-500">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M5.5 7.5 10 12l4.5-4.5h-9Z" />
            </svg>
          </span>
        </div>
        <div className="relative">
          <select
            value={level}
            onChange={(event) => setLevel(event.target.value)}
            className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 pr-10 text-sm outline-none transition focus:border-blue-300"
          >
            <option value="">All levels</option>
            <option value="out">Out of stock</option>
            <option value="low">Low stock</option>
            <option value="healthy">Healthy</option>
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-500">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M5.5 7.5 10 12l4.5-4.5h-9Z" />
            </svg>
          </span>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-xs">
          <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2">Variant</th>
              <th className="px-3 py-2">SKU</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Stock</th>
              <th className="px-3 py-2 text-right">Reorder</th>
              <th className="px-3 py-2">Level</th>
              <th className="px-3 py-2">Updated</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRows.length > 0 ? (
              filteredRows.map((row) => {
                const isLow =
                  row.stockQuantity > 0 && row.stockQuantity <= row.reorderLevel;
                const updatedAt = new Date(row.updatedAt);
                return (
                  <tr
                    key={row.id}
                    className={isLow ? 'bg-amber-50/30' : ''}
                  >
                    <td className="px-3 py-3">
                      <p className="text-xs font-medium text-slate-900">{row.product.name}</p>
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      <div className="flex flex-col items-start gap-1.5">
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                          {row.imagePath ? (
                            <Image
                              src={row.imagePath}
                              alt={`${row.product.name} variant`}
                              fill
                              unoptimized
                              sizes="40px"
                              className="object-contain p-0.5"
                            />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-[10px] font-semibold uppercase text-slate-400">
                              N/A
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] leading-4">
                          {(row.color?.trim() || 'Standard') +
                            ' / ' +
                            (row.size?.trim() || 'Standard')}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-[10px] text-slate-600">{row.sku}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          row.isActive
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {row.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <VariantInventoryInlineForm
                      variantId={row.id}
                      initialStockQuantity={row.stockQuantity}
                      initialReorderLevel={row.reorderLevel}
                      updatedAtDateLabel={formatDate(updatedAt)}
                      updatedAtTimeLabel={formatTime(updatedAt)}
                      q={query}
                      level={level}
                      onSubmit={onSubmit}
                    />
                  </tr>
                );
              })
            ) : (
              <tr>
                <td className="px-3 py-6 text-center text-slate-500" colSpan={9}>
                  No stock rows match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
