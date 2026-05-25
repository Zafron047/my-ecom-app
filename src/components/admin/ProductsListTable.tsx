'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useActionState, useMemo, useState } from 'react';

type ProductsBulkActionState = {
  error: string | null;
  message: string | null;
  appliedCount: number;
  skipped: Array<{
    id: string;
    name: string;
    reasons: string[];
  }>;
};

const INITIAL_PRODUCTS_BULK_ACTION_STATE: ProductsBulkActionState = {
  error: null,
  message: null,
  appliedCount: 0,
  skipped: [],
};

type ProductListRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  categoriesLabel: string;
  minimumPrice: number | null;
  variantCount: number;
  stock: number;
  priceLabel: string;
  primaryImage: {
    storagePath: string;
    altText: string | null;
  } | null;
};

type ProductSortKey =
  | 'product'
  | 'status'
  | 'categories'
  | 'variants'
  | 'stock'
  | 'price'
  | 'updated';
type ProductSortDirection = 'asc' | 'desc';

type ProductsListTableProps = {
  applyProductsBulkActionWithState: (
    state: ProductsBulkActionState,
    formData: FormData,
  ) => Promise<ProductsBulkActionState>;
  canDeleteProducts: boolean;
  canManageProducts: boolean;
  products: ProductListRow[];
};

function getDefaultSortDirection(sort: ProductSortKey): ProductSortDirection {
  return sort === 'product' || sort === 'status' || sort === 'categories'
    ? 'asc'
    : 'desc';
}

function compareText(first: string, second: string) {
  return first.localeCompare(second, undefined, {
    sensitivity: 'base',
    numeric: true,
  });
}

function compareNullableNumbers(
  first: number | null,
  second: number | null,
  direction: ProductSortDirection,
) {
  if (first === null && second === null) return 0;
  if (first === null) return 1;
  if (second === null) return -1;
  return direction === 'asc' ? first - second : second - first;
}

function SortIcon({
  active,
  direction,
}: {
  active: boolean;
  direction: ProductSortDirection;
}) {
  return (
    <svg
      className="h-3.5 w-3.5"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {active ? (
        <path d={direction === 'asc' ? 'm6 12 4-4 4 4' : 'm6 8 4 4 4-4'} />
      ) : (
        <>
          <path d="m7 8 3-3 3 3" />
          <path d="m7 12 3 3 3-3" />
        </>
      )}
    </svg>
  );
}

export default function ProductsListTable({
  applyProductsBulkActionWithState,
  canDeleteProducts,
  canManageProducts,
  products,
}: ProductsListTableProps) {
  const router = useRouter();
  const [sort, setSort] = useState<ProductSortKey>('updated');
  const [direction, setDirection] = useState<ProductSortDirection>('desc');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [bulkActionState, bulkActionFormAction, isBulkActionPending] =
    useActionState(applyProductsBulkActionWithState, INITIAL_PRODUCTS_BULK_ACTION_STATE);

  const allSelected =
    products.length > 0 && selectedProductIds.length === products.length;
  const hasSelection = selectedProductIds.length > 0;

  const selectedSet = useMemo(
    () => new Set(selectedProductIds),
    [selectedProductIds],
  );

  const sortedProducts = useMemo(() => {
    const sorted = [...products];

    sorted.sort((first, second) => {
      if (sort === 'updated') return 0;

      const multiplier = direction === 'asc' ? 1 : -1;
      const result =
        sort === 'product'
          ? compareText(first.name, second.name)
          : sort === 'status'
            ? compareText(first.status, second.status)
            : sort === 'categories'
              ? compareText(first.categoriesLabel, second.categoriesLabel)
              : sort === 'variants'
                ? first.variantCount - second.variantCount
                : sort === 'stock'
                ? first.stock - second.stock
                : sort === 'price'
                    ? compareNullableNumbers(
                        first.minimumPrice,
                        second.minimumPrice,
                        direction,
                      )
                    : 0;

      if (sort === 'price' && result !== 0) return result;
      if (result !== 0) return result * multiplier;
      return compareText(first.name, second.name);
    });

    return sorted;
  }, [direction, products, sort]);

  function updateSort(nextSort: ProductSortKey) {
    if (sort === nextSort) {
      setDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSort(nextSort);
    setDirection(getDefaultSortDirection(nextSort));
  }

  function renderSortableHeader(
    label: string,
    nextSort: ProductSortKey,
    align: 'left' | 'right' = 'left',
  ) {
    const isActive = sort === nextSort;

    return (
      <button
        type="button"
        onClick={() => updateSort(nextSort)}
        className={`inline-flex w-full items-center gap-1.5 rounded-md px-1 py-0.5 transition hover:bg-slate-100 hover:text-slate-700 ${
          align === 'right' ? 'justify-end' : 'justify-start'
        } ${isActive ? 'text-slate-900' : ''}`}
        aria-label={`Sort by ${label}`}
      >
        <span>{label}</span>
        <SortIcon active={isActive} direction={direction} />
      </button>
    );
  }

  return (
    <div className="overflow-x-auto">
      {canManageProducts ? (
        <form
          action={bulkActionFormAction}
          className="mb-3 flex justify-end"
          onSubmit={(event) => {
            const formData = new FormData(event.currentTarget);
            if (formData.get('bulkAction') !== 'delete') return;
            if (
              !window.confirm(
                'Delete selected products permanently? Products with order history will be skipped and should be archived instead.',
              )
            ) {
              event.preventDefault();
            }
          }}
        >
          {selectedProductIds.map((id) => (
            <input key={id} type="hidden" name="productIds" value={id} />
          ))}
          <div className="flex items-center gap-2">
            <select
              name="bulkAction"
              defaultValue=""
              disabled={!hasSelection || isBulkActionPending}
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="" disabled>
                Actions
              </option>
              <option value="set-active">Set status: Active</option>
              <option value="set-draft">Set status: Draft</option>
              <option value="set-archived">Set status: Archived</option>
              <option value="archive">Archive</option>
              <option value="unarchive">Unarchive (to draft)</option>
              {canDeleteProducts ? (
                <option value="delete">Delete permanently</option>
              ) : null}
            </select>
            <button
              type="submit"
              disabled={!hasSelection || isBulkActionPending}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isBulkActionPending
                ? 'Applying...'
                : `Apply (${selectedProductIds.length})`}
            </button>
          </div>
        </form>
      ) : null}
      {bulkActionState.error ? (
        <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {bulkActionState.error}
        </p>
      ) : null}
      {bulkActionState.message ? (
        <div className="mb-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          <p className="font-semibold text-slate-900">{bulkActionState.message}</p>
          {bulkActionState.skipped.length > 0 ? (
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {bulkActionState.skipped.slice(0, 10).map((item) => (
                <li key={item.id}>
                  {item.name}: {item.reasons.join(', ')}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <table className="min-w-full border-collapse text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 [&_th]:border-b [&_th]:border-slate-200">
          <tr>
            <th className="px-3 py-2 align-middle">
              <div className="flex items-center justify-center gap-2">
                {canManageProducts ? (
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(event) =>
                      setSelectedProductIds(
                        event.target.checked ? products.map((product) => product.id) : [],
                      )
                    }
                    aria-label="Select all products"
                    className="h-4 w-4 accent-blue-600"
                  />
                ) : null}
                <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  {selectedProductIds.length}/{products.length}
                </span>
              </div>
            </th>
            <th className="px-3 py-2">{renderSortableHeader('Product', 'product')}</th>
            <th className="px-3 py-2">{renderSortableHeader('Status', 'status')}</th>
            <th className="px-3 py-2">
              {renderSortableHeader('Categories', 'categories')}
            </th>
            <th className="px-3 py-2">
              {renderSortableHeader('Variants', 'variants')}
            </th>
            <th className="px-3 py-2 text-right">
              {renderSortableHeader('Stock', 'stock', 'right')}
            </th>
            <th className="px-3 py-2 text-right">
              {renderSortableHeader('Price', 'price', 'right')}
            </th>
          </tr>
        </thead>
        <tbody className="[&_td]:border-b [&_td]:border-slate-100">
          {sortedProducts.length > 0 ? (
            sortedProducts.map((product) => (
              <tr
                key={product.id}
                className={`align-top hover:bg-slate-50/70 ${
                  canManageProducts ? 'cursor-pointer' : ''
                }`}
                onClick={() => {
                  if (canManageProducts) {
                    router.push(`/admin/products/${product.id}/edit`);
                  }
                }}
              >
                <td className="px-3 py-3 align-middle" onClick={(event) => event.stopPropagation()}>
                  <div className="flex items-center justify-center">
                    {canManageProducts ? (
                      <input
                        type="checkbox"
                        checked={selectedSet.has(product.id)}
                        onChange={(event) =>
                          setSelectedProductIds((current) =>
                            event.target.checked
                              ? [...current, product.id]
                              : current.filter((id) => id !== product.id),
                          )
                        }
                        aria-label={`Select ${product.name}`}
                        className="h-4 w-4 accent-blue-600"
                      />
                    ) : null}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase text-slate-400">
                      {product.primaryImage ? (
                        <Image
                          src={product.primaryImage.storagePath}
                          alt={product.primaryImage.altText ?? product.name}
                          fill
                          unoptimized
                          sizes="48px"
                          className="object-contain p-1"
                        />
                      ) : (
                        'No img'
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">{product.name}</p>
                      <p className="text-xs text-slate-500">{product.slug}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold capitalize text-slate-700">
                    {product.status}
                  </span>
                </td>
                <td className="px-3 py-3 text-slate-600">{product.categoriesLabel}</td>
                <td className="px-3 py-3 text-slate-600">{product.variantCount}</td>
                <td className="px-3 py-3 text-right font-semibold text-slate-900">
                  {product.stock}
                </td>
                <td className="px-3 py-3 text-right text-slate-700">
                  {product.priceLabel}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-3 py-6 text-center text-slate-500" colSpan={7}>
                No products match the current filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
