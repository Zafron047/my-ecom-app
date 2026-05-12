'use client';

import { useRouter } from 'next/navigation';
import { Fragment, useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { BrandFormState } from '@/app/(admin)/admin/products/brands/actions';
import BrandFilters from '@/components/admin/BrandFilters';

type BrandListItem = {
  description: string | null;
  id: string;
  isActive: boolean;
  name: string;
  productCount: number;
  slug: string;
  updatedAtLabel: string;
};

type BrandManagerProps = {
  brands: BrandListItem[];
  createAction: (
    previousState: BrandFormState,
    formData: FormData,
  ) => Promise<BrandFormState>;
  query: string;
  status: string;
  updateAction: (
    previousState: BrandFormState,
    formData: FormData,
  ) => Promise<BrandFormState>;
};

const fieldClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:shadow-md focus:ring-2 focus:ring-slate-200';
const readOnlyFieldClass =
  'w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-700 outline-none';

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function buildSnapshot({
  description,
  isActive,
  name,
  slug,
}: {
  description: string;
  isActive: boolean;
  name: string;
  slug: string;
}) {
  return JSON.stringify({ description, isActive, name, slug });
}

function BrandCreateForm({
  action,
  formId,
  onCancel,
  onCreated,
}: {
  action: BrandManagerProps['createAction'];
  formId: string;
  onCancel: () => void;
  onCreated: () => void;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(action, { error: null });
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const handledSavedAtRef = useRef<number | undefined>(undefined);
  const slug = slugify(name);
  const hasChanges = Boolean(name.trim() || description.trim());
  const canSubmit = Boolean(slug) && hasChanges && !isPending;

  useEffect(() => {
    if (!state.savedAt || handledSavedAtRef.current === state.savedAt) return;
    handledSavedAtRef.current = state.savedAt;
    // The server action has completed, so reset the create form to a clean baseline.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName('');
    setDescription('');
    onCreated();
    router.refresh();
  }, [onCreated, router, state.savedAt]);

  return (
    <form
      id={formId}
      action={formAction}
      className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4"
    >
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(180px,0.6fr)]">
        <label className="space-y-1.5 text-sm font-medium text-slate-700">
          <span>Name</span>
          <input
            name="name"
            required
            placeholder="Nike"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="space-y-1.5 text-sm font-medium text-slate-700">
          <span>Slug</span>
          <input name="slug" readOnly value={slug} placeholder="nike" className={readOnlyFieldClass} />
        </label>
      </div>
      <label className="block space-y-1.5 text-sm font-medium text-slate-700">
        <span>Description</span>
        <textarea
          name="description"
          rows={3}
          placeholder="Optional brand note for admins."
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className={fieldClass}
        />
      </label>
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
          {isPending ? 'Creating...' : 'Create Brand'}
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}

function BrandEditPanel({
  action,
  brand,
  onCancel,
}: {
  action: BrandManagerProps['updateAction'];
  brand: BrandListItem;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(action, {
    error: null,
    success: null,
  });
  const [name, setName] = useState(brand.name);
  const [description, setDescription] = useState(brand.description ?? '');
  const [isActive, setIsActive] = useState(brand.isActive);
  const handledArchivedAtRef = useRef<number | undefined>(undefined);
  const handledDeletedAtRef = useRef<number | undefined>(undefined);
  const handledSavedAtRef = useRef<number | undefined>(undefined);
  const slug = slugify(name);
  const initialSnapshot = useMemo(
    () =>
      buildSnapshot({
        description: brand.description ?? '',
        isActive: brand.isActive,
        name: brand.name,
        slug: brand.slug,
      }),
    [brand],
  );
  const [savedSnapshot, setSavedSnapshot] = useState(initialSnapshot);
  const currentSnapshot = useMemo(
    () => buildSnapshot({ description, isActive, name, slug }),
    [description, isActive, name, slug],
  );
  const hasChanges = currentSnapshot !== savedSnapshot;
  const canSave = Boolean(slug) && hasChanges && !isPending;

  useEffect(() => {
    if (!state.savedAt || handledSavedAtRef.current === state.savedAt) return;
    handledSavedAtRef.current = state.savedAt;
    // The saved response marks the current form values as the new clean baseline.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSavedSnapshot(currentSnapshot);
    router.refresh();
  }, [currentSnapshot, router, state.savedAt]);

  useEffect(() => {
    if (!state.archivedAt || handledArchivedAtRef.current === state.archivedAt) return;
    handledArchivedAtRef.current = state.archivedAt;
    onCancel();
    router.refresh();
  }, [onCancel, router, state.archivedAt]);

  useEffect(() => {
    if (!state.deletedAt || handledDeletedAtRef.current === state.deletedAt) return;
    handledDeletedAtRef.current = state.deletedAt;
    onCancel();
    router.refresh();
  }, [onCancel, router, state.deletedAt]);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
      <input type="hidden" name="brandId" value={brand.id} />
      {state.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {state.error}
        </p>
      ) : null}
      {state.success && !hasChanges ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
          {state.success}
        </p>
      ) : null}
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(180px,0.6fr)]">
        <label className="space-y-1.5 text-sm font-medium text-slate-700">
          <span>Name</span>
          <input
            name="name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="space-y-1.5 text-sm font-medium text-slate-700">
          <span>Slug</span>
          <input name="slug" readOnly value={slug} className={readOnlyFieldClass} />
        </label>
      </div>
      <label className="block space-y-1.5 text-sm font-medium text-slate-700">
        <span>Description</span>
        <textarea
          name="description"
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className={fieldClass}
        />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="submit"
          disabled={!canSave}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            canSave
              ? 'bg-blue-700 text-white hover:bg-blue-600'
              : 'cursor-not-allowed bg-slate-200 text-slate-500'
          }`}
        >
          {isPending ? 'Saving...' : 'Save Brand'}
        </button>
        <div className="flex items-center gap-2">
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
          <button
            type="submit"
            name="intent"
            value="archive"
            formNoValidate
            disabled={isPending || !isActive}
            onClick={(event) => {
              if (!window.confirm('Archive this brand?')) {
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
              if (!window.confirm('Delete this brand permanently? Products using it will keep no brand.')) {
                event.preventDefault();
              }
            }}
            className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}

export default function BrandManager({
  brands,
  createAction,
  query,
  status,
  updateAction,
}: BrandManagerProps) {
  const [openBrandId, setOpenBrandId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const hideCreateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const createBrandFormId = 'brand-create-form';

  useEffect(
    () => () => {
      if (hideCreateTimeoutRef.current) {
        clearTimeout(hideCreateTimeoutRef.current);
      }
    },
    [],
  );

  function hideCreateAfterSuccess() {
    if (hideCreateTimeoutRef.current) {
      clearTimeout(hideCreateTimeoutRef.current);
    }
    hideCreateTimeoutRef.current = setTimeout(() => {
      setIsCreateOpen(false);
      hideCreateTimeoutRef.current = null;
    }, 2000);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Brands</h2>
          <p className="mt-1 text-sm text-slate-600">
            Manage product brands from the Products section.
          </p>
        </div>
        {!isCreateOpen ? (
          <button
            type="button"
            aria-label="Add brand"
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-2xl font-semibold leading-none text-blue-700 shadow-sm transition hover:bg-blue-100"
          >
            <span className="relative -top-px leading-none">+</span>
          </button>
        ) : null}
      </div>
      <BrandFilters
        query={query}
        status={status}
        activeControl={
          isCreateOpen ? (
            <label className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
              <input
                form={createBrandFormId}
                name="isActive"
                type="checkbox"
                defaultChecked
                className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-200"
              />
              <span>Active</span>
            </label>
          ) : null
        }
      />
      <AnimatePresence initial={false}>
        {isCreateOpen ? (
          <motion.div
            initial={{ height: 0, opacity: 0, y: -8 }}
            animate={{ height: 'auto', opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <BrandCreateForm
              action={createAction}
              formId={createBrandFormId}
              onCancel={() => setIsCreateOpen(false)}
              onCreated={hideCreateAfterSuccess}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Brand</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Products</th>
              <th className="px-3 py-2">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {brands.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-sm text-slate-500">
                  No brands match the current filters.
                </td>
              </tr>
            ) : (
              brands.map((brand) => {
                const isOpen = openBrandId === brand.id;
                return (
                  <Fragment key={brand.id}>
                    <tr
                      role="button"
                      tabIndex={0}
                      aria-expanded={isOpen}
                      onClick={() => setOpenBrandId(isOpen ? null : brand.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setOpenBrandId(isOpen ? null : brand.id);
                        }
                      }}
                      className={`cursor-pointer align-top transition hover:bg-blue-50/60 ${
                        isOpen ? 'bg-blue-50/40' : ''
                      }`}
                    >
                      <td className="px-3 py-3">
                        <p className="font-semibold text-slate-900">{brand.name}</p>
                        <p className="text-xs text-slate-500">{brand.slug}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                            brand.isActive
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {brand.isActive ? 'Active' : 'Archived'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right font-semibold text-slate-700">
                        {brand.productCount}
                      </td>
                      <td className="px-3 py-3 text-slate-600">{brand.updatedAtLabel}</td>
                    </tr>
                    {isOpen ? (
                      <tr>
                        <td colSpan={4} className="bg-slate-50 px-3 py-3">
                          <BrandEditPanel
                            action={updateAction}
                            brand={brand}
                            onCancel={() => setOpenBrandId(null)}
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
