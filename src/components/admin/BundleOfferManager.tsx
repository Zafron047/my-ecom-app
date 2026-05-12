'use client';

import { useRouter } from 'next/navigation';
import { Fragment, useActionState, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { BundleOfferFormState } from '@/app/(admin)/admin/products/bundles/actions';

type VariantOption = {
  color: string | null;
  id: string;
  imagePath: string | null;
  productName: string;
  size: string | null;
  sku: string;
};

type BundleOfferItem = {
  description: string | null;
  discountPercent: string;
  endsAt: string;
  id: string;
  imagePath: string | null;
  isActive: boolean;
  minTotalQty: string;
  startsAt: string;
  title: string;
  updatedAtLabel: string;
  variantIds: string[];
};

type BundleOfferManagerProps = {
  bundleOffers: BundleOfferItem[];
  createAction: (
    previousState: BundleOfferFormState,
    formData: FormData,
  ) => Promise<BundleOfferFormState>;
  updateAction: (
    previousState: BundleOfferFormState,
    formData: FormData,
  ) => Promise<BundleOfferFormState>;
  variants: VariantOption[];
};

const fieldClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:shadow-md focus:ring-2 focus:ring-slate-200';

function variantLabel(variant: VariantOption) {
  const parts = [variant.color, variant.size].filter(Boolean);
  return `${variant.productName} - ${parts.join(' / ') || 'Default'} - ${variant.sku}`;
}

function variantIdsValue(ids: string[]) {
  return [...new Set(ids)].join(',');
}

function VariantPicker({
  onChange,
  selectedIds,
  variants,
}: {
  onChange: (ids: string[]) => void;
  selectedIds: string[];
  variants: VariantOption[];
}) {
  const [query, setQuery] = useState('');
  const selected = new Set(selectedIds);
  const filtered = variants.filter((variant) =>
    variantLabel(variant).toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div className="space-y-2">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search product, SKU, color, size"
        className={fieldClass}
      />
      <div className="max-h-64 overflow-auto rounded-xl border border-slate-200 bg-white p-2">
        {filtered.length === 0 ? (
          <p className="px-2 py-1 text-xs text-slate-500">No variants found.</p>
        ) : (
          filtered.map((variant) => {
            const checked = selected.has(variant.id);
            return (
              <label
                key={variant.id}
                className={`flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition ${
                  checked
                    ? 'bg-blue-50 text-blue-900'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => {
                    onChange(
                      event.target.checked
                        ? [...selectedIds, variant.id]
                        : selectedIds.filter((id) => id !== variant.id),
                    );
                  }}
                  className="h-4 w-4 accent-blue-600"
                />
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100 bg-cover bg-center text-[10px] font-semibold uppercase text-slate-400"
                  style={
                    variant.imagePath
                      ? { backgroundImage: `url(${variant.imagePath})` }
                      : undefined
                  }
                >
                  {variant.imagePath ? (
                    <span className="sr-only">Variant thumbnail</span>
                  ) : (
                    'No img'
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate">{variantLabel(variant)}</span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

function BundleForm({
  action,
  bundle,
  formId,
  onCancel,
  onSaved,
  variants,
}: {
  action: BundleOfferManagerProps['createAction'] | BundleOfferManagerProps['updateAction'];
  bundle?: BundleOfferItem;
  formId?: string;
  onCancel?: () => void;
  onSaved: () => void;
  variants: VariantOption[];
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(action, { error: null });
  const [title, setTitle] = useState(bundle?.title ?? '');
  const [description, setDescription] = useState(bundle?.description ?? '');
  const [imagePath, setImagePath] = useState(bundle?.imagePath ?? '');
  const [minTotalQty, setMinTotalQty] = useState(bundle?.minTotalQty ?? '');
  const [discountPercent, setDiscountPercent] = useState(bundle?.discountPercent ?? '');
  const [startsAt, setStartsAt] = useState(bundle?.startsAt ?? '');
  const [endsAt, setEndsAt] = useState(bundle?.endsAt ?? '');
  const [isActive, setIsActive] = useState(bundle?.isActive ?? true);
  const [variantIds, setVariantIds] = useState(bundle?.variantIds ?? []);
  const handledSavedAtRef = useRef<number | undefined>(undefined);
  const handledArchivedAtRef = useRef<number | undefined>(undefined);
  const canSubmit =
    Boolean(title.trim()) &&
    Boolean(minTotalQty.trim()) &&
    Boolean(discountPercent.trim()) &&
    (!isActive || variantIds.length > 0) &&
    !isPending;

  useEffect(() => {
    if (!state.savedAt || handledSavedAtRef.current === state.savedAt) return;
    handledSavedAtRef.current = state.savedAt;
    onSaved();
    router.refresh();
  }, [onSaved, router, state.savedAt]);

  useEffect(() => {
    if (!state.archivedAt || handledArchivedAtRef.current === state.archivedAt) return;
    handledArchivedAtRef.current = state.archivedAt;
    onCancel?.();
    router.refresh();
  }, [onCancel, router, state.archivedAt]);

  return (
    <form
      id={formId}
      action={formAction}
      className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4"
    >
      {bundle ? <input type="hidden" name="bundleId" value={bundle.id} /> : null}
      <input type="hidden" name="variantIds" value={variantIdsValue(variantIds)} />
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_110px_120px]">
        <label className="space-y-1.5 text-sm font-medium text-slate-700">
          <span>Title</span>
          <input
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={fieldClass}
            placeholder="Buy 3 Bags get 10% OFF"
          />
        </label>
        <label className="space-y-1.5 text-sm font-medium text-slate-700">
          <span>Min Qty</span>
          <input
            name="minTotalQty"
            inputMode="numeric"
            value={minTotalQty}
            onChange={(event) => setMinTotalQty(event.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="space-y-1.5 text-sm font-medium text-slate-700">
          <span>Discount %</span>
          <input
            name="discountPercent"
            inputMode="decimal"
            value={discountPercent}
            onChange={(event) => setDiscountPercent(event.target.value)}
            className={fieldClass}
          />
        </label>
      </div>
      <label className="block space-y-1.5 text-sm font-medium text-slate-700">
        <span>Description</span>
        <textarea
          name="description"
          rows={2}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className={fieldClass}
        />
      </label>
      <label className="block space-y-1.5 text-sm font-medium text-slate-700">
        <span>Image Path</span>
        <input
          name="imagePath"
          value={imagePath}
          onChange={(event) => setImagePath(event.target.value)}
          className={fieldClass}
          placeholder="/uploads/bundles/example.webp"
        />
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1.5 text-sm font-medium text-slate-700">
          <span>Starts At</span>
          <input
            name="startsAt"
            type="datetime-local"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="space-y-1.5 text-sm font-medium text-slate-700">
          <span>Ends At</span>
          <input
            name="endsAt"
            type="datetime-local"
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
            className={fieldClass}
          />
        </label>
      </div>
      <label className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
        <input
          name="isActive"
          type="checkbox"
          checked={isActive}
          onChange={(event) => setIsActive(event.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-200"
        />
        <span>Active</span>
      </label>
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-800">
          Eligible Variants
        </p>
        <VariantPicker
          selectedIds={variantIds}
          variants={variants}
          onChange={setVariantIds}
        />
      </div>
      {state.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
          {state.success}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="submit"
          disabled={!canSubmit}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            canSubmit
              ? 'bg-blue-700 text-white hover:bg-blue-600'
              : 'cursor-not-allowed bg-slate-200 text-slate-500'
          }`}
        >
          {isPending ? 'Saving...' : bundle ? 'Save Bundle' : 'Create Bundle'}
        </button>
        <div className="flex items-center gap-2">
          {bundle ? (
            <>
              <button
                type="submit"
                name="intent"
                value="archive"
                disabled={isPending || !isActive}
                onClick={(event) => {
                  if (!window.confirm('Archive this bundle offer?')) {
                    event.preventDefault();
                  }
                }}
                className="rounded-xl border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Archive
              </button>
              <button
                type="submit"
                name="intent"
                value="delete"
                formNoValidate
                disabled={isPending}
                onClick={(event) => {
                  if (!window.confirm('Delete this bundle offer permanently?')) {
                    event.preventDefault();
                  }
                }}
                className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Delete
              </button>
            </>
          ) : null}
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </div>
    </form>
  );
}

export default function BundleOfferManager({
  bundleOffers,
  createAction,
  updateAction,
  variants,
}: BundleOfferManagerProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [openBundleId, setOpenBundleId] = useState<string | null>(null);
  const createFormId = 'create-bundle-offer-form';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Bundle Offers</h2>
          <p className="mt-1 text-sm text-slate-600">
            Create reusable cart discounts by tying variants from any products.
          </p>
        </div>
        {!isCreateOpen ? (
          <button
            type="button"
            aria-label="Add bundle offer"
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-2xl font-semibold leading-none text-blue-700 shadow-sm transition hover:bg-blue-100"
          >
            <span className="relative -top-px leading-none">+</span>
          </button>
        ) : null}
      </div>
      <AnimatePresence initial={false}>
        {isCreateOpen ? (
          <motion.div
            initial={{ height: 0, opacity: 0, y: -8 }}
            animate={{ height: 'auto', opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <BundleForm
              action={createAction}
              formId={createFormId}
              variants={variants}
              onCancel={() => setIsCreateOpen(false)}
              onSaved={() => setIsCreateOpen(false)}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Bundle</th>
              <th className="px-3 py-2">Rule</th>
              <th className="px-3 py-2">Variants</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {bundleOffers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-500">
                  No bundle offers yet.
                </td>
              </tr>
            ) : (
              bundleOffers.map((bundle) => {
                const isOpen = openBundleId === bundle.id;
                return (
                  <Fragment key={bundle.id}>
                    <tr
                      className="cursor-pointer bg-white transition hover:bg-slate-50"
                      onClick={() => setOpenBundleId(isOpen ? null : bundle.id)}
                    >
                      <td className="px-3 py-3 font-semibold text-slate-900">
                        {bundle.title}
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        Buy {bundle.minTotalQty}+ get {bundle.discountPercent}% off
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {bundle.variantIds.length}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            bundle.isActive
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {bundle.isActive ? 'Active' : 'Archived'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {bundle.updatedAtLabel}
                      </td>
                    </tr>
                    {isOpen ? (
                      <tr>
                        <td colSpan={5} className="bg-slate-50 px-3 py-3">
                          <BundleForm
                            action={updateAction}
                            bundle={bundle}
                            variants={variants}
                            onCancel={() => setOpenBundleId(null)}
                            onSaved={() => setOpenBundleId(null)}
                          />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
