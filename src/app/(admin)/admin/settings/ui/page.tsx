import Link from 'next/link';
import { requireAdminPermission } from '@/lib/admin-session';
import { prisma } from '@/lib/prisma';
import { defaultHeroSlides } from '@/lib/storefront-data';
import { createHeroSlide, updateHeroSlide } from './actions';

type HeroSlideRow = {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  ctaLabel: string | null;
  ctaHref: string | null;
  secondaryLabel: string | null;
  secondaryHref: string | null;
  displayOrder: number;
  isActive: boolean;
};

export default async function UiSettingsPage() {
  await requireAdminPermission('/admin/settings/ui', 'settings.manage');

  const heroSlideDelegate = (prisma as { heroSlide?: unknown }).heroSlide as
    | {
        findMany: (args: unknown) => Promise<HeroSlideRow[]>;
      }
    | undefined;
  const slides = heroSlideDelegate
    ? await heroSlideDelegate.findMany({
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      })
    : [];

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">UI Management</h2>
        <p className="mt-2 text-sm text-slate-600">
          Manage storefront hero slides and collection entry points from admin settings.
        </p>
        {!heroSlideDelegate ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Hero slide model is unavailable in this running Prisma client. Run
            `npx prisma generate` and restart the dev server.
          </p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Hero Slider</h3>
            <p className="mt-2 text-sm text-slate-600">
              Add, edit, archive, delete, and order homepage hero slides.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {slides.length || defaultHeroSlides.length} visible with fallback
          </span>
        </div>

        <form action={createHeroSlide} className="mt-5 space-y-4 rounded-xl border border-slate-200 p-4">
          <h4 className="text-sm font-semibold text-slate-900">Add Slide</h4>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm text-slate-700">
              Title
              <input name="title" required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="text-sm text-slate-700">
              Image URL
              <input name="imageUrl" required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="text-sm text-slate-700 md:col-span-2">
              Subtitle
              <input name="subtitle" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="text-sm text-slate-700">
              Primary Button Label
              <input name="ctaLabel" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="text-sm text-slate-700">
              Primary Button URL
              <input name="ctaHref" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="text-sm text-slate-700">
              Secondary Button Label
              <input name="secondaryLabel" defaultValue="Explore More" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="text-sm text-slate-700">
              Secondary Button URL
              <input name="secondaryHref" defaultValue="#featured" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="text-sm text-slate-700">
              Display Order
              <input name="displayOrder" type="number" min={1} defaultValue={slides.length + 1} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input name="isActive" type="checkbox" defaultChecked />
              Active
            </label>
          </div>
          <button type="submit" className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100">
            Add Slide
          </button>
        </form>

        <div className="mt-5 space-y-3">
          {slides.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              No custom hero slides yet. The storefront is using the built-in fallback slides.
            </div>
          ) : (
            slides.map((slide) => (
              <form key={slide.id} action={updateHeroSlide} className="space-y-3 rounded-xl border border-slate-200 p-4">
                <input type="hidden" name="slideId" value={slide.id} />
                <div className="grid gap-3 md:grid-cols-[120px_minmax(0,1fr)]">
                  <div className="h-28 overflow-hidden rounded-lg bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={slide.imageUrl} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="text-sm text-slate-700">
                      Title
                      <input name="title" required defaultValue={slide.title} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                    </label>
                    <label className="text-sm text-slate-700">
                      Image URL
                      <input name="imageUrl" required defaultValue={slide.imageUrl} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                    </label>
                    <label className="text-sm text-slate-700 md:col-span-2">
                      Subtitle
                      <input name="subtitle" defaultValue={slide.subtitle ?? ''} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                    </label>
                    <label className="text-sm text-slate-700">
                      Primary Label
                      <input name="ctaLabel" defaultValue={slide.ctaLabel ?? ''} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                    </label>
                    <label className="text-sm text-slate-700">
                      Primary URL
                      <input name="ctaHref" defaultValue={slide.ctaHref ?? ''} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                    </label>
                    <label className="text-sm text-slate-700">
                      Secondary Label
                      <input name="secondaryLabel" defaultValue={slide.secondaryLabel ?? ''} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                    </label>
                    <label className="text-sm text-slate-700">
                      Secondary URL
                      <input name="secondaryHref" defaultValue={slide.secondaryHref ?? ''} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                    </label>
                    <label className="text-sm text-slate-700">
                      Display Order
                      <input name="displayOrder" type="number" min={1} defaultValue={slide.displayOrder} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                      <input name="isActive" type="checkbox" defaultChecked={slide.isActive} />
                      Active
                    </label>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button name="intent" value="save" type="submit" className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100">
                    Save Slide
                  </button>
                  <button name="intent" value="delete" type="submit" className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700 transition hover:bg-red-100">
                    Delete
                  </button>
                </div>
              </form>
            ))
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Collections Management</h3>
          <p className="mt-2 text-sm text-slate-600">
            Manage homepage collection/product sections, source rules, product picks,
            CTA links, and section order.
          </p>
          <Link href="/admin/settings/homepage-sections" className="mt-4 inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100">
            Open Homepage Collections
          </Link>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Category Collections</h3>
          <p className="mt-2 text-sm text-slate-600">
            Create and update collection/category names, slugs, descriptions, images,
            and active status.
          </p>
          <Link href="/admin/products/categories" className="mt-4 inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100">
            Open Category Collections
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <Link href="/admin/settings" className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
          Back to Settings
        </Link>
      </div>
    </section>
  );
}
