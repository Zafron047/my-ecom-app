import Link from 'next/link';
import HomepageSectionsReorderManager from '@/components/admin/HomepageSectionsReorderManager';
import HomepageSectionItem from '@/components/admin/HomepageSectionItem';
import ProductMultiSelectDropdown from '@/components/admin/ProductMultiSelectDropdown';
import { requireAdminRole } from '@/lib/admin-session';
import { prisma } from '@/lib/prisma';
import {
  createHomepageSection,
  deleteHomepageSection,
  reorderHomepageSections,
  updateHomepageSection,
} from './actions';

export default async function HomepageSectionsSettingsPage() {
  await requireAdminRole('/admin/settings/homepage-sections', ['admin']);

  const homepageSectionDelegate = (prisma as { homepageSection?: unknown })
    .homepageSection as
    | {
        findMany: (args: unknown) => Promise<
          {
            id: string;
            title: string;
            eyebrow: string | null;
            productLimit: number;
            ctaLabel: string | null;
            ctaHref: string | null;
            isActive: boolean;
            displayOrder: number;
            sourceType: 'latest' | 'super_sale' | 'category' | 'tag';
            sourceValue: string | null;
            variant: 'default' | 'sale';
            layout: 'grid' | 'carousel';
            products: {
              productId: string;
            }[];
          }[]
        >;
      }
    | undefined;

  const [sections, products, categories, tags] = await Promise.all([
    homepageSectionDelegate
      ? homepageSectionDelegate.findMany({
          include: {
            products: {
              orderBy: {
                assignedAt: 'asc',
              },
              select: {
                productId: true,
              },
            },
          },
          orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
        })
      : Promise.resolve([]),
    prisma.product.findMany({
      where: {
        status: 'active',
      },
      select: {
        id: true,
        name: true,
        images: {
          orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
          select: {
            storagePath: true,
          },
          take: 1,
        },
      },
      orderBy: {
        name: 'asc',
      },
    }),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { name: true },
    }),
    prisma.tag.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { name: true, slug: true },
    }),
  ]);

  const productUsage = new Map<string, string[]>();
  for (const section of sections) {
    for (const row of section.products) {
      const existing = productUsage.get(row.productId) ?? [];
      existing.push(section.title);
      productUsage.set(row.productId, existing);
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Homepage Product Sections</h2>
        <p className="mt-2 text-sm text-slate-600">
          Create reusable homepage product lists with custom selected products.
          &quot;More to love&quot; stays fixed at the end.
        </p>
        {!homepageSectionDelegate ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Homepage section model is unavailable in this running Prisma client.
            Run `npx prisma generate` and restart the dev server.
          </p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Sections Serial Manager</h3>
        <p className="mt-2 text-sm text-slate-600">
          Edit serial numbers directly or move sections top-to-bottom.
        </p>
        <HomepageSectionsReorderManager
          sections={sections.map((section) => ({ id: section.id, title: section.title }))}
          reorderAction={reorderHomepageSections}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Add Section</h3>
        <form action={createHomepageSection} className="mt-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm text-slate-700">
              Title
              <input
                name="title"
                required
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm text-slate-700">
              Eyebrow
              <input
                name="eyebrow"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm text-slate-700">
              Product Limit
              <input
                name="productLimit"
                type="number"
                min={1}
                defaultValue={6}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm text-slate-700">
              CTA Label
              <input
                name="ctaLabel"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <div className="text-sm text-slate-700">
              <p>Beautify Section</p>
              <div className="mt-1 flex items-center gap-4">
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name="variant" value="default" defaultChecked />
                  Normal
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name="variant" value="sale" />
                  Sale Style
                </label>
              </div>
            </div>
            <div className="text-sm text-slate-700">
              <p>Section Style</p>
              <div className="mt-1 flex items-center gap-4">
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name="layout" value="grid" defaultChecked />
                  Grid
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name="layout" value="carousel" />
                  Carousel
                </label>
              </div>
            </div>
            <label className="text-sm text-slate-700">
              Category/Tag Picker
              <select
                name="sourceValue"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                defaultValue=""
              >
                <option value="">None</option>
                {categories.map((category) => (
                  <option key={`c-${category.name}`} value={category.name}>
                    Category: {category.name}
                  </option>
                ))}
                {tags.map((tag) => (
                  <option key={`t-${tag.slug}`} value={tag.slug}>
                    Tag: {tag.name}
                  </option>
                ))}
              </select>
            </label>
            <input type="hidden" name="sourceType" value="latest" />
            <input type="hidden" name="displayOrder" value={sections.length + 1} />
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input name="isActive" type="checkbox" defaultChecked />
              Active
            </label>
          </div>

          <div className="max-w-3xl">
            <p className="text-sm font-medium text-slate-900">Products</p>
            <p className="mt-1 text-xs text-slate-500">
              Search and select multiple products with thumbnail preview.
            </p>
            <div className="mt-3">
              <ProductMultiSelectDropdown
                name="productIds"
                options={products.map((product) => ({
                  id: product.id,
                  image: product.images[0]?.storagePath || '/next.svg',
                  name: product.name,
                  usedIn: productUsage.get(product.id) ?? [],
                }))}
              />
            </div>
          </div>

          <button
            type="submit"
            className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
          >
            Add Section
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Existing Sections</h3>
        <div className="mt-4 space-y-4">
          {sections.length === 0 ? (
            <p className="text-sm text-slate-500">No custom sections yet.</p>
          ) : (
            sections.map((section) => (
              <HomepageSectionItem
                key={section.id}
                categories={categories}
                tags={tags}
                updateAction={updateHomepageSection}
                deleteAction={deleteHomepageSection}
                products={products.map((product) => ({
                  id: product.id,
                  image: product.images[0]?.storagePath || '/next.svg',
                  name: product.name,
                  usedIn: (productUsage.get(product.id) ?? []).filter(
                    (title) => title !== section.title,
                  ),
                }))}
                section={{
                  id: section.id,
                  title: section.title,
                  eyebrow: section.eyebrow,
                  productLimit: section.productLimit,
                  ctaLabel: section.ctaLabel,
                  ctaHref: section.ctaHref,
                  isActive: section.isActive,
                  sourceType: section.sourceType,
                  sourceValue: section.sourceValue,
                  variant: section.variant,
                  layout: section.layout,
                  productIds: section.products.map((row) => row.productId),
                }}
              />
            ))
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <Link
          href="/admin/settings"
          className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Back to Settings
        </Link>
      </div>
    </section>
  );
}
