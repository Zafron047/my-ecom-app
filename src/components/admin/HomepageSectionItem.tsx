'use client';

import { useRef, useState } from 'react';
import ProductMultiSelectDropdown from '@/components/admin/ProductMultiSelectDropdown';

type ProductOption = {
  id: string;
  image: string;
  name: string;
  usedIn: string[];
};

type HomepageSectionItemProps = {
  categories: { name: string }[];
  deleteAction: (formData: FormData) => Promise<void>;
  products: ProductOption[];
  section: {
    ctaHref: string | null;
    ctaLabel: string | null;
    eyebrow: string | null;
    id: string;
    isActive: boolean;
    productIds: string[];
    productLimit: number;
    sourceType: 'latest' | 'super_sale' | 'category' | 'tag';
    sourceValue: string | null;
    title: string;
    variant: 'default' | 'sale';
    layout: 'grid' | 'carousel';
  };
  tags: { name: string; slug: string }[];
  updateAction: (formData: FormData) => Promise<void>;
};

export default function HomepageSectionItem({
  categories,
  deleteAction,
  products,
  section,
  tags,
  updateAction,
}: HomepageSectionItemProps) {
  const [expanded, setExpanded] = useState(false);
  const deleteFormRef = useRef<HTMLFormElement | null>(null);

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">{section.title}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700"
            aria-label="Edit section"
            title="Edit"
          >
            {expanded ? '▲' : '✎'}
          </button>
          <form ref={deleteFormRef} action={deleteAction}>
            <input type="hidden" name="sectionId" value={section.id} />
            <button
              type="button"
              onClick={() => {
                const ok = window.confirm(
                  `Delete section "${section.title}"? This cannot be undone.`,
                );
                if (!ok) return;
                deleteFormRef.current?.requestSubmit();
              }}
              className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700"
              aria-label="Delete section"
              title="Delete"
            >
              🗑
            </button>
          </form>
        </div>
      </div>

      {expanded ? (
        <form action={updateAction} className="mt-4">
          <input type="hidden" name="sectionId" value={section.id} />
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm text-slate-700">
              Title
              <input
                name="title"
                defaultValue={section.title}
                required
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm text-slate-700">
              Eyebrow
              <input
                name="eyebrow"
                defaultValue={section.eyebrow ?? ''}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm text-slate-700">
              Product Limit
              <input
                name="productLimit"
                type="number"
                min={1}
                defaultValue={section.productLimit}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm text-slate-700">
              CTA Label
              <input
                name="ctaLabel"
                defaultValue={section.ctaLabel ?? ''}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <div className="text-sm text-slate-700">
              <p>Beautify Section</p>
              <div className="mt-1 flex items-center gap-4">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="variant"
                    value="default"
                    defaultChecked={section.variant !== 'sale'}
                  />
                  Normal
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="variant"
                    value="sale"
                    defaultChecked={section.variant === 'sale'}
                  />
                  Sale Style
                </label>
              </div>
            </div>
            <div className="text-sm text-slate-700">
              <p>Section Style</p>
              <div className="mt-1 flex items-center gap-4">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="layout"
                    value="grid"
                    defaultChecked={section.layout !== 'carousel'}
                  />
                  Grid
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="layout"
                    value="carousel"
                    defaultChecked={section.layout === 'carousel'}
                  />
                  Carousel
                </label>
              </div>
            </div>
            <label className="text-sm text-slate-700">
              Category/Tag Picker
              <select
                name="sourceValue"
                defaultValue={section.sourceValue ?? ''}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">None</option>
                {categories.map((category) => (
                  <option key={`ec-${category.name}`} value={category.name}>
                    Category: {category.name}
                  </option>
                ))}
                {tags.map((tag) => (
                  <option key={`et-${tag.slug}`} value={tag.slug}>
                    Tag: {tag.name}
                  </option>
                ))}
              </select>
            </label>
            <input type="hidden" name="sourceType" value={section.sourceType} />
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input name="isActive" type="checkbox" defaultChecked={section.isActive} />
              Active
            </label>
            <div className="text-xs text-slate-500">
              CTA URL auto-generates from title. Current:{' '}
              <span className="font-medium text-slate-700">{section.ctaHref ?? 'none'}</span>
            </div>
          </div>

          <div className="mt-3 max-w-3xl">
            <p className="text-sm font-medium text-slate-900">Products</p>
            <div className="mt-2">
              <ProductMultiSelectDropdown
                name="productIds"
                selectedIds={section.productIds}
                options={products}
              />
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      ) : null}
    </div>
  );
}
