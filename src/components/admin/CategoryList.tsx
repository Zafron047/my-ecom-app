'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Fragment,
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { CategoryFormState } from '@/app/(admin)/admin/products/categories/actions';

export type CategoryListItem = {
  description: string | null;
  id: string;
  imagePath: string | null;
  isActive: boolean;
  name: string;
  productCount: number;
  slug: string;
  updatedAtLabel: string;
};

type CategoryListProps = {
  action: (
    previousState: CategoryFormState,
    formData: FormData,
  ) => Promise<CategoryFormState>;
  categories: CategoryListItem[];
};

type CategoryEditPanelProps = {
  action: CategoryListProps['action'];
  category: CategoryListItem;
  onCancel: () => void;
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

function CategoryEditPanel({
  action,
  category,
  onCancel,
}: CategoryEditPanelProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(action, {
    error: null,
    success: null,
  });
  const [name, setName] = useState(category.name);
  const [description, setDescription] = useState(category.description ?? '');
  const [isActive, setIsActive] = useState(category.isActive);
  const [previewUrl, setPreviewUrl] = useState(category.imagePath ?? '');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const handledArchivedAtRef = useRef<number | undefined>(undefined);
  const handledDeletedAtRef = useRef<number | undefined>(undefined);
  const handledSavedAtRef = useRef<number | undefined>(undefined);
  const initialSnapshot = useMemo(
    () =>
      JSON.stringify({
        description: category.description ?? '',
        image: null,
        isActive: category.isActive,
        name: category.name,
        slug: category.slug,
      }),
    [category],
  );
  const [savedSnapshot, setSavedSnapshot] = useState(initialSnapshot);
  const slug = slugify(name);

  const currentSnapshot = useMemo(
    () =>
      JSON.stringify({
        description,
        image: selectedImage
          ? {
              lastModified: selectedImage.lastModified,
              name: selectedImage.name,
              size: selectedImage.size,
            }
          : null,
        isActive,
        name,
        slug,
      }),
    [description, isActive, name, selectedImage, slug],
  );

  useEffect(
    () => () => {
      if (previewUrl && previewUrl !== category.imagePath) {
        URL.revokeObjectURL(previewUrl);
      }
    },
    [category.imagePath, previewUrl],
  );

  useEffect(() => {
    if (!state.savedAt) return;
    if (handledSavedAtRef.current === state.savedAt) return;
    handledSavedAtRef.current = state.savedAt;
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
    // The form has just persisted successfully, so this becomes the new clean baseline.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedImage(null);
    setSavedSnapshot(
      JSON.stringify({
        description,
        image: null,
        isActive,
        name,
        slug,
      }),
    );
    router.refresh();
  }, [description, isActive, name, router, slug, state.savedAt]);

  useEffect(() => {
    if (!state.archivedAt) return;
    if (handledArchivedAtRef.current === state.archivedAt) return;
    handledArchivedAtRef.current = state.archivedAt;
    onCancel();
    router.refresh();
  }, [onCancel, router, state.archivedAt]);

  useEffect(() => {
    if (!state.deletedAt) return;
    if (handledDeletedAtRef.current === state.deletedAt) return;
    handledDeletedAtRef.current = state.deletedAt;
    onCancel();
    router.refresh();
  }, [onCancel, router, state.deletedAt]);

  const hasChanges = currentSnapshot !== savedSnapshot;
  const canSave = Boolean(slug) && hasChanges && !isPending;

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-xl border border-blue-100 bg-blue-50/40 p-4"
    >
      <input type="hidden" name="categoryId" value={category.id} />

      {state.error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {state.error}
        </div>
      ) : null}
      {state.success && !hasChanges ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {state.success}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.55fr)]">
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
          <input
            name="slug"
            readOnly
            value={slug}
            className={readOnlyFieldClass}
          />
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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Image</p>
          <label className="mb-0 flex min-h-[104px] cursor-pointer items-center gap-4 rounded-xl border border-dashed border-slate-300 bg-white p-3 transition hover:border-blue-300 hover:bg-blue-50">
            <span className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase text-slate-400">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt={`${name || category.name} preview`}
                  className="h-full w-full object-contain p-1"
                />
              ) : (
                'No img'
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-800">
                Replace category image
              </span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">
                Choose a new image only when this category image should change.
              </span>
            </span>
            <input
              ref={imageInputRef}
              name="image"
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setSelectedImage(file);
                setPreviewUrl((current) => {
                  if (current && current !== category.imagePath) {
                    URL.revokeObjectURL(current);
                  }
                  return file ? URL.createObjectURL(file) : category.imagePath ?? '';
                });
              }}
            />
          </label>
        </div>

        <label className="mb-0 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            name="isActive"
            type="checkbox"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-200"
          />
          <span>Active</span>
        </label>
      </div>

      <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 px-5 py-4 shadow-lg shadow-slate-200/70 backdrop-blur">
        <button
          type="submit"
          disabled={!canSave}
          className={`rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition ${
            canSave
              ? 'bg-blue-700 text-white hover:bg-blue-600'
              : 'cursor-not-allowed bg-slate-200 text-slate-500 shadow-none'
          }`}
        >
          {isPending ? 'Saving...' : 'Save Category'}
        </button>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="submit"
            name="intent"
            value="archive"
            formNoValidate
            aria-label="Archive category"
            title="Archive category"
            onClick={(event) => {
              if (!window.confirm('Archive this category?')) {
                event.preventDefault();
              }
            }}
            className="rounded-xl border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-amber-800 shadow-sm transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isPending || !isActive}
          >
            Archive
          </button>
          <button
            type="submit"
            name="intent"
            value="delete"
            formNoValidate
            aria-label="Delete category"
            title="Delete category"
            onClick={(event) => {
              if (!window.confirm('Delete this category?')) {
                event.preventDefault();
              }
            }}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 bg-white text-red-700 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isPending}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M3 6h18" />
              <path d="M8 6V4h8v2" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}

export default function CategoryList({ action, categories }: CategoryListProps) {
  const [openCategoryIds, setOpenCategoryIds] = useState<string[]>([]);

  function toggleCategory(categoryId: string) {
    setOpenCategoryIds((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId],
    );
  }

  if (categories.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 px-3 py-6 text-center text-sm text-slate-500">
        No categories match the current filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2">Category</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2 text-right">Products</th>
            <th className="px-3 py-2">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {categories.map((category) => {
            const isOpen = openCategoryIds.includes(category.id);

            return (
              <Fragment key={category.id}>
                <tr
                  role="button"
                  tabIndex={0}
                  aria-expanded={isOpen}
                  onClick={() => toggleCategory(category.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      toggleCategory(category.id);
                    }
                  }}
                  className={`cursor-pointer align-top transition hover:bg-blue-50/60 ${
                    isOpen ? 'bg-blue-50/40' : ''
                  }`}
                >
                  <td className="px-3 py-3">
                    <div className="flex items-start gap-3">
                      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase text-slate-400">
                        {category.imagePath ? (
                          <Image
                            src={category.imagePath}
                            alt={category.name}
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
                        <p className="font-medium text-slate-900">
                          {category.name}
                        </p>
                        <p className="text-xs text-slate-500">{category.slug}</p>
                        {category.description ? (
                          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-600">
                            {category.description}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`rounded-md px-2 py-1 text-xs font-semibold ${
                        category.isActive
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {category.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-slate-900">
                    {category.productCount}
                  </td>
                  <td className="px-3 py-3 text-slate-600">
                    {category.updatedAtLabel}
                  </td>
                </tr>
                {isOpen ? (
                  <tr>
                    <td className="px-3 py-4" colSpan={4}>
                      <CategoryEditPanel
                        action={action}
                        category={category}
                        onCancel={() => toggleCategory(category.id)}
                      />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
