'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useActionState, useMemo, useState } from 'react';
import {
  INITIAL_PRODUCTS_BULK_ACTION_STATE,
  type ProductsBulkActionState,
} from '@/app/(admin)/admin/products/actions';

type ProductListRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  categoriesLabel: string;
  variantCount: number;
  stock: number;
  priceLabel: string;
  primaryImage: {
    storagePath: string;
    altText: string | null;
  } | null;
};

type ProductsListTableProps = {
  products: ProductListRow[];
  applyProductsBulkActionWithState: (
    state: ProductsBulkActionState,
    formData: FormData,
  ) => Promise<ProductsBulkActionState>;
};

export default function ProductsListTable({
  products,
  applyProductsBulkActionWithState,
}: ProductsListTableProps) {
  const router = useRouter();
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

  return (
    <div className="overflow-x-auto">
      <form action={bulkActionFormAction} className="mb-3 flex justify-end">
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

      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2 align-middle">
              <div className="flex items-center justify-center gap-2">
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
                <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  {selectedProductIds.length}/{products.length}
                </span>
              </div>
            </th>
            <th className="px-3 py-2">Product</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Categories</th>
            <th className="px-3 py-2">Variants</th>
            <th className="px-3 py-2 text-right">Stock</th>
            <th className="px-3 py-2 text-right">Price</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {products.length > 0 ? (
            products.map((product) => (
              <tr
                key={product.id}
                className="align-top transition hover:bg-slate-50/70 cursor-pointer"
                onClick={() => router.push(`/admin/products/${product.id}/edit`)}
              >
                <td className="px-3 py-3 align-middle" onClick={(event) => event.stopPropagation()}>
                  <div className="flex items-center justify-center">
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
