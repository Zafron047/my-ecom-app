import Link from 'next/link';
import BusinessLogoPicker from '@/components/admin/BusinessLogoPicker';
import BusinessProfileFormShell from '@/components/admin/BusinessProfileFormShell';
import { requireAdminPermission } from '@/lib/admin-session';
import { businessData } from '@/lib/business-data';
import { prisma } from '@/lib/prisma';
import {
  saveBusinessProfileImage,
  saveBusinessProfileWithState,
} from './actions';

type BusinessProfileRow = {
  id: string;
  address: string | null;
  bannerAlt: string | null;
  bannerUrl: string | null;
  businessName: string;
  tagline: string | null;
  email: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  logoAlt: string | null;
  logoUrl: string | null;
  metaDescription: string | null;
  metaKeywords: string | null;
  metaTitle: string | null;
  ogImageUrl: string | null;
  phone: string | null;
  returnRefundPolicy: string | null;
  websiteUrl: string | null;
};

type BusinessImageRow = {
  id: string;
  altText: string | null;
  contentType: string | null;
  createdAt: Date;
  fileName: string | null;
  imageType: string;
  publicUrl: string;
  sizeBytes: number | null;
  storagePath: string;
};

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal';
const textareaClass =
  'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal';

function OptionalText({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-xs leading-5 text-slate-500">{children}</p>;
}

function SectionHeading({
  children,
  description,
}: {
  children: React.ReactNode;
  description: string;
}) {
  return (
    <div>
      <h3 className="text-base font-semibold text-slate-900">{children}</h3>
      <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

function CollapsibleSection({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <details className="group rounded-xl border border-slate-200 bg-slate-50">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-4 py-3">
        <span>
          <span className="block text-sm font-semibold text-slate-900">
            {title}
          </span>
          <span className="mt-1 block text-xs leading-5 text-slate-500">
            {description}
          </span>
        </span>
        <span className="mt-0.5 text-xs font-semibold uppercase text-blue-700 group-open:hidden">
          Open
        </span>
        <span className="mt-0.5 hidden text-xs font-semibold uppercase text-slate-500 group-open:block">
          Close
        </span>
      </summary>
      <div className="border-t border-slate-200 bg-white p-4">{children}</div>
    </details>
  );
}

async function loadBusinessProfileSettings() {
  try {
    const [profileRows, businessImages] = await Promise.all([
      prisma.$queryRaw<BusinessProfileRow[]>`
        SELECT
          "id",
          "address",
          "bannerAlt",
          "bannerUrl",
          "businessName",
          "tagline",
          "email",
          "facebookUrl",
          "instagramUrl",
          "logoAlt",
          "logoUrl",
          "metaDescription",
          "metaKeywords",
          "metaTitle",
          "ogImageUrl",
          "phone",
          "returnRefundPolicy",
          "websiteUrl"
        FROM "BusinessProfile"
        ORDER BY "updatedAt" DESC
        LIMIT 1
      `,
      prisma.$queryRaw<BusinessImageRow[]>`
        SELECT
          "id",
          "altText",
          "contentType",
          "createdAt",
          "fileName",
          "imageType",
          "publicUrl",
          "sizeBytes",
          "storagePath"
        FROM "BusinessImage"
        ORDER BY "createdAt" DESC
        LIMIT 50
      `,
    ]);

    return {
      businessImages,
      loadError: null,
      profile: profileRows[0] ?? null,
    };
  } catch (error) {
    return {
      businessImages: [],
      loadError:
        error instanceof Error
          ? error.message
          : 'Business profile settings could not be loaded.',
      profile: null,
    };
  }
}

export default async function BusinessProfileSettingsPage() {
  await requireAdminPermission('/admin/settings/business-profile', 'settings.manage');

  const { businessImages, loadError, profile } =
    await loadBusinessProfileSettings();
  const imageOptions = businessImages.map((image) => ({
    id: image.id,
    altText: image.altText,
    fileName: image.fileName,
    imageType: image.imageType,
    publicUrl: image.publicUrl,
    storagePath: image.storagePath,
  }));

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Business Profile</h2>
        <p className="mt-2 text-sm text-slate-600">
          Manage the storefront identity, public contact details, policy page
          copy, and default social sharing metadata.
        </p>
        {loadError ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Settings could not fully load: {loadError}
          </p>
        ) : null}
      </div>

      <BusinessProfileFormShell action={saveBusinessProfileWithState}>
        <section className="space-y-4">
          <SectionHeading description="These fields are used across the storefront header, footer, invoices, and customer-facing contact surfaces.">
            Storefront Essentials
          </SectionHeading>

          <BusinessLogoPicker
            businessImages={imageOptions}
            currentBannerAlt={profile?.bannerAlt ?? 'Business banner'}
            currentBannerUrl={profile?.bannerUrl ?? ''}
            currentLogoAlt={profile?.logoAlt ?? businessData.logoAlt}
            currentLogoUrl={profile?.logoUrl ?? businessData.logo}
            currentMetadataImageUrl={profile?.ogImageUrl ?? ''}
            imageSlots={['logo']}
            saveImageAction={saveBusinessProfileImage}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Business Name
              <input
                name="businessName"
                required
                defaultValue={profile?.businessName ?? businessData.name}
                className={inputClass}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Tagline
              <input
                name="tagline"
                placeholder="EASY DEALS, EVERYDAY"
                defaultValue={profile?.tagline ?? 'EASY DEALS, EVERYDAY'}
                className={inputClass}
              />
              <OptionalText>Used as the homepage header search placeholder.</OptionalText>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Phone
              <input
                name="phone"
                inputMode="tel"
                placeholder="+8801XXXXXXXXX"
                defaultValue={profile?.phone ?? ''}
                className={inputClass}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Email
              <input
                name="email"
                type="email"
                placeholder="support@example.com"
                defaultValue={profile?.email ?? ''}
                className={inputClass}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Website URL
              <input
                name="websiteUrl"
                type="url"
                placeholder="https://example.com"
                defaultValue={profile?.websiteUrl ?? ''}
                className={inputClass}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Facebook URL
              <input
                name="facebookUrl"
                type="url"
                defaultValue={profile?.facebookUrl ?? ''}
                className={inputClass}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Instagram URL
              <input
                name="instagramUrl"
                type="url"
                defaultValue={profile?.instagramUrl ?? ''}
                className={inputClass}
              />
            </label>
          </div>

          <label className="block text-sm font-medium text-slate-700">
            Address
            <textarea
              name="address"
              rows={3}
              defaultValue={profile?.address ?? ''}
              className={textareaClass}
            />
          </label>
        </section>

        <CollapsibleSection
          title="Storefront Banner"
          description="Optional banner image for storefront campaigns and hero areas."
        >
          <BusinessLogoPicker
            businessImages={imageOptions}
            currentBannerAlt={profile?.bannerAlt ?? 'Business banner'}
            currentBannerUrl={profile?.bannerUrl ?? ''}
            currentLogoAlt={profile?.logoAlt ?? businessData.logoAlt}
            currentLogoUrl={profile?.logoUrl ?? businessData.logo}
            currentMetadataImageUrl={profile?.ogImageUrl ?? ''}
            imageSlots={['banner']}
            saveImageAction={saveBusinessProfileImage}
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="Return and Refund Policy"
          description="Edit the policy text that will render on the storefront policy page."
        >
          <label className="block text-sm font-medium text-slate-700">
            Policy Content
            <textarea
              name="returnRefundPolicy"
              rows={10}
              defaultValue={profile?.returnRefundPolicy ?? ''}
              className={textareaClass}
            />
          </label>
          <OptionalText>
            Keep this customer-friendly and update it whenever your return,
            refund, exchange, or cancellation process changes.
          </OptionalText>
        </CollapsibleSection>

        <CollapsibleSection
          title="SEO and Social Preview"
          description="Optional defaults for browser metadata and shared links."
        >
          <div className="space-y-4">
            <BusinessLogoPicker
              businessImages={imageOptions}
              currentBannerAlt={profile?.bannerAlt ?? 'Business banner'}
              currentBannerUrl={profile?.bannerUrl ?? ''}
              currentLogoAlt={profile?.logoAlt ?? businessData.logoAlt}
              currentLogoUrl={profile?.logoUrl ?? businessData.logo}
              currentMetadataImageUrl={profile?.ogImageUrl ?? ''}
              imageSlots={['metadata']}
              saveImageAction={saveBusinessProfileImage}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Metadata Title
                <input
                  name="metaTitle"
                  maxLength={70}
                  defaultValue={profile?.metaTitle ?? ''}
                  className={inputClass}
                />
                <OptionalText>Recommended length: about 50-60 characters.</OptionalText>
              </label>
              <label className="text-sm font-medium text-slate-700">
                Metadata Keywords
                <input
                  name="metaKeywords"
                  placeholder="gadgets, home finds, accessories"
                  defaultValue={profile?.metaKeywords ?? ''}
                  className={inputClass}
                />
                <OptionalText>
                  Optional. Most modern search engines ignore this field.
                </OptionalText>
              </label>
              <label className="text-sm font-medium text-slate-700 md:col-span-2">
                Metadata Description
                <textarea
                  name="metaDescription"
                  rows={3}
                  maxLength={170}
                  defaultValue={profile?.metaDescription ?? ''}
                  className={textareaClass}
                />
                <OptionalText>Recommended length: about 140-160 characters.</OptionalText>
              </label>
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          title="Accessibility Text"
          description="Override image alt text only when the auto-generated text is not enough."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Logo Alt Text
              <input
                name="logoAlt"
                placeholder={businessData.logoAlt}
                defaultValue={profile?.logoAlt ?? ''}
                className={inputClass}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Banner Alt Text
              <input
                name="bannerAlt"
                placeholder="Business banner"
                defaultValue={profile?.bannerAlt ?? ''}
                className={inputClass}
              />
            </label>
          </div>
        </CollapsibleSection>
      </BusinessProfileFormShell>

      <details className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <summary className="cursor-pointer list-none px-5 py-4">
          <h3 className="inline text-base font-semibold text-slate-900">
            Image Library
          </h3>
          <p className="mt-2 text-sm text-slate-600">
            View uploaded business images used by logo, banner, and social
            preview slots.
          </p>
        </summary>
        <div className="border-t border-slate-200 px-5 py-4">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Preview</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">File</th>
                  <th className="px-3 py-2">Storage Path</th>
                  <th className="px-3 py-2">URL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {businessImages.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-5 text-center text-slate-500">
                      No business images uploaded yet.
                    </td>
                  </tr>
                ) : (
                  businessImages.map((image) => (
                    <tr key={image.id} className="align-top">
                      <td className="px-3 py-2">
                        <div className="h-14 w-20 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={image.publicUrl}
                            alt={image.altText ?? ''}
                            className="h-full w-full object-contain p-1"
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-900">
                        {image.imageType}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {image.fileName ?? 'Image'}
                      </td>
                      <td className="max-w-xs px-3 py-2 text-xs text-slate-500">
                        <span className="break-all">{image.storagePath}</span>
                      </td>
                      <td className="max-w-xs px-3 py-2 text-xs">
                        <a
                          href={image.publicUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="break-all font-medium text-blue-700 hover:text-blue-800"
                        >
                          Open image
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </details>

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
