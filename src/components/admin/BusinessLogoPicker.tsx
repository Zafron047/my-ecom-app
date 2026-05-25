'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';

type BusinessImageOption = {
  id: string;
  altText: string | null;
  fileName: string | null;
  imageType: string;
  publicUrl: string;
  storagePath: string;
};

type ImageSlotKey = 'banner' | 'logo' | 'metadata';

type BusinessLogoPickerProps = {
  businessImages: BusinessImageOption[];
  currentBannerAlt: string;
  currentBannerUrl: string;
  currentLogoAlt: string;
  currentLogoUrl: string;
  currentMetadataImageUrl: string;
  imageSlots?: ImageSlotKey[];
  saveImageAction: (formData: FormData) => Promise<void>;
};

type PopupSaveButtonProps = {
  disabled: boolean;
  onFinished: () => void;
  saveImageAction: (formData: FormData) => Promise<void>;
};

function PopupSaveButton({
  disabled,
  onFinished,
  saveImageAction,
}: PopupSaveButtonProps) {
  const { pending } = useFormStatus();
  const wasPendingRef = useRef(false);

  useEffect(() => {
    if (wasPendingRef.current && !pending) {
      onFinished();
    }
    wasPendingRef.current = pending;
  }, [onFinished, pending]);

  return (
    <button
      type="submit"
      formAction={saveImageAction}
      disabled={disabled || pending}
      className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
    >
      {pending ? 'Saving...' : 'Save'}
    </button>
  );
}

export default function BusinessLogoPicker({
  businessImages,
  currentBannerAlt,
  currentBannerUrl,
  currentLogoAlt,
  currentMetadataImageUrl,
  currentLogoUrl,
  imageSlots = ['logo', 'banner', 'metadata'],
  saveImageAction,
}: BusinessLogoPickerProps) {
  const [activeSlot, setActiveSlot] = useState<ImageSlotKey | null>(null);
  const [dirtySlots, setDirtySlots] = useState<Record<ImageSlotKey, boolean>>({
    banner: false,
    logo: false,
    metadata: false,
  });
  const [filePreviews, setFilePreviews] = useState<Record<string, string>>({});
  const [pendingDeleteImageIds, setPendingDeleteImageIds] = useState<
    Record<ImageSlotKey, string>
  >({
    banner: '',
    logo: '',
    metadata: '',
  });
  const [selectedUrls, setSelectedUrls] = useState<Record<ImageSlotKey, string>>({
    banner: currentBannerUrl,
    logo: currentLogoUrl,
    metadata: currentMetadataImageUrl,
  });

  useEffect(
    () => () => {
      for (const previewUrl of Object.values(filePreviews)) {
        URL.revokeObjectURL(previewUrl);
      }
    },
    [filePreviews],
  );

  function setFilePreview(key: ImageSlotKey, file: File | null) {
    setFilePreviews((current) => {
      if (current[key]) URL.revokeObjectURL(current[key]);
      return {
        ...current,
        [key]: file ? URL.createObjectURL(file) : '',
      };
    });
  }

  const uploadSlots = useMemo(
    () =>
      [
      {
        alt: currentLogoAlt || 'Business logo preview',
        description:
          'Used in the storefront header, footer, browser icons, and business branding.',
        hiddenName: 'logoUrl',
        inputName: 'logoFile',
        label: 'Logo',
        previewKey: 'logo' as const,
      },
      {
        alt: currentBannerAlt || 'Business banner preview',
        description: 'Reusable business banner image for storefront sections and campaigns.',
        hiddenName: 'bannerUrl',
        inputName: 'bannerFile',
        label: 'Banner Image',
        previewKey: 'banner' as const,
      },
      {
        alt: 'Metadata image preview',
        description: 'Used as the default social share / Open Graph image.',
        hiddenName: 'ogImageUrl',
        inputName: 'metadataImageFile',
        label: 'Metadata Image',
        previewKey: 'metadata' as const,
      },
    ].filter((slot) => imageSlots.includes(slot.previewKey)),
    [currentBannerAlt, currentLogoAlt, imageSlots],
  );
  const activeSlotConfig = uploadSlots.find((slot) => slot.previewKey === activeSlot);

  function closeSavedPopup() {
    if (!activeSlot) return;

    setDirtySlots((current) => ({
      ...current,
      [activeSlot]: false,
    }));
    setPendingDeleteImageIds((current) => ({
      ...current,
      [activeSlot]: '',
    }));
    setActiveSlot(null);
  }

  return (
    <div
      className={
        uploadSlots.length === 1 ? 'grid gap-4' : 'grid gap-4 lg:grid-cols-3'
      }
    >
      {uploadSlots.map((slot) => {
        const visibleUrl = filePreviews[slot.previewKey] || selectedUrls[slot.previewKey];

        return (
          <div key={slot.inputName} className="space-y-2">
            <input
              type="hidden"
              name={slot.hiddenName}
              value={selectedUrls[slot.previewKey] ?? ''}
            />
            <input
              id={`business-image-file-${slot.previewKey}`}
              name={slot.inputName}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setFilePreview(slot.previewKey, file);
                if (file) {
                  setSelectedUrls((current) => ({
                    ...current,
                    [slot.previewKey]: '',
                  }));
                  setDirtySlots((current) => ({
                    ...current,
                    [slot.previewKey]: true,
                  }));
                  setPendingDeleteImageIds((current) => ({
                    ...current,
                    [slot.previewKey]: '',
                  }));
                }
              }}
            />
            <p className="text-sm font-medium text-slate-700">{slot.label}</p>
            <button
              type="button"
              onClick={() => setActiveSlot(slot.previewKey)}
              className="flex min-h-[176px] w-full cursor-pointer flex-col gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-left transition hover:border-blue-300 hover:bg-blue-50"
            >
              <span className="flex h-[96px] w-full items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white text-xs font-semibold uppercase text-slate-400">
                {visibleUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={visibleUrl}
                    alt={slot.alt}
                    className="h-full w-full object-contain p-2"
                  />
                ) : (
                  slot.label
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-800">
                  Open image picker
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">
                  {slot.description}
                </span>
              </span>
            </button>
          </div>
        );
      })}

      {activeSlot && activeSlotConfig ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4 py-6">
          <div className="max-h-[88vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  {activeSlotConfig.label}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Select an existing image from `Business Images`, upload from device,
                  or mark stored images for removal with X.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSlot(null)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="max-h-[calc(88vh-82px)] overflow-y-auto p-5">
              <input type="hidden" name="businessImageSlot" value={activeSlot} />
              {pendingDeleteImageIds[activeSlot] ? (
                <input
                  type="hidden"
                  name="deleteImageId"
                  value={pendingDeleteImageIds[activeSlot]}
                />
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {businessImages.length === 0 ? (
                  <div className="col-span-full rounded-xl border border-slate-200 bg-white px-4 py-8 text-center">
                    <p className="text-sm font-semibold text-slate-800">
                      No images found in Business Images yet.
                    </p>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                      Use Upload New Image to add one.
                    </p>
                  </div>
                ) : (
                  businessImages.map((image) => {
                    const isSelected = selectedUrls[activeSlot] === image.publicUrl;
                    const isPendingDelete =
                      pendingDeleteImageIds[activeSlot] === image.id;

                    return (
                      <div
                        key={image.id}
                        className={`relative overflow-hidden rounded-xl border bg-white p-3 ${
                          isPendingDelete
                            ? 'border-red-300 opacity-70 ring-2 ring-red-100'
                            : isSelected
                              ? 'border-blue-300 ring-2 ring-blue-100'
                              : 'border-slate-200'
                        }`}
                      >
                        <button
                          onClick={() => {
                            setPendingDeleteImageIds((current) => ({
                              ...current,
                              [activeSlot]: image.id,
                            }));
                            if (selectedUrls[activeSlot] === image.publicUrl) {
                              setSelectedUrls((current) => ({
                                ...current,
                                [activeSlot]: '',
                              }));
                            }
                            setFilePreview(activeSlot, null);
                            setDirtySlots((current) => ({
                              ...current,
                              [activeSlot]: true,
                            }));
                          }}
                          className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-red-200 bg-red-50 text-sm font-bold text-red-700 shadow-sm transition hover:bg-red-100"
                          type="button"
                          title="Remove image on save"
                        >
                          X
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedUrls((current) => ({
                              ...current,
                              [activeSlot]: image.publicUrl,
                            }));
                            setFilePreview(activeSlot, null);
                            setPendingDeleteImageIds((current) => ({
                              ...current,
                              [activeSlot]: '',
                            }));
                            setDirtySlots((current) => ({
                              ...current,
                              [activeSlot]: true,
                            }));
                          }}
                          className="block w-full text-left"
                        >
                          <span className="flex h-32 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={image.publicUrl}
                              alt={image.altText ?? image.fileName ?? ''}
                              className="h-full w-full object-contain p-2"
                            />
                          </span>
                          <span className="mt-3 block truncate text-sm font-semibold text-slate-900">
                            {image.fileName ?? image.imageType}
                          </span>
                          <span className="mt-1 block break-all text-xs text-slate-500">
                            {image.storagePath}
                          </span>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="mt-5 border-t border-slate-200 pt-4">
                <label
                  htmlFor={`business-image-file-${activeSlot}`}
                  className="inline-flex cursor-pointer rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                >
                  Upload New Image
                </label>
              </div>

              <div className="mt-5 flex justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setActiveSlot(null)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <PopupSaveButton
                  disabled={!dirtySlots[activeSlot]}
                  onFinished={closeSavedPopup}
                  saveImageAction={saveImageAction}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
