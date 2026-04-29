'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';

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
  removeProductAction: (formData: FormData) => void | Promise<void>;
  removeProductsBulkAction: (formData: FormData) => void | Promise<void>;
  unarchiveProductAction: (formData: FormData) => void | Promise<void>;
};

export default function ProductsListTable({
  products,
  removeProductAction,
  removeProductsBulkAction,
  unarchiveProductAction,
}: ProductsListTableProps) {
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  const allSelected =
    products.length > 0 && selectedProductIds.length === products.length;
  const hasSelection = selectedProductIds.length > 0;

  const selectedSet = useMemo(
    () => new Set(selectedProductIds),
    [selectedProductIds],
  );

  return (
    <div className="overflow-x-auto">
      <form action={removeProductsBulkAction} className="mb-3 flex justify-end">
        {selectedProductIds.map((id) => (
          <input key={id} type="hidden" name="productIds" value={id} />
        ))}
        <button
          type="submit"
          disabled={!hasSelection}
          className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Remove selected ({selectedProductIds.length})
        </button>
      </form>

      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2">
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
            </th>
            <th className="px-3 py-2">Product</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Categories</th>
            <th className="px-3 py-2">Variants</th>
            <th className="px-3 py-2 text-right">Stock</th>
            <th className="px-3 py-2 text-right">Price</th>
            <th className="px-3 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {products.length > 0 ? (
            products.map((product) => (
              <tr key={product.id} className="align-top">
                <td className="px-3 py-3">
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
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-2">
                    <Link
                      href={`/admin/products/${product.id}/edit`}
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Edit
                    </Link>
                    {product.status === 'archived' ? (
                      <form action={unarchiveProductAction}>
                        <input type="hidden" name="productId" value={product.id} />
                        <button
                          type="submit"
                          className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                        >
                          Unarchive
                        </button>
                      </form>
                    ) : (
                      <form action={removeProductAction}>
                        <input type="hidden" name="productId" value={product.id} />
                        <button
                          type="submit"
                          className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                        >
                          Remove
                        </button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-3 py-6 text-center text-slate-500" colSpan={8}>
                No products match the current filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
