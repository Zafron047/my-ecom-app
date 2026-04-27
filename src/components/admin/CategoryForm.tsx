'use client';

import Link from 'next/link';
import { useActionState, useEffect, useMemo, useState } from 'react';
import type { CategoryFormState } from '@/app/(admin)/admin/products/categories/actions';

type CategoryFormProps = {
  action: (
    previousState: CategoryFormState,
    formData: FormData,
  ) => Promise<CategoryFormState>;
  submitLabel: string;
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function CategoryForm({ action, submitLabel }: CategoryFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [previewUrl, setPreviewUrl] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [state, formAction, isPending] = useActionState(action, { error: null });
  const slug = slugify(name);
  const initialSnapshot = JSON.stringify({
    description: '',
    image: null,
    isActive: true,
    name: '',
    slug: '',
  });
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
  const hasChanges = currentSnapshot !== initialSnapshot;
  const canSubmit = Boolean(slug) && hasChanges && !isPending;

  useEffect(
    () => () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    },
    [previewUrl],
  );

  return (
    <form
      action={formAction}
      className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Add Category</h2>
          <p className="mt-1 text-sm text-slate-600">
            Create a category customers and admins can use to group products.
          </p>
        </div>
      </div>

      {state.error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {state.error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.75fr)]">
        <label className="space-y-1.5 text-sm font-medium text-slate-700">
          <span>Name</span>
          <input
            name="name"
            required
            placeholder="Home Decor"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:shadow-md focus:ring-2 focus:ring-slate-200"
          />
        </label>

        <label className="space-y-1.5 text-sm font-medium text-slate-700">
          <span>Slug</span>
          <input
            name="slug"
            readOnly
            value={slug}
            placeholder="home-decor"
            className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-700 outline-none"
          />
        </label>
      </div>

      <label className="block space-y-1.5 text-sm font-medium text-slate-700">
        <span>Description</span>
        <textarea
          name="description"
          rows={4}
          placeholder="Reusable bottles, tumblers, and hydration accessories."
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="w-full resize-y rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:shadow-md focus:ring-2 focus:ring-slate-200"
        />
      </label>

      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-700">Image</p>
        <label className="mb-0 flex min-h-[132px] cursor-pointer items-center gap-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 transition hover:border-blue-300 hover:bg-blue-50">
          <span className="flex h-[100px] w-[100px] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white text-xs font-semibold uppercase text-slate-400">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Category preview"
                className="h-full w-full object-contain p-1"
              />
            ) : (
              'Image'
            )}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-800">
              Select category image
            </span>
            <span className="mt-1 block text-xs leading-5 text-slate-500">
              This image appears in category management and can be reused on the
              storefront category grid.
            </span>
          </span>
          <input
            name="image"
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setSelectedImage(file);
              setPreviewUrl((current) => {
                if (current) URL.revokeObjectURL(current);
                return file ? URL.createObjectURL(file) : '';
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

      <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 px-5 py-4 shadow-lg shadow-slate-200/70 backdrop-blur">
        <button
          type="submit"
          disabled={!canSubmit}
          className={`rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition ${
            canSubmit
              ? 'bg-blue-700 text-white hover:bg-blue-600'
              : 'cursor-not-allowed bg-slate-200 text-slate-500 shadow-none'
          }`}
        >
          {isPending ? 'Creating...' : submitLabel}
        </button>
        <Link
          href="/admin/products/categories"
          className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold !text-red-700 shadow-sm transition hover:bg-red-50 hover:!text-red-700"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
