'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ProductStatus } from '@prisma/client';

type CategoryOption = {
  id: string;
  name: string;
};

type BrandOption = {
  id: string;
  name: string;
};

type VariantFormRow = {
  id: string;
  sku: string;
  color: string;
  colorHex: string;
  imageSelection: string;
  size: string;
  price: string;
  compareAtPrice: string;
  isActive: boolean;
};

type SpecificationFormRow = {
  id: string;
  name: string;
  value: string;
};

type BundleOfferFormRow = {
  id: string;
  title: string;
  imageSelection: string;
  variantSelection: string;
  minTotalQty: string;
  discountPercent: string;
  isActive: boolean;
};

type ExistingImageItem = {
  altText: string | null;
  id: string;
  storagePath: string;
  type: 'existing';
};

type NewImageItem = {
  clientId: string;
  file: File;
  previewUrl: string;
  type: 'new';
};

type ProductImageItem = ExistingImageItem | NewImageItem;

type ProductFormValue = {
  id?: string;
  name: string;
  slug: string;
  images: {
    altText: string | null;
    id: string;
    storagePath: string;
  }[];
  shortDescription: string;
  description: string;
  brandId: string;
  seoTitle: string;
  seoDescription: string;
  status: ProductStatus;
  categoryIds: string[];
  specifications: SpecificationFormRow[];
  variants: VariantFormRow[];
  bundleOffers: BundleOfferFormRow[];
};

type ProductFormProps = {
  action:
    | ((formData: FormData) => Promise<void> | void)
    | ((formData: FormData) => Promise<{ error?: string; redirectTo?: string } | void>);
  categories: CategoryOption[];
  brands: BrandOption[];
  productNavigation?: {
    nextId: string | null;
    previousId: string | null;
  };
  product?: ProductFormValue;
  submitLabel: string;
};

type ActivationRequirementsState = {
  categories: boolean;
  media: boolean;
  variants: boolean;
};

type SubmitIntent = 'productMedia' | 'variants' | 'bundleOffers' | 'full' | '';
type ProductProcessState = 'idle' | 'creating' | 'saving' | 'created' | 'saved';

const statuses: ProductStatus[] = ['draft', 'active', 'archived'];
const PRODUCT_FORM_FLASH_KEY = 'admin-product-form-flash';
// Temporarily hide product-scoped bundle editing while bundle offers move to a global reusable model.
const SHOW_PRODUCT_BUNDLE_EDITOR = false;
const PRODUCT_NAME_WORD_LIMIT = 6;
const SHORT_DESCRIPTION_WORD_LIMIT = 40;
const MAX_PRODUCT_IMAGE_FILES = 10;
const MAX_PRODUCT_IMAGE_FILE_SIZE_BYTES = 4 * 1024 * 1024;
const ALLOWED_PRODUCT_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
]);
const fieldClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:shadow-md focus:ring-2 focus:ring-slate-200';
const readOnlyFieldClass =
  'h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-700 outline-none';
const labelClass = 'space-y-1.5 text-sm font-medium text-slate-700';
const compactLabelClass = 'space-y-1.5 text-xs font-semibold text-slate-600';

type DropdownOption = {
  label: string;
  value: string;
};

type MediaOption = {
  assignedVariantLabels?: string[];
  label: string;
  previewUrl: string;
  value: string;
};

const emptyVariant = (): VariantFormRow => ({
  id: '',
  sku: '',
  color: '',
  colorHex: '',
  imageSelection: '',
  size: '',
  price: '',
  compareAtPrice: '',
  isActive: true,
});

const emptySpecification = (): SpecificationFormRow => ({
  id: '',
  name: '',
  value: '',
});

const emptyBundleOffer = (): BundleOfferFormRow => ({
  id: '',
  title: '',
  imageSelection: '',
  variantSelection: '',
  minTotalQty: '',
  discountPercent: '',
  isActive: false,
});

function getInitialProduct(product: ProductFormValue | undefined): ProductFormValue {
  return (
    product ?? {
      name: '',
      slug: '',
      images: [],
      shortDescription: '',
      description: '',
      brandId: '',
      seoTitle: '',
      seoDescription: '',
      status: 'draft',
      categoryIds: [],
      specifications: [emptySpecification()],
      variants: [emptyVariant()],
      bundleOffers: [emptyBundleOffer()],
    }
  );
}

function normalizeSkuPart(value: string) {
  return value
    .trim()
    .toUpperCase()
    .match(/[A-Z0-9]+/g)
    ?.join('-');
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function getProductSkuBase(name: string) {
  const slugParts = slugify(name)
    .split('-')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 3);
  const normalized = slugParts
    .map((part) => part.toUpperCase())
    .filter(Boolean);

  if (normalized.length > 0) {
    return normalized.join('-');
  }

  return 'PRODUCT';
}

function generateSku(name: string, color: string, size: string) {
  return [
    getProductSkuBase(name),
    normalizeSkuPart(size),
    normalizeSkuPart(color),
  ]
    .filter(Boolean)
    .join('-');
}

function buildProductSlug(name: string, fallbackSlug: string) {
  return slugify(name || fallbackSlug) || fallbackSlug || 'product';
}

function getWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean);
}

function limitWords(value: string) {
  const words = getWords(value);
  if (words.length <= SHORT_DESCRIPTION_WORD_LIMIT) return value;
  return words.slice(0, SHORT_DESCRIPTION_WORD_LIMIT).join(' ');
}

function limitProductNameWords(value: string) {
  const words = getWords(value);
  if (words.length <= PRODUCT_NAME_WORD_LIMIT) return value;
  return words.slice(0, PRODUCT_NAME_WORD_LIMIT).join(' ');
}

function getFileExtension(nameOrPath: string) {
  const extension = nameOrPath.match(/\.[^.]+$/)?.[0]?.toLowerCase();
  return extension || '.jpg';
}

function normalizeColorHex(value: string) {
  const trimmedValue = value.trim();
  const hexValue = trimmedValue.startsWith('#')
    ? trimmedValue.slice(1)
    : trimmedValue;

  if (/^[0-9a-f]{6}$/i.test(hexValue)) {
    return `#${hexValue.toLowerCase()}`;
  }

  if (/^[0-9a-f]{3}$/i.test(hexValue)) {
    return `#${Array.from(hexValue.toLowerCase())
      .map((char) => `${char}${char}`)
      .join('')}`;
  }

  return '';
}

function getColorPickerValue(value: string) {
  return normalizeColorHex(value) || '#000000';
}

function getActivationRequirementLabels(
  missing: ActivationRequirementsState,
) {
  return [
    missing.media ? 'Image' : null,
    missing.categories ? 'Category' : null,
    missing.variants ? 'Variant' : null,
  ].filter((label): label is string => Boolean(label));
}

function getImageOrderKey(item: ProductImageItem) {
  return item.type === 'existing'
    ? `existing:${item.id}`
    : `new:${item.clientId}`;
}

function buildVariantSnapshot(
  rows: VariantFormRow[],
  removedVariantIds: string[],
) {
  return JSON.stringify({
    removedVariantIds: [...removedVariantIds].sort(),
    rows: rows.map((row) => ({
      color: row.color,
      colorHex: row.colorHex,
      compareAtPrice: row.compareAtPrice,
      id: row.id,
      imageSelection: row.imageSelection,
      isActive: row.isActive,
      price: row.price,
      size: row.size,
    })),
  });
}

function formatDescriptionAsBullets(value: string) {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-*\u2022]\s+/, ''))
    .filter(Boolean);

  if (lines.length === 0) return value;

  return lines.map((line) => `\u2022 ${line}`).join('\n');
}

function extractPercentFromBundleTitle(title: string) {
  const match = title.match(/(\d+(?:\.\d+)?)\s*%/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractMinQtyFromBundleTitle(title: string) {
  const match = title.match(/(?:buy|min)\D*(\d+)/i);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const nextItems = [...items];
  const [item] = nextItems.splice(fromIndex, 1);
  if (!item) return items;
  nextItems.splice(toIndex, 0, item);
  return nextItems;
}

function appendUniqueId(ids: string[], id: string) {
  if (!id) return ids;
  return ids.includes(id) ? ids : [...ids, id];
}

function SelectArrow() {
  return (
    <span className="pointer-events-none absolute inset-y-0 right-4 flex flex-col items-center justify-center text-slate-500">
      <svg
        className="h-3 w-3"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M10 5.5 5.5 10h9L10 5.5Z" />
      </svg>
      <svg
        className="-mt-1 h-3 w-3"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M10 14.5 14.5 10h-9l4.5 4.5Z" />
      </svg>
    </span>
  );
}

function FormDropdown({
  disabled = false,
  id,
  label,
  name,
  onChange,
  options,
  value,
}: {
  disabled?: boolean;
  id: string;
  label?: string;
  name: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  value: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value);

  return (
    <div className="relative">
      <input type="hidden" name={name} value={value} />
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
        onBlur={() => setTimeout(() => setIsOpen(false), 120)}
        className={`h-11 w-full rounded-xl border bg-white px-3.5 py-2.5 pr-11 text-left text-sm outline-none transition ${
          isOpen
            ? 'border-slate-500 text-slate-900 shadow-md ring-2 ring-slate-200'
            : 'border-slate-300 text-slate-800'
        } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
      >
        {selectedOption?.label ?? label ?? 'Select'}
      </button>
      <SelectArrow />
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-200/70"
            role="listbox"
            aria-labelledby={id}
          >
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={value === option.value}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`block w-full px-3.5 py-2.5 text-left text-sm transition ${
                  value === option.value
                    ? 'bg-slate-100 font-semibold text-slate-950'
                    : 'text-slate-700 hover:bg-slate-50 hover:text-slate-950'
                }`}
              >
                {option.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function VariantImagePicker({
  mediaOptions,
  name,
  onChange,
  value,
}: {
  mediaOptions: MediaOption[];
  name: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredOption, setHoveredOption] = useState<MediaOption | null>(null);
  const selectedValues = new Set(
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );
  const selectedOptions = mediaOptions.filter((option) =>
    selectedValues.has(option.value),
  );
  const firstSelectedOption = selectedOptions[0];

  return (
    <div className="relative">
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        onBlur={() => setTimeout(() => setIsOpen(false), 120)}
        className="flex h-11 w-full items-center gap-2 rounded-xl border border-slate-300 bg-white px-2.5 pr-12 text-slate-700 transition hover:border-slate-400"
      >
        {firstSelectedOption ? (
          <>
            <span className="relative block h-7 w-7 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
              <Image
                src={firstSelectedOption.previewUrl}
                alt={firstSelectedOption.label}
                fill
                unoptimized
                sizes="28px"
                className="object-contain p-0.5"
              />
            </span>
            <span className="min-w-0 text-left text-xs font-semibold text-slate-600">
              {selectedOptions.length} selected
            </span>
            <span className="ml-auto text-slate-400">
              <svg
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M10 14.5 14.5 10h-9l4.5 4.5Z" />
              </svg>
            </span>
          </>
        ) : (
          <>
            <span className="relative -top-px text-xl leading-none font-semibold">
              +
            </span>
            <span className="min-w-0 text-left text-xs font-semibold text-slate-600">
              Choose
            </span>
            <span className="ml-auto text-slate-400">
              <svg
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M10 14.5 14.5 10h-9l4.5 4.5Z" />
              </svg>
            </span>
          </>
        )}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-0 top-[calc(100%+8px)] z-20 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl shadow-slate-200/70"
            role="listbox"
          >
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                role="option"
                aria-selected={selectedValues.size === 0}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange('');
                  setIsOpen(false);
                }}
                className={`flex aspect-square items-center justify-center rounded-xl border text-xl font-semibold transition ${
                  selectedValues.size === 0
                    ? 'border-slate-900 bg-slate-100 text-slate-900'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-slate-100'
                }`}
              >
                +
              </button>
              {mediaOptions.map((option) => {
                const tiedVariantLabels = option.assignedVariantLabels ?? [];
                const tiedVariantSummary = tiedVariantLabels.join(', ');

                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={selectedValues.has(option.value)}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setHoveredOption(option)}
                    onMouseLeave={() => setHoveredOption(null)}
                    onClick={() => {
                      const nextValues = new Set(selectedValues);
                      if (nextValues.has(option.value)) {
                        nextValues.delete(option.value);
                      } else {
                        nextValues.add(option.value);
                      }
                      onChange([...nextValues].join(','));
                    }}
                    className={`relative aspect-square overflow-hidden rounded-xl border transition ${
                      selectedValues.has(option.value)
                        ? 'border-slate-900 bg-slate-100'
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100'
                    }`}
                    title={
                      tiedVariantSummary
                        ? `${option.label} tied to ${tiedVariantSummary}`
                        : option.label
                    }
                  >
                    <Image
                      src={option.previewUrl}
                      alt={option.label}
                      fill
                      unoptimized
                      sizes="56px"
                      className="object-contain p-1"
                    />
                    {tiedVariantLabels.length > 0 ? (
                      <span className="absolute inset-x-1 bottom-1 truncate rounded bg-white/90 px-1 py-0.5 text-[9px] font-semibold text-slate-700">
                        {tiedVariantLabels.length} tied
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            {hoveredOption ? (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2">
                <div className="relative h-36 w-full overflow-hidden rounded-md bg-white">
                  <Image
                    src={hoveredOption.previewUrl}
                    alt={hoveredOption.label}
                    fill
                    unoptimized
                    sizes="256px"
                    className="object-contain p-2"
                  />
                </div>
                <p className="mt-2 truncate text-[11px] font-semibold text-slate-700">
                  {hoveredOption.label}
                </p>
                {(hoveredOption.assignedVariantLabels ?? []).length > 0 ? (
                  <div className="mt-2 rounded-md border border-slate-200 bg-white px-2 py-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Tied variants
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(hoveredOption.assignedVariantLabels ?? []).map((label, index) => (
                        <span
                          key={`${label}-${index}`}
                          className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ProductForm({
  action,
  categories,
  brands,
  productNavigation,
  product,
  submitLabel,
}: ProductFormProps) {
  const router = useRouter();
  const initialProduct = useMemo(() => getInitialProduct(product), [product]);
  const initialVariantRows = useMemo(
    () =>
      initialProduct.variants.length > 0
        ? initialProduct.variants
        : [emptyVariant()],
    [initialProduct.variants],
  );
  const [productName, setProductName] = useState(initialProduct.name);
  const [shortDescription, setShortDescription] = useState(
    initialProduct.shortDescription,
  );
  const [description, setDescription] = useState(initialProduct.description);
  const [selectedBrandId, setSelectedBrandId] = useState(initialProduct.brandId);
  const [seoTitle, setSeoTitle] = useState(initialProduct.seoTitle);
  const [seoDescription, setSeoDescription] = useState(initialProduct.seoDescription);
  const shortDescriptionRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const [specifications, setSpecifications] = useState(
    initialProduct.specifications.length > 0
      ? initialProduct.specifications
      : [emptySpecification()],
  );
  const [removedSpecificationIds, setRemovedSpecificationIds] = useState<string[]>([]);
  const [draggedSpecificationIndex, setDraggedSpecificationIndex] = useState<number | null>(null);
  const [rows, setRows] = useState(initialVariantRows);
  const [highlightedVariantIndex, setHighlightedVariantIndex] = useState<
    number | null
  >(null);
  const [openVariantIndexes, setOpenVariantIndexes] = useState<Set<number>>(
    () => new Set([0]),
  );
  const [removedVariantIds, setRemovedVariantIds] = useState<string[]>([]);
  const [bundleOffers, setBundleOffers] = useState<BundleOfferFormRow[]>(
    initialProduct.bundleOffers.length > 0
      ? initialProduct.bundleOffers
      : [emptyBundleOffer()],
  );
  const [openBundleIndexes, setOpenBundleIndexes] = useState<Set<number>>(
    () => new Set([0]),
  );
  const [highlightedBundleIndex, setHighlightedBundleIndex] = useState<
    number | null
  >(null);
  const [removedBundleOfferIds, setRemovedBundleOfferIds] = useState<string[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    initialProduct.categoryIds,
  );
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(initialProduct.status);
  const [imageItems, setImageItems] = useState<ProductImageItem[]>(() =>
    initialProduct.images.map((image) => ({
      ...image,
      type: 'existing' as const,
    })),
  );
  const imageItemsRef = useRef<ProductImageItem[]>(imageItems);
  const rowsRef = useRef<VariantFormRow[]>(rows);
  const removedVariantIdsRef = useRef<string[]>(removedVariantIds);
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([]);
  const [draggedImageKey, setDraggedImageKey] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmittingProduct, setIsSubmittingProduct] = useState(false);
  const [activeSubmitIntent, setActiveSubmitIntent] = useState<SubmitIntent>('');
  const [productProcessState, setProductProcessState] =
    useState<ProductProcessState>('idle');
  const [activationRequirements, setActivationRequirements] =
    useState<ActivationRequirementsState>({
      categories: false,
      media: false,
      variants: false,
    });
  const isEditing = Boolean(initialProduct.id);
  const productNameWordsLeft = PRODUCT_NAME_WORD_LIMIT - getWords(productName).length;
  const shortDescriptionWordsLeft =
    SHORT_DESCRIPTION_WORD_LIMIT - getWords(shortDescription).length;
  const imageNameBase = slugify(productName || initialProduct.slug) || 'product';
  const mediaOptions = imageItems.map((item, index) => {
      const previewUrl =
        item.type === 'existing' ? item.storagePath : item.previewUrl;
      const renamedImageName = `${imageNameBase}-${index + 1}${getFileExtension(
        item.type === 'existing' ? item.storagePath : item.file.name,
      )}`;

      return {
        label: renamedImageName,
        previewUrl,
        value: getImageOrderKey(item),
      };
    });
  const variantMediaOptions = mediaOptions;
  function getVariantImageAssignmentLabel(row: VariantFormRow, index: number) {
    const sku = generateSku(productName, row.color, row.size);
    const fallback = [row.size.trim(), row.color.trim()].filter(Boolean).join(' / ');

    return sku || fallback || `Variant ${index + 1}`;
  }

  function getVariantMediaOptions() {
    const assignedByImageKey = new Map<string, string[]>();
    rows.forEach((row, index) => {
      const label = getVariantImageAssignmentLabel(row, index);
      row.imageSelection
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((imageKey) => {
          const labels = assignedByImageKey.get(imageKey) ?? [];
          labels.push(label);
          assignedByImageKey.set(imageKey, labels);
        });
    });

    return variantMediaOptions.map((option) => {
      return {
        ...option,
        assignedVariantLabels: assignedByImageKey.get(option.value) ?? [],
      };
    });
  }
  const hasPersistedVariants = rows.some((row) => Boolean(row.id));
  const isVariantSectionEnabled = true;
  const isBundleSectionEnabled = isEditing && hasPersistedVariants;
  const visibleVariantIndexes = rows.map((_, index) => index);
  const bundleVariantOptions = rows
    .filter((row) => Boolean(row.id) && row.isActive)
    .map((row, index) => {
      const parts = [row.color.trim(), row.size.trim()].filter(Boolean);
      const labelBase = parts.length > 0 ? parts.join(' / ') : `Variant ${index + 1}`;
      return {
        label: `${labelBase}${row.sku ? ` (${row.sku})` : ''}`,
        value: `existing:${row.id}`,
      };
    });
  const statusOptions = statuses.map((status) => ({
    label: status.charAt(0).toUpperCase() + status.slice(1),
    value: status,
  }));
  const activeOptions = [
    { label: 'Yes', value: 'true' },
    { label: 'No', value: 'false' },
  ];
  const currentSnapshot = useMemo(
    () =>
      JSON.stringify({
        categoryIds: [...selectedCategoryIds].sort(),
        description,
        selectedBrandId,
        seoTitle,
        seoDescription,
        images: imageItems.map((item) =>
          item.type === 'existing'
            ? { key: getImageOrderKey(item) }
            : {
                key: getImageOrderKey(item),
                lastModified: item.file.lastModified,
                name: item.file.name,
                size: item.file.size,
              },
        ),
        productName,
        removedImageIds: [...removedImageIds].sort(),
        removedSpecificationIds: [...removedSpecificationIds].sort(),
        removedVariantIds: [...removedVariantIds].sort(),
        removedBundleOfferIds: [...removedBundleOfferIds].sort(),
        bundleOffers: bundleOffers.map((offer) => ({
          id: offer.id,
          title: offer.title,
          imageSelection: offer.imageSelection,
          variantSelection: offer.variantSelection,
          minTotalQty: offer.minTotalQty,
          discountPercent: offer.discountPercent,
          isActive: offer.isActive,
        })),
        rows: rows.map((row) => ({
          color: row.color,
          colorHex: row.colorHex,
          compareAtPrice: row.compareAtPrice,
          id: row.id,
          imageSelection: row.imageSelection,
          isActive: row.isActive,
          price: row.price,
          size: row.size,
        })),
        selectedStatus,
        shortDescription,
        specifications: specifications.map((specification) => ({
          id: specification.id,
          name: specification.name,
          value: specification.value,
        })),
      }),
    [
      description,
      selectedBrandId,
      seoTitle,
      seoDescription,
      imageItems,
      productName,
      removedImageIds,
      removedSpecificationIds,
      removedVariantIds,
      removedBundleOfferIds,
      bundleOffers,
      rows,
      selectedCategoryIds,
      selectedStatus,
      shortDescription,
      specifications,
    ],
  );
  const initialSnapshot = useMemo(
    () =>
      JSON.stringify({
        categoryIds: [...initialProduct.categoryIds].sort(),
        description: initialProduct.description,
        selectedBrandId: initialProduct.brandId,
        seoTitle: initialProduct.seoTitle,
        seoDescription: initialProduct.seoDescription,
        images: initialProduct.images.map((image) => ({
          key: `existing:${image.id}`,
        })),
        productName: initialProduct.name,
        removedImageIds: [],
        removedSpecificationIds: [],
        removedVariantIds: [],
        removedBundleOfferIds: [],
        bundleOffers: (
          initialProduct.bundleOffers.length > 0
            ? initialProduct.bundleOffers
            : [emptyBundleOffer()]
        ).map((offer) => ({
          id: offer.id,
          title: offer.title,
          imageSelection: offer.imageSelection,
          variantSelection: offer.variantSelection,
          minTotalQty: offer.minTotalQty,
          discountPercent: offer.discountPercent,
          isActive: offer.isActive,
        })),
        rows: initialVariantRows.map((row) => ({
          color: row.color,
          colorHex: row.colorHex,
          compareAtPrice: row.compareAtPrice,
          id: row.id,
          imageSelection: row.imageSelection,
          isActive: row.isActive,
          price: row.price,
          size: row.size,
        })),
        selectedStatus: initialProduct.status,
        shortDescription: initialProduct.shortDescription,
        specifications: (
          initialProduct.specifications.length > 0
            ? initialProduct.specifications
            : [emptySpecification()]
        ).map((specification) => ({
          id: specification.id,
          name: specification.name,
          value: specification.value,
        })),
      }),
    [
      initialVariantRows,
      initialProduct.brandId,
      initialProduct.bundleOffers,
      initialProduct.categoryIds,
      initialProduct.description,
      initialProduct.images,
      initialProduct.name,
      initialProduct.seoDescription,
      initialProduct.seoTitle,
      initialProduct.shortDescription,
      initialProduct.specifications,
      initialProduct.status,
    ],
  );
  const hasChanges = currentSnapshot !== initialSnapshot;
  const currentProductSnapshot = useMemo(
    () =>
      JSON.stringify({
        categoryIds: [...selectedCategoryIds].sort(),
        description,
        selectedBrandId,
        seoTitle,
        seoDescription,
        images: imageItems.map((item) =>
          item.type === 'existing'
            ? { key: getImageOrderKey(item) }
            : {
                key: getImageOrderKey(item),
                lastModified: item.file.lastModified,
                name: item.file.name,
                size: item.file.size,
              },
        ),
        productName,
        removedImageIds: [...removedImageIds].sort(),
        removedSpecificationIds: [...removedSpecificationIds].sort(),
        selectedStatus,
        shortDescription,
        specifications: specifications.map((specification) => ({
          id: specification.id,
          name: specification.name,
          value: specification.value,
        })),
      }),
    [
      description,
      selectedBrandId,
      seoTitle,
      seoDescription,
      imageItems,
      productName,
      removedImageIds,
      removedSpecificationIds,
      selectedCategoryIds,
      selectedStatus,
      shortDescription,
      specifications,
    ],
  );
  const initialProductSnapshot = useMemo(
    () =>
      JSON.stringify({
        categoryIds: [...initialProduct.categoryIds].sort(),
        description: initialProduct.description,
        selectedBrandId: initialProduct.brandId,
        seoTitle: initialProduct.seoTitle,
        seoDescription: initialProduct.seoDescription,
        images: initialProduct.images.map((image) => ({
          key: `existing:${image.id}`,
        })),
        productName: initialProduct.name,
        removedImageIds: [],
        removedSpecificationIds: [],
        selectedStatus: initialProduct.status,
        shortDescription: initialProduct.shortDescription,
        specifications: (
          initialProduct.specifications.length > 0
            ? initialProduct.specifications
            : [emptySpecification()]
        ).map((specification) => ({
          id: specification.id,
          name: specification.name,
          value: specification.value,
        })),
      }),
    [initialProduct],
  );
  const [savedProductSnapshot, setSavedProductSnapshot] = useState(
    initialProductSnapshot,
  );
  useEffect(() => {
    setSavedProductSnapshot(initialProductSnapshot);
  }, [initialProductSnapshot]);
  const hasProductChanges = currentProductSnapshot !== savedProductSnapshot;

  const currentVariantSnapshot = useMemo(
    () => buildVariantSnapshot(rows, removedVariantIds),
    [removedVariantIds, rows],
  );
  const initialVariantSnapshot = useMemo(
    () => buildVariantSnapshot(initialVariantRows, []),
    [initialVariantRows],
  );
  const [savedVariantSnapshot, setSavedVariantSnapshot] = useState(
    initialVariantSnapshot,
  );
  useEffect(() => {
    setSavedVariantSnapshot(initialVariantSnapshot);
  }, [initialVariantSnapshot]);
  const hasVariantChanges = currentVariantSnapshot !== savedVariantSnapshot;
  const currentBundleSnapshot = useMemo(
    () =>
      JSON.stringify({
        removedBundleOfferIds: [...removedBundleOfferIds].sort(),
        bundleOffers: bundleOffers.map((offer) => ({
          id: offer.id,
          title: offer.title,
          imageSelection: offer.imageSelection,
          variantSelection: offer.variantSelection,
          minTotalQty: offer.minTotalQty,
          discountPercent: offer.discountPercent,
          isActive: offer.isActive,
        })),
      }),
    [removedBundleOfferIds, bundleOffers],
  );
  const initialBundleSnapshot = useMemo(
    () =>
      JSON.stringify({
        removedBundleOfferIds: [],
        bundleOffers: (
          initialProduct.bundleOffers.length > 0
            ? initialProduct.bundleOffers
            : [emptyBundleOffer()]
        ).map((offer) => ({
          id: offer.id,
          title: offer.title,
          imageSelection: offer.imageSelection,
          variantSelection: offer.variantSelection,
          minTotalQty: offer.minTotalQty,
          discountPercent: offer.discountPercent,
          isActive: offer.isActive,
        })),
      }),
    [initialProduct.bundleOffers],
  );
  const [savedBundleSnapshot, setSavedBundleSnapshot] = useState(
    initialBundleSnapshot,
  );
  useEffect(() => {
    setSavedBundleSnapshot(initialBundleSnapshot);
  }, [initialBundleSnapshot]);
  const hasBundleChanges = currentBundleSnapshot !== savedBundleSnapshot;
  const hasUnifiedChanges =
    hasProductChanges || hasVariantChanges || hasBundleChanges;
  const hasPendingFormChanges = isEditing ? hasUnifiedChanges : hasChanges;
  const isProductEditorEnabled = true;
  const isVariantEditorEnabled = isVariantSectionEnabled;
  const isBundleEditorEnabled =
    isBundleSectionEnabled && !hasProductChanges && !hasVariantChanges;
  const isActivationReadinessError =
    Boolean(submitError) && (submitError ?? '').startsWith('Cannot save.');
  const productProcessMessage =
    productProcessState === 'creating'
      ? 'Creating, please wait.'
      : productProcessState === 'saving'
        ? 'Saving, please wait.'
        : productProcessState === 'created'
          ? 'Created.'
          : productProcessState === 'saved'
            ? 'Saved.'
            : null;
  const productProcessMessageClass =
    productProcessState === 'created' || productProcessState === 'saved'
      ? 'text-emerald-700'
      : 'text-slate-600';

  useEffect(() => {
    imageItemsRef.current = imageItems;
  }, [imageItems]);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    const flash = window.sessionStorage.getItem(PRODUCT_FORM_FLASH_KEY);
    if (flash !== 'created' && flash !== 'saved') return;
    window.sessionStorage.removeItem(PRODUCT_FORM_FLASH_KEY);
    setProductProcessState(flash);
    const timeout = window.setTimeout(() => {
      setProductProcessState('idle');
    }, 4000);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    removedVariantIdsRef.current = removedVariantIds;
  }, [removedVariantIds]);

  useEffect(
    () => () => {
      imageItemsRef.current.forEach((item) => {
        if (item.type === 'new') {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
    },
    [],
  );

  useEffect(() => {
    const field = imageInputRef.current;
    if (!field) return;

    const files = new DataTransfer();
    imageItems.forEach((item) => {
      if (item.type === 'new') {
        files.items.add(item.file);
      }
    });
    field.files = files.files;
  }, [imageItems]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        categoryDropdownRef.current &&
        !categoryDropdownRef.current.contains(event.target as Node)
      ) {
        setIsCategoryDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  function updateRow(index: number, patch: Partial<VariantFormRow>) {
    setRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    );
  }

  function glowVariant(index: number) {
    setHighlightedVariantIndex(index);
  }

  function glowBundle(index: number) {
    setHighlightedBundleIndex(index);
  }

  function clearRowHighlights() {
    setHighlightedVariantIndex(null);
    setHighlightedBundleIndex(null);
  }

  function updateSpecification(
    index: number,
    patch: Partial<SpecificationFormRow>,
  ) {
    setSpecifications((current) =>
      current.map((specification, specificationIndex) =>
        specificationIndex === index
          ? { ...specification, ...patch }
          : specification,
      ),
    );
  }

  function removeRow(index: number) {
    setRows((current) => {
      const row = current[index];
      if (row?.id) {
        setRemovedVariantIds((ids) => appendUniqueId(ids, row.id));
      }

      const nextRows = current.filter((_, rowIndex) => rowIndex !== index);
      return nextRows.length > 0 ? nextRows : [emptyVariant()];
    });
    setOpenVariantIndexes((current) => {
      const next = new Set<number>();
      current.forEach((openIndex) => {
        if (openIndex === index) return;
        next.add(openIndex > index ? openIndex - 1 : openIndex);
      });
      if (next.size === 0) {
        next.add(0);
      }
      return next;
    });
  }

  function removeSpecification(index: number) {
    setSpecifications((current) => {
      const specification = current[index];
      if (specification?.id) {
        setRemovedSpecificationIds((ids) =>
          appendUniqueId(ids, specification.id),
        );
      }

      const nextSpecifications = current.filter(
        (_, specificationIndex) => specificationIndex !== index,
      );

      return nextSpecifications.length > 0
        ? nextSpecifications
        : [emptySpecification()];
    });
  }

  function resizeShortDescriptionField() {
    const field = shortDescriptionRef.current;
    if (!field) return;
    field.style.height = 'auto';
    field.style.height = `${field.scrollHeight}px`;
  }

  function handleImageSelection(files: FileList | null) {
    const incomingFiles = Array.from(files ?? []);
    const existingCount = imageItems.length;

    if (existingCount + incomingFiles.length > MAX_PRODUCT_IMAGE_FILES) {
      setSubmitError(
        `You can upload up to ${MAX_PRODUCT_IMAGE_FILES} images per product.`,
      );
      return;
    }

    for (const file of incomingFiles) {
      if (!ALLOWED_PRODUCT_IMAGE_MIME_TYPES.has(file.type)) {
        setSubmitError(
          `Unsupported image type "${file.type || 'unknown'}". Allowed: JPG, PNG, WEBP, AVIF.`,
        );
        return;
      }
      if (file.size > MAX_PRODUCT_IMAGE_FILE_SIZE_BYTES) {
        setSubmitError(
          `Image "${file.name}" exceeds ${(MAX_PRODUCT_IMAGE_FILE_SIZE_BYTES / (1024 * 1024)).toFixed(0)}MB limit.`,
        );
        return;
      }
    }

    setSubmitError(null);
    const nextItems: NewImageItem[] = incomingFiles.map((file) => ({
      clientId: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      type: 'new',
    }));

    setImageItems((current) => {
      const nextImageItems = [...current, ...nextItems];
      syncFileInputWithImageItems(nextImageItems);
      return nextImageItems;
    });
  }

  function updateBundleOffer(index: number, patch: Partial<BundleOfferFormRow>) {
    setBundleOffers((current) =>
      current.map((offer, offerIndex) =>
        offerIndex === index ? { ...offer, ...patch } : offer,
      ),
    );
  }

  function removeBundleOffer(index: number) {
    setBundleOffers((current) => {
      const offer = current[index];
      if (offer?.id) {
        setRemovedBundleOfferIds((ids) => appendUniqueId(ids, offer.id));
      }
      const nextOffers = current.filter((_, offerIndex) => offerIndex !== index);
      return nextOffers.length > 0 ? nextOffers : [emptyBundleOffer()];
    });
    setOpenBundleIndexes((current) => {
      const next = new Set<number>();
      current.forEach((openIndex) => {
        if (openIndex === index) return;
        next.add(openIndex > index ? openIndex - 1 : openIndex);
      });
      if (next.size === 0) {
        next.add(0);
      }
      return next;
    });
  }

  function addBundleOfferBelow(index: number) {
    const insertIndex = index + 1;
    setBundleOffers((current) => {
      const source = current[index] ?? emptyBundleOffer();
      const copy: BundleOfferFormRow = {
        ...source,
        id: '',
        isActive: false,
      };
      const next = [...current];
      next.splice(index + 1, 0, copy);
      return next;
    });
    setOpenBundleIndexes((current) => {
      const next = new Set<number>();
      current.forEach((openIndex) => {
        next.add(openIndex >= insertIndex ? openIndex + 1 : openIndex);
      });
      next.add(insertIndex);
      return next;
    });
    glowBundle(insertIndex);
  }

  function moveDraggedSpecification(targetIndex: number, sourceIndex?: number) {
    const effectiveSourceIndex = sourceIndex ?? draggedSpecificationIndex;
    if (
      effectiveSourceIndex === null ||
      effectiveSourceIndex === targetIndex ||
      effectiveSourceIndex < 0
    ) {
      return;
    }

    setSpecifications((current) => {
      if (
        effectiveSourceIndex >= current.length ||
        targetIndex < 0 ||
        targetIndex >= current.length
      ) {
        return current;
      }
      return moveItem(current, effectiveSourceIndex, targetIndex);
    });

    setDraggedSpecificationIndex(null);
  }

  function addRowBelow(index: number) {
    const insertIndex = index + 1;
    setRows((current) => {
      const source = current[index] ?? emptyVariant();
      const copy: VariantFormRow = {
        ...source,
        id: '',
        imageSelection: '',
        sku: '',
      };
      const nextRows = [...current];
      nextRows.splice(index + 1, 0, copy);
      return nextRows;
    });
    setOpenVariantIndexes((current) => {
      const next = new Set<number>();
      current.forEach((openIndex) => {
        next.add(openIndex >= insertIndex ? openIndex + 1 : openIndex);
      });
      next.add(insertIndex);
      return next;
    });
    glowVariant(insertIndex);
  }

  function moveRow(index: number, direction: 'up' | 'down') {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= rowsRef.current.length) return;

    setRows((current) => {
      if (targetIndex < 0 || targetIndex >= current.length) return current;
      return moveItem(current, index, targetIndex);
    });
    setOpenVariantIndexes((current) => {
      const next = new Set<number>();
      current.forEach((openIndex) => {
        if (openIndex === index) {
          next.add(targetIndex);
        } else if (openIndex === targetIndex) {
          next.add(index);
        } else {
          next.add(openIndex);
        }
      });
      return next;
    });
    glowVariant(targetIndex);
  }

  function toggleVariantOpen(index: number) {
    if (isSubmittingProduct || !isVariantEditorEnabled) return;

    setOpenVariantIndexes((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  function toggleBundleOpen(index: number) {
    if (isSubmittingProduct || !isBundleEditorEnabled) return;

    setOpenBundleIndexes((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  function syncFileInputWithImageItems(items: ProductImageItem[]) {
    const imageInput = imageInputRef.current;
    if (!imageInput) return;

    const dataTransfer = new DataTransfer();
    items.forEach((item) => {
      if (item.type === 'new') {
        dataTransfer.items.add(item.file);
      }
    });

    imageInput.files = dataTransfer.files;
  }

  function removeImage(item: ProductImageItem) {
    const imageKey = getImageOrderKey(item);
    if (item.type === 'existing') {
      setRemovedImageIds((ids) => appendUniqueId(ids, item.id));
    } else {
      URL.revokeObjectURL(item.previewUrl);
    }

    setRows((current) =>
      current.map((row) =>
        {
          const nextSelections = row.imageSelection
            .split(',')
            .map((selection) => selection.trim())
            .filter(Boolean)
            .filter((selection) => selection !== imageKey);
          return nextSelections.length === 0 && row.imageSelection.length === 0
            ? row
            : { ...row, imageSelection: nextSelections.join(',') };
        },
      ),
    );

    setImageItems((current) =>
      {
        const nextImageItems = current.filter(
          (currentItem) => getImageOrderKey(currentItem) !== imageKey,
        );
        syncFileInputWithImageItems(nextImageItems);
        return nextImageItems;
      },
    );
  }

  function moveDraggedImage(targetKey: string, sourceKey?: string) {
    const effectiveSourceKey = sourceKey ?? draggedImageKey;
    if (!effectiveSourceKey || effectiveSourceKey === targetKey) return;

    setImageItems((current) => {
      const fromIndex = current.findIndex(
        (item) => getImageOrderKey(item) === effectiveSourceKey,
      );
      const toIndex = current.findIndex(
        (item) => getImageOrderKey(item) === targetKey,
      );

      if (fromIndex < 0 || toIndex < 0) return current;
      return moveItem(current, fromIndex, toIndex);
    });

    setDraggedImageKey(null);
  }

  function resetProductSection() {
    setProductName(initialProduct.name);
    setShortDescription(initialProduct.shortDescription);
    setDescription(initialProduct.description);
    setSelectedBrandId(initialProduct.brandId);
    setSeoTitle(initialProduct.seoTitle);
    setSeoDescription(initialProduct.seoDescription);
    setSelectedStatus(initialProduct.status);
    setSelectedCategoryIds(initialProduct.categoryIds);
    setSpecifications(
      initialProduct.specifications.length > 0
        ? initialProduct.specifications
        : [emptySpecification()],
    );
    setRemovedSpecificationIds([]);
    setRemovedImageIds([]);
    setImageItems((current) => {
      current.forEach((item) => {
        if (item.type === 'new') {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
      return initialProduct.images.map((image) => ({
        ...image,
        type: 'existing' as const,
      }));
    });
    setSubmitError(null);
    setActivationRequirements({
      categories: false,
      media: false,
      variants: false,
    });
  }

  function resetBundleSection() {
    setBundleOffers(
      initialProduct.bundleOffers.length > 0
        ? initialProduct.bundleOffers
        : [emptyBundleOffer()],
    );
    setOpenBundleIndexes(new Set([0]));
    setRemovedBundleOfferIds([]);
    setSubmitError(null);
  }

  function isBlankVariantRow(row: VariantFormRow) {
    return (
      !row.id &&
      !row.color.trim() &&
      !row.colorHex.trim() &&
      !row.imageSelection.trim() &&
      !row.size.trim() &&
      !row.price.trim() &&
      !row.compareAtPrice.trim()
    );
  }

  function isRemovedVariant(row: VariantFormRow) {
    return Boolean(row.id && removedVariantIds.includes(row.id));
  }

  function isCompleteVariantRow(row: VariantFormRow) {
    const price = Number(row.price);

    return (
      !isRemovedVariant(row) &&
      Boolean(row.color.trim()) &&
      Boolean(normalizeColorHex(row.colorHex)) &&
      row.price.trim().length > 0 &&
      Number.isFinite(price) &&
      price >= 0
    );
  }

  function getVariantRequiredError() {
    const keptRows = rows.filter((row) => !isRemovedVariant(row));
    const rowsWithInput = keptRows.filter((row) => !isBlankVariantRow(row));

    if (rowsWithInput.length === 0) {
      return 'Add at least one variant with color name, color hex, and price.';
    }

    for (const [index, row] of rows.entries()) {
      if (isRemovedVariant(row) || isBlankVariantRow(row)) continue;

      if (!row.color.trim()) {
        return `Variant ${index + 1} needs a color name.`;
      }
      if (!normalizeColorHex(row.colorHex)) {
        return `Variant ${index + 1} needs a valid color hex.`;
      }
      if (!row.price.trim()) {
        return `Variant ${index + 1} needs a price.`;
      }
      const price = Number(row.price);
      if (!Number.isFinite(price) || price < 0) {
        return `Variant ${index + 1} price must be a valid positive amount.`;
      }
    }

    return keptRows.some(isCompleteVariantRow)
      ? null
      : 'Add at least one variant with color name, color hex, and price.';
  }

  function getActivationMissingRequirements(formData?: FormData) {
    const submittedImageOrder = formData
      ?.getAll('imageOrder')
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean);
    const submittedCategories = formData
      ?.getAll('categoryIds')
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean);

    const hasMedia = formData
      ? (submittedImageOrder?.length ?? 0) > 0
      : imageItems.length > 0;
    const hasCategories = formData
      ? (submittedCategories?.length ?? 0) > 0
      : selectedCategoryIds.length > 0;
    const hasCompleteVariant = rows.some(isCompleteVariantRow);

    return {
      categories: !hasCategories,
      media: !hasMedia,
      variants: !hasCompleteVariant,
    };
  }

  function getVariantDuplicateError() {
    const seen = new Map<string, number>();

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      if (!row.isActive) {
        continue;
      }
      const color = row.color.trim().toLowerCase();
      const size = row.size.trim().toLowerCase();
      if (!color || !size) {
        continue;
      }
      const key = `${color}__${size}`;

      const existing = seen.get(key);
      if (typeof existing === 'number') {
        return `Variant ${index + 1} duplicates Variant ${existing + 1} (same color + size). Update one before saving variants.`;
      }
      seen.set(key, index);
    }

    return null;
  }

  async function handleSubmit(formData: FormData) {
    if (isSubmittingProduct) return;
    setSubmitError(null);
    const submitIntent = String(formData.get('submitIntent') ?? '').trim() as SubmitIntent;
    const isProductSubmit =
      submitIntent === '' ||
      submitIntent === 'full' ||
      submitIntent === 'productMedia';
    if (isProductSubmit) {
      setProductProcessState(isEditing ? 'saving' : 'creating');
    } else {
      setProductProcessState('idle');
    }

    const missing = getActivationMissingRequirements(formData);
    setActivationRequirements(missing);
    if (missing.categories || missing.media || missing.variants) {
      const missingLabels = getActivationRequirementLabels(missing);
      const variantRequiredError = missing.variants
        ? getVariantRequiredError()
        : null;
      setSubmitError(
        variantRequiredError ??
          `Cannot save. Missing fields: ${missingLabels.join(', ')}.`,
      );
      setProductProcessState('idle');
      return;
    }

    if (imageItems.length > MAX_PRODUCT_IMAGE_FILES) {
      setSubmitError(
        `You can upload up to ${MAX_PRODUCT_IMAGE_FILES} images per product.`,
      );
      setProductProcessState('idle');
      return;
    }

    const variantRequiredError = getVariantRequiredError();
    if (variantRequiredError) {
      setSubmitError(variantRequiredError);
      setProductProcessState('idle');
      return;
    }

    const duplicateVariantError = getVariantDuplicateError();
    if (duplicateVariantError) {
      setSubmitError(duplicateVariantError);
      setProductProcessState('idle');
      return;
    }

    let keepSaveLocked = false;
    setIsSubmittingProduct(true);
    setActiveSubmitIntent(submitIntent);
    try {
      const result = await action(formData);
      if (
        result &&
        typeof result === 'object' &&
        'error' in result &&
        typeof result.error === 'string' &&
        result.error.trim().length > 0
      ) {
        setSubmitError(result.error);
        if (isProductSubmit) {
          setProductProcessState('idle');
        }
      } else if (
        result &&
        typeof result === 'object' &&
        'redirectTo' in result &&
        typeof result.redirectTo === 'string' &&
        result.redirectTo.trim().length > 0
      ) {
        if (isProductSubmit) {
          window.sessionStorage.setItem(PRODUCT_FORM_FLASH_KEY, 'created');
        }
        setProductProcessState('created');
        keepSaveLocked = true;
        router.replace(result.redirectTo);
      } else if (submitIntent === 'variants') {
        setSavedVariantSnapshot(
          buildVariantSnapshot(rowsRef.current, removedVariantIdsRef.current),
        );
        keepSaveLocked = true;
        router.refresh();
      } else if (submitIntent === 'bundleOffers') {
        setSavedBundleSnapshot(currentBundleSnapshot);
        keepSaveLocked = true;
        router.refresh();
      } else if (submitIntent === 'productMedia' || submitIntent === 'full') {
        setSavedProductSnapshot(currentProductSnapshot);
        if (submitIntent === 'full') {
          setSavedVariantSnapshot(
            buildVariantSnapshot(rowsRef.current, removedVariantIdsRef.current),
          );
          setSavedBundleSnapshot(currentBundleSnapshot);
        }
        setProductProcessState(isEditing ? 'saved' : 'created');
        keepSaveLocked = true;
        router.refresh();
      }
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'digest' in error &&
        typeof (error as { digest?: unknown }).digest === 'string' &&
        (error as { digest: string }).digest.startsWith('NEXT_REDIRECT')
      ) {
        if (isProductSubmit) {
          window.sessionStorage.setItem(
            PRODUCT_FORM_FLASH_KEY,
            isEditing ? 'saved' : 'created',
          );
        }
        if (submitIntent === 'variants') {
          setSavedVariantSnapshot(
            buildVariantSnapshot(rowsRef.current, removedVariantIdsRef.current),
          );
          keepSaveLocked = true;
        } else if (submitIntent === 'bundleOffers') {
          setSavedBundleSnapshot(currentBundleSnapshot);
          keepSaveLocked = true;
        } else if (submitIntent === 'productMedia' || submitIntent === 'full') {
          setSavedProductSnapshot(currentProductSnapshot);
          if (submitIntent === 'full') {
            setSavedVariantSnapshot(
              buildVariantSnapshot(rowsRef.current, removedVariantIdsRef.current),
            );
            setSavedBundleSnapshot(currentBundleSnapshot);
          }
          keepSaveLocked = true;
        }
        throw error;
      }
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Failed to save product. Please try again.';
      setSubmitError(message);
      if (isProductSubmit) {
        setProductProcessState('idle');
      }
    } finally {
      if (!keepSaveLocked) {
        setIsSubmittingProduct(false);
        setActiveSubmitIntent('');
        if (isProductSubmit && productProcessState !== 'created' && productProcessState !== 'saved') {
          setProductProcessState('idle');
        }
      }
    }
  }

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nativeEvent = event.nativeEvent as SubmitEvent;
    const submitter = nativeEvent.submitter as
      | HTMLButtonElement
      | HTMLInputElement
      | null;
    const formData = new FormData(event.currentTarget);
    if (submitter?.name) {
      formData.set(submitter.name, submitter.value);
    }
    void handleSubmit(formData);
  }

  return (
    <form
      onSubmit={handleFormSubmit}
      onPointerDownCapture={clearRowHighlights}
      className="space-y-6 pb-2"
    >
      {initialProduct.id && (
        <input type="hidden" name="productId" value={initialProduct.id} />
      )}
      {removedVariantIds.map((id) => (
        <input key={id} type="hidden" name="removeVariantIds" value={id} />
      ))}
      {removedSpecificationIds.map((id) => (
        <input key={id} type="hidden" name="removeSpecificationIds" value={id} />
      ))}
      {removedBundleOfferIds.map((id) => (
        <input key={id} type="hidden" name="removeBundleOfferIds" value={id} />
      ))}
      {removedImageIds.map((id) => (
        <input key={id} type="hidden" name="removeImageIds" value={id} />
      ))}
      {imageItems.map((item) => (
        <input
          key={getImageOrderKey(item)}
          type="hidden"
          name="imageOrder"
          value={getImageOrderKey(item)}
        />
      ))}
      {imageItems
        .filter((item): item is NewImageItem => item.type === 'new')
        .map((item) => (
          <input
            key={item.clientId}
            type="hidden"
            name="productImageClientIds"
            value={item.clientId}
          />
        ))}
      <input type="hidden" name="name" value={productName} />
      <input
        type="hidden"
        name="slug"
        value={buildProductSlug(productName, initialProduct.slug)}
      />
      <section className="space-y-4 border-b border-slate-200 pb-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-900">Product</h3>
          {productNavigation ? (
            <div className="flex items-center gap-2">
              <Link
                href="/admin/products/new"
                aria-label="Create new product"
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
              >
                <span>New</span>
                <span className="relative -top-px text-base leading-none">+</span>
              </Link>
              {productNavigation.previousId ? (
                <Link
                  href={`/admin/products/${productNavigation.previousId}/edit`}
                  aria-label="Previous product"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50"
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m12 5-5 5 5 5" />
                  </svg>
                </Link>
              ) : (
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-400">
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m12 5-5 5 5 5" />
                  </svg>
                </span>
              )}
              {productNavigation.nextId ? (
                <Link
                  href={`/admin/products/${productNavigation.nextId}/edit`}
                  aria-label="Next product"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50"
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m8 5 5 5-5 5" />
                  </svg>
                </Link>
              ) : (
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-400">
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m8 5 5 5-5 5" />
                  </svg>
                </span>
              )}
            </div>
          ) : null}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <fieldset
            disabled={isSubmittingProduct || !isProductEditorEnabled}
            className="space-y-0 disabled:opacity-70"
          >
          <input type="hidden" name="brandId" value={selectedBrandId} />
          <div className="grid gap-4 md:grid-cols-[minmax(220px,1fr)_140px]">
            <label className={labelClass}>
              <span className="flex items-center justify-between gap-3">
                <span>Product Title</span>
                <span
                  className={`text-xs font-semibold ${
                    productNameWordsLeft === 0
                      ? 'text-amber-600'
                      : 'text-slate-500'
                  }`}
                >
                  {productNameWordsLeft} words left
                </span>
              </span>
              <input
                name="name"
                required
                placeholder="Enter Product title 3-6 words max"
                value={productName}
                onChange={(event) =>
                  setProductName(limitProductNameWords(event.target.value))
                }
                className={fieldClass}
              />
            </label>

            <label className={`${labelClass} md:w-[140px]`}>
              <span>Status</span>
              <FormDropdown
                id="status"
                name="status"
                options={statusOptions}
                value={selectedStatus}
                onChange={(value) => {
                  const nextValue = value as ProductStatus;
                  setSelectedStatus(nextValue);
                  if (nextValue !== 'active') {
                    setActivationRequirements({
                      categories: false,
                      media: false,
                      variants: false,
                    });
                    if (submitError?.startsWith('Cannot save.')) {
                      setSubmitError(null);
                    }
                    return;
                  }

                  const missing = getActivationMissingRequirements();
                  setActivationRequirements(missing);
                  if (missing.categories || missing.media || missing.variants) {
                    setSubmitError(
                      'Cannot save yet. Complete required media, category, and variant fields highlighted below.',
                    );
                  } else {
                    setSubmitError(null);
                  }
                }}
              />
            </label>
          </div>

          <label className={`${labelClass} mt-4 block`}>
            <span>Brand</span>
            <select
              value={selectedBrandId}
              onChange={(event) => setSelectedBrandId(event.target.value)}
              className={`${fieldClass} h-11`}
            >
              <option value="">No brand selected</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </label>

          <label className={`${labelClass} mt-4 block`}>
            <span className="flex items-center justify-between gap-3">
              <span>Short Description</span>
              <span
                className={`text-xs font-semibold ${
                  shortDescriptionWordsLeft === 0
                    ? 'text-amber-600'
                    : 'text-slate-500'
                }`}
              >
                {shortDescriptionWordsLeft} words left
              </span>
            </span>
            <textarea
              ref={shortDescriptionRef}
              name="shortDescription"
              placeholder="Owala FreeSip Sway Insulated Stainless Steel Water Bottle with Two-Way Spout, Built-In Straw and Bucket Handle, Made for Travel, School, and Sports, 40oz, BPA Free, Leak Proof, Dreamy Field"
              value={shortDescription}
              rows={1}
              onChange={(event) => {
                setShortDescription(limitWords(event.target.value));
                requestAnimationFrame(resizeShortDescriptionField);
              }}
              className={`${fieldClass} min-h-10 resize-none overflow-hidden`}
            />
          </label>

          <div className="mt-4">
            <div className="space-y-3">
              {specifications.map((specification, index) => (
                <div
                  key={`${specification.id || 'new-spec'}-${index}`}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const sourceIndexRaw =
                      event.dataTransfer.getData('text/plain');
                    const sourceIndex = Number.parseInt(sourceIndexRaw, 10);
                    moveDraggedSpecification(
                      index,
                      Number.isNaN(sourceIndex) ? undefined : sourceIndex,
                    );
                  }}
                  onDragEnd={() => setDraggedSpecificationIndex(null)}
                  className="grid gap-3 md:grid-cols-[36px_minmax(0,0.9fr)_minmax(0,1.1fr)_40px]"
                >
                  <input
                    type="hidden"
                    name="specificationId"
                    value={specification.id}
                  />
                  <div className="flex items-end">
                    <button
                      type="button"
                      draggable
                      aria-label={`Drag specification ${index + 1}`}
                      onDragStart={(event) => {
                        setDraggedSpecificationIndex(index);
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/plain', String(index));
                      }}
                      onDragEnd={() => setDraggedSpecificationIndex(null)}
                      className="flex h-11 w-11 cursor-grab items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-50 active:cursor-grabbing"
                    >
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <circle cx="9" cy="6" r="1.2" />
                        <circle cx="15" cy="6" r="1.2" />
                        <circle cx="9" cy="12" r="1.2" />
                        <circle cx="15" cy="12" r="1.2" />
                        <circle cx="9" cy="18" r="1.2" />
                        <circle cx="15" cy="18" r="1.2" />
                      </svg>
                    </button>
                  </div>
                  <label className={`${compactLabelClass} mb-0`}>
                    <span>Spec Name</span>
                    <input
                      name="specificationName"
                      placeholder="Material"
                      value={specification.name}
                      onChange={(event) =>
                        updateSpecification(index, { name: event.target.value })
                      }
                      className={fieldClass}
                    />
                  </label>
                  <label className={`${compactLabelClass} mb-0`}>
                    <span>Spec Value</span>
                    <input
                      name="specificationValue"
                      placeholder="Stainless Steel"
                      value={specification.value}
                      onChange={(event) =>
                        updateSpecification(index, { value: event.target.value })
                      }
                      className={fieldClass}
                    />
                  </label>
                  <div className="flex items-end">
                    <button
                      type="button"
                      aria-label={`Remove specification ${index + 1}`}
                      onClick={() => removeSpecification(index)}
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-200 bg-white text-red-700 transition hover:bg-red-50"
                    >
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M3 6h18" />
                        <path d="M8 6V4h8v2" />
                        <path d="m19 6-1 14H6L5 6" />
                        <path d="M10 11v5" />
                        <path d="M14 11v5" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              aria-label="Add specification"
              onClick={() =>
                setSpecifications((current) => [...current, emptySpecification()])
              }
              className="mt-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700 shadow-sm transition hover:bg-blue-100"
            >
              <span className="relative -top-px text-2xl leading-none font-semibold">
                +
              </span>
            </button>
          </div>

          <label className={`${labelClass} mt-4 block`}>
            <span>Description</span>
            <textarea
              name="description"
              required
              value={description}
              rows={5}
              onChange={(event) => setDescription(event.target.value)}
              onPaste={(event) => {
                const pastedText = event.clipboardData.getData('text');
                if (!pastedText.includes('\n')) return;

                event.preventDefault();
                const target = event.currentTarget;
                const bulletText = formatDescriptionAsBullets(pastedText);
                const selectionStart = target.selectionStart ?? 0;
                const selectionEnd = target.selectionEnd ?? 0;
                const nextValue =
                  `${target.value.slice(0, selectionStart)}${bulletText}${target.value.slice(selectionEnd)}`;

                setDescription(nextValue);
                const nextCaretPosition = selectionStart + bulletText.length;
                requestAnimationFrame(() => {
                  target.setSelectionRange(nextCaretPosition, nextCaretPosition);
                });
              }}
            className={`${fieldClass} resize-y`}
          />
          </label>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className={labelClass}>
              <span>SEO Title</span>
              <input
                name="seoTitle"
                placeholder="Search title for product page"
                value={seoTitle}
                onChange={(event) => setSeoTitle(event.target.value)}
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              <span>SEO Description</span>
              <input
                name="seoDescription"
                placeholder="Search description summary"
                value={seoDescription}
                onChange={(event) => setSeoDescription(event.target.value)}
                className={fieldClass}
              />
            </label>
          </div>

          <p
            className={`mt-5 text-sm font-medium ${
              activationRequirements.media ? 'text-amber-700' : 'text-slate-900'
            }`}
          >
            Media
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Upload JPG/PNG/WEBP/AVIF. Keep each image under 4MB.
          </p>
          {activationRequirements.media ? (
            <p className="mt-1 text-xs font-semibold text-amber-700">
              At least one product image is required before saving.
            </p>
          ) : null}
          <input
            ref={imageInputRef}
            name="productImages"
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => handleImageSelection(event.target.files)}
            className="sr-only"
          />

          <div
            className={`mt-3 flex flex-wrap items-start gap-2 rounded-xl p-2 ${
              activationRequirements.media
                ? 'border border-amber-300 bg-amber-50/50'
                : ''
            }`}
          >
            {imageItems.map((image, index) => {
              const imageKey = getImageOrderKey(image);
              const imageUrl =
                image.type === 'existing' ? image.storagePath : image.previewUrl;
              const renamedImageName = `${imageNameBase}-${index + 1}${getFileExtension(
                image.type === 'existing' ? image.storagePath : image.file.name,
              )}`;
              const isFeatured = index === 0;

              return (
                <div
                  key={imageKey}
                  draggable
                  onDragStart={(event) => {
                    setDraggedImageKey(imageKey);
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', imageKey);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const sourceKey =
                      event.dataTransfer.getData('text/plain') || draggedImageKey;
                    if (!sourceKey || sourceKey === imageKey) return;
                    moveDraggedImage(imageKey, sourceKey);
                  }}
                  onDragEnd={() => setDraggedImageKey(null)}
                  className={`shrink-0 cursor-grab active:cursor-grabbing ${
                    isFeatured ? 'w-56' : 'w-[108px]'
                  }`}
                >
                  <div
                    className={`group relative overflow-hidden rounded-xl border border-slate-300 bg-slate-100 shadow-sm ${
                      isFeatured ? 'h-56 w-56' : 'h-[108px] w-[108px]'
                    }`}
                  >
                    <Image
                      src={imageUrl}
                      alt={renamedImageName}
                      fill
                      unoptimized
                      sizes={isFeatured ? '224px' : '108px'}
                      className="object-contain p-1"
                    />
                    <button
                      type="button"
                      aria-label="Remove image"
                      onClick={() => removeImage(image)}
                      className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-950/75 text-xs font-semibold text-white opacity-90 transition hover:bg-red-600"
                    >
                      X
                    </button>
                  </div>
                  <p
                    className="mt-1 truncate text-center text-[11px] font-medium text-slate-600"
                    title={renamedImageName}
                  >
                    {renamedImageName}
                  </p>
                </div>
              );
            })}

            {imageItems.length < MAX_PRODUCT_IMAGE_FILES && (
              <button
                type="button"
                aria-label="Add product images"
                onClick={() => imageInputRef.current?.click()}
                className="flex h-[108px] w-[108px] shrink-0 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-3xl font-light text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
              >
                +
              </button>
            )}
          </div>

          <div
            className={`mt-5 rounded-xl p-2 ${
              activationRequirements.categories
                ? 'border border-amber-300 bg-amber-50/50'
                : ''
            }`}
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <label
                htmlFor="categoryIds"
                className="text-sm font-medium text-slate-900"
              >
                Categories
              </label>
              {categories.length > 0 && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                  {categories.length} suggestions
                </span>
              )}
            </div>
            {activationRequirements.categories ? (
              <p className="mb-2 text-xs font-semibold text-amber-700">
                At least one category is required before saving.
              </p>
            ) : null}
            {selectedCategoryIds.map((categoryId) => (
              <input
                key={`selected-category-${categoryId}`}
                type="hidden"
                name="categoryIds"
                value={categoryId}
              />
            ))}
            <div className="relative" id="categoryIds" ref={categoryDropdownRef}>
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={isCategoryDropdownOpen}
                onClick={() =>
                  setIsCategoryDropdownOpen((current) => !current)
                }
                className={`h-11 w-full rounded-xl border bg-white px-3.5 py-2.5 pr-12 text-left text-sm outline-none transition ${
                  activationRequirements.categories
                    ? 'border-amber-300 text-slate-900 ring-2 ring-amber-100'
                    : isCategoryDropdownOpen
                      ? 'border-slate-500 text-slate-900 shadow-md ring-2 ring-slate-200'
                      : 'border-slate-300 text-slate-800'
                }`}
              >
                {selectedCategoryIds.length > 0
                  ? `${selectedCategoryIds.length} categories selected`
                  : 'Select categories'}
              </button>
              <SelectArrow />
              <AnimatePresence>
                {isCategoryDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.98 }}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 max-h-64 overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/70"
                    role="listbox"
                  >
                    {categories.map((category) => {
                      const checked = selectedCategoryIds.includes(category.id);

                      return (
                        <label
                          key={category.id}
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
                              setSelectedCategoryIds((current) =>
                                event.target.checked
                                  ? [...current, category.id]
                                  : current.filter((id) => id !== category.id),
                              );
                            }}
                            className="h-4 w-4 accent-blue-600"
                          />
                          <span className="truncate">{category.name}</span>
                        </label>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          </fieldset>
        </div>
      </section>

      <section className="space-y-4 border-b border-slate-200 pb-6">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Variants</h3>
          <p className="mt-1 text-sm text-slate-600">
            Add at least one variant with color name, color hex, and price. Removing a variant deactivates
            it safely, preserving order history and allowing future revival.
          </p>
        </div>

        <div
          className={`rounded-xl bg-white p-5 shadow-sm ${
            activationRequirements.variants
              ? 'border border-amber-300'
              : 'border border-slate-200'
          }`}
        >
          {activationRequirements.variants ? (
            <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
              At least one complete variant is required before saving.
            </p>
          ) : null}
          <fieldset
            disabled={isSubmittingProduct || !isVariantEditorEnabled}
            className="space-y-4 disabled:opacity-70"
          >
            {visibleVariantIndexes.map((index) => {
              const row = rows[index];
              if (!row) return null;
              const generatedSku = generateSku(productName, row.color, row.size);
              const isOpen = openVariantIndexes.has(index);

              return (
                <div
                  key={`${row.id || 'new'}-${index}`}
                  className={`rounded-xl border p-4 transition-all duration-700 ${
                    highlightedVariantIndex === index
                      ? 'border-blue-400 bg-blue-50 shadow-[0_0_0_4px_rgba(59,130,246,0.18)]'
                      : 'border-slate-200 bg-slate-50/70'
                  }`}
                >
                  <input type="hidden" name="variantId" value={row.id} />
                  <div
                    className="mb-4 flex cursor-pointer flex-wrap items-center justify-between gap-4"
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleVariantOpen(index)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        toggleVariantOpen(index);
                      }
                    }}
                    aria-label={isOpen ? `Collapse variant ${index + 1}` : `Expand variant ${index + 1}`}
                    aria-expanded={isOpen}
                  >
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-4">
                      <div className="inline-flex items-center gap-2">
                        {/* Reorder variants from the collapsible header without toggling it. */}
                        <button
                          type="button"
                          aria-label={`Move variant ${index + 1} up`}
                          onClick={(event) => {
                            event.stopPropagation();
                            moveRow(index, 'up');
                          }}
                          onMouseDown={(event) => event.stopPropagation()}
                          disabled={index === 0}
                          className={`flex h-7 w-7 items-center justify-center rounded-md border text-slate-700 transition ${
                            index === 0
                              ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                              : 'border-slate-300 bg-white hover:bg-slate-100'
                          }`}
                        >
                          <svg
                            className="h-4 w-4"
                            viewBox="0 0 20 20"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="m5 12 5-5 5 5" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          aria-label={`Move variant ${index + 1} down`}
                          onClick={(event) => {
                            event.stopPropagation();
                            moveRow(index, 'down');
                          }}
                          onMouseDown={(event) => event.stopPropagation()}
                          disabled={index === rows.length - 1}
                          className={`flex h-7 w-7 items-center justify-center rounded-md border text-slate-700 transition ${
                            index === rows.length - 1
                              ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                              : 'border-slate-300 bg-white hover:bg-slate-100'
                          }`}
                        >
                          <svg
                            className="h-4 w-4"
                            viewBox="0 0 20 20"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="m5 8 5 5 5-5" />
                          </svg>
                        </button>
                        <p className="inline-flex items-center self-center text-xs font-semibold uppercase leading-none tracking-wide text-slate-500">
                          Variant {index + 1}
                        </p>
                        <span className="text-slate-500" aria-hidden="true">
                          <svg
                            className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                            viewBox="0 0 20 20"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="m5 8 5 5 5-5" />
                          </svg>
                        </span>
                      </div>
                      <label className="mb-0 flex min-w-[260px] flex-1 items-center gap-2">
                        <span className="inline-flex shrink-0 items-center text-xs font-semibold leading-none text-slate-600">
                          SKU
                        </span>
                        <input
                          name="variantSku"
                          readOnly
                          value={generatedSku}
                          className={`${readOnlyFieldClass} min-w-[220px] max-w-[520px] flex-1`}
                        />
                      </label>
                      <label className="mb-0 flex min-w-[180px] max-w-[260px] flex-1 items-center gap-2">
                        <span className="shrink-0 text-xs font-semibold text-slate-600">
                          Image
                        </span>
                        <VariantImagePicker
                          name="variantImageSelection"
                          mediaOptions={getVariantMediaOptions()}
                          value={row.imageSelection}
                          onChange={(value) =>
                            updateRow(index, { imageSelection: value })
                          }
                        />
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="mb-0 flex h-11 items-center gap-2">
                        <input
                          type="hidden"
                          name="variantIsActive"
                          value={row.isActive ? 'true' : 'false'}
                        />
                        <span
                          className={`inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 ${
                            isSubmittingProduct || !isVariantEditorEnabled
                              ? 'cursor-not-allowed opacity-60'
                              : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={row.isActive}
                            disabled={isSubmittingProduct || !isVariantEditorEnabled}
                            onChange={(event) =>
                              updateRow(index, { isActive: event.target.checked })
                            }
                            className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-200"
                          />
                          <span>Active</span>
                        </span>
                      </label>
                      <button
                        type="button"
                        aria-label={`Add variant below ${index + 1}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          addRowBelow(index);
                        }}
                        onMouseDown={(event) => event.stopPropagation()}
                        className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700 transition hover:bg-blue-100"
                      >
                        <span className="relative -top-px text-2xl leading-none font-semibold">
                          +
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove variant ${index + 1}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          removeRow(index);
                        }}
                        onMouseDown={(event) => event.stopPropagation()}
                        className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-200 bg-white text-red-700 transition hover:bg-red-50"
                      >
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M3 6h18" />
                          <path d="M8 6V4h8v2" />
                          <path d="m19 6-1 14H6L5 6" />
                          <path d="M10 11v5" />
                          <path d="M14 11v5" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className={isOpen ? '' : 'hidden'}>
                  <div className="grid gap-3 md:grid-cols-[minmax(130px,0.9fr)_minmax(160px,1fr)_minmax(95px,0.65fr)] [&>label]:min-w-0">
                    <label className={compactLabelClass}>
                      <span>Color Name</span>
                      <input
                        name="variantColor"
                        value={row.color}
                        onChange={(event) =>
                          updateRow(index, { color: event.target.value })
                        }
                        className={fieldClass}
                      />
                    </label>
                    <label className={compactLabelClass}>
                      <span>Color Hex</span>
                      <div className="flex items-center gap-2">
                        <input
                          name="variantColorHex"
                          value={row.colorHex}
                          onChange={(event) =>
                            updateRow(index, { colorHex: event.target.value })
                          }
                          className={`${fieldClass} min-w-0 flex-1`}
                        />
                        <input
                          type="color"
                          aria-label={`Pick color hex for variant ${index + 1}`}
                          value={getColorPickerValue(row.colorHex)}
                          onChange={(event) =>
                            updateRow(index, { colorHex: event.target.value })
                          }
                          className="h-11 w-11 shrink-0 cursor-pointer border-[2.4px] border-slate-500 bg-white p-0 shadow-sm"
                        />
                      </div>
                    </label>
                    <label className={compactLabelClass}>
                      <span>Size</span>
                      <input
                        name="variantSize"
                        value={row.size}
                        onChange={(event) =>
                          updateRow(index, { size: event.target.value })
                        }
                        className={fieldClass}
                      />
                    </label>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className={compactLabelClass}>
                      <span>Price</span>
                      <input
                        name="variantPrice"
                        inputMode="decimal"
                        value={row.price}
                        onChange={(event) =>
                          updateRow(index, { price: event.target.value })
                        }
                        className={fieldClass}
                      />
                    </label>
                    <label className={compactLabelClass}>
                      <span>Compare</span>
                      <input
                        name="variantCompareAtPrice"
                        inputMode="decimal"
                        value={row.compareAtPrice}
                        onChange={(event) =>
                          updateRow(index, {
                            compareAtPrice: event.target.value,
                          })
                        }
                        className={fieldClass}
                      />
                    </label>
                  </div>
                  </div>
                </div>
              );
            })}
            {visibleVariantIndexes.length === 0 ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                No variants have been added yet.
              </p>
            ) : null}
          </fieldset>
        </div>
      </section>

      <section className="sticky bottom-0 z-30 border-t border-slate-200 bg-white/95 py-4 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            {productProcessMessage ? (
              <p className={`text-xs font-medium ${productProcessMessageClass}`}>
                {productProcessMessage}
              </p>
            ) : hasPendingFormChanges ? (
              <p className="text-xs font-medium text-slate-600">
                Unsaved changes
              </p>
            ) : null}
            {submitError ? (
              <p
                className={`mt-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                  isActivationReadinessError
                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                    : 'border-red-200 bg-red-50 text-red-700'
                }`}
              >
                {submitError}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <button
                type="button"
                disabled={isSubmittingProduct || !hasUnifiedChanges}
                onClick={() => {
                  resetProductSection();
                  setRows(initialVariantRows);
                  setOpenVariantIndexes(new Set([0]));
                  setRemovedVariantIds([]);
                }}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                  isSubmittingProduct || !hasUnifiedChanges
                    ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                Cancel
              </button>
            ) : (
              <Link
                href="/admin/products"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </Link>
            )}
            <button
              type="submit"
              name="submitIntent"
              value="full"
              disabled={isSubmittingProduct || !hasPendingFormChanges}
              className={`rounded-lg px-4 py-2 text-xs font-semibold text-white transition ${
                isSubmittingProduct || !hasPendingFormChanges
                  ? 'cursor-not-allowed bg-slate-300'
                  : 'bg-blue-700 hover:bg-blue-600'
              }`}
            >
              {isSubmittingProduct
                ? isEditing
                  ? 'Updating...'
                  : 'Creating...'
                : isEditing
                  ? 'Update Product'
                  : submitLabel}
            </button>
          </div>
        </div>
      </section>

      {/* Product-scoped bundle editor is temporarily hidden while global bundles are verified. */}
      {/* do not remove code block commented temporarily */}
      {SHOW_PRODUCT_BUNDLE_EDITOR ? (
      <section className="space-y-4 border-b border-slate-200 pb-6">
        <div>
          <h3 className="text-sm font-semibold text-amber-900">Bundles</h3>
          <p className="mt-1 text-sm text-slate-600">
            Create threshold-based discount bundles tied to saved variants.
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-amber-900">Bundle Offers</p>
            </div>
            {!isBundleSectionEnabled && (
              <p className="rounded-md border border-amber-200 bg-amber-100/70 px-2 py-1 text-xs font-semibold text-amber-900">
                Create variant to apply bundle
              </p>
            )}
            {isBundleSectionEnabled && !isBundleEditorEnabled && (
              <p className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">
                Another section has pending changes. Save or reset it first.
              </p>
            )}
            <fieldset
              disabled={isSubmittingProduct || !isBundleEditorEnabled}
              className="space-y-3 disabled:opacity-70"
            >
              {bundleOffers.map((offer, index) => {
                const isOpen = openBundleIndexes.has(index);
                const titlePercent = extractPercentFromBundleTitle(offer.title);
                const titleMinQty = extractMinQtyFromBundleTitle(offer.title);
                const configuredPercent = Number(offer.discountPercent);
                const configuredMinQty = Number(offer.minTotalQty);
                const hasConfiguredPercent =
                  offer.discountPercent.trim() !== '' &&
                  Number.isFinite(configuredPercent);
                const hasConfiguredMinQty =
                  offer.minTotalQty.trim() !== '' &&
                  Number.isFinite(configuredMinQty);
                const hasConflict =
                  titlePercent !== null &&
                  hasConfiguredPercent &&
                  Math.abs(titlePercent - configuredPercent) > 0.0001;
                const hasMinQtyConflict =
                  titleMinQty !== null &&
                  hasConfiguredMinQty &&
                  Math.abs(titleMinQty - configuredMinQty) > 0.0001;
                return (
                <div
                  key={`${offer.id || 'new-offer'}-${index}`}
                  className={`rounded-lg border p-3 transition-all duration-700 ${
                    highlightedBundleIndex === index
                      ? 'border-teal-400 bg-teal-50 shadow-[0_0_0_4px_rgba(20,184,166,0.22)]'
                      : 'border-amber-200 bg-white'
                  }`}
                >
                  <input type="hidden" name="bundleOfferId" value={offer.id} />
                  <input
                    type="hidden"
                    name="bundleOfferImageSelection"
                    value={offer.imageSelection}
                  />
                  <div
                    className="flex cursor-pointer items-center justify-between gap-3"
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleBundleOpen(index)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        toggleBundleOpen(index);
                      }
                    }}
                    aria-label={isOpen ? `Collapse bundle ${index + 1}` : `Expand bundle ${index + 1}`}
                    aria-expanded={isOpen}
                  >
                    <div className="inline-flex min-w-0 items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-900">
                      <span>Bundle {index + 1}</span>
                      <span className="max-w-[360px] truncate text-[11px] font-semibold normal-case tracking-normal text-amber-800/90">
                        {offer.title?.trim() || 'Untitled bundle'}
                      </span>
                      <span className="text-amber-900" aria-hidden="true">
                        <svg
                          className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                          viewBox="0 0 20 20"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="m5 8 5 5 5-5" />
                        </svg>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="mb-0 flex h-11 items-center gap-2">
                        <span className="shrink-0 text-xs font-semibold text-slate-600">
                          Active
                        </span>
                        <div className="w-[110px]">
                          <FormDropdown
                            id={`bundleIsActive-${index}`}
                            name="bundleOfferIsActive"
                            options={activeOptions}
                            value={offer.isActive ? 'true' : 'false'}
                            onChange={(value) =>
                              updateBundleOffer(index, { isActive: value === 'true' })
                            }
                          />
                        </div>
                      </label>
                      <button
                        type="button"
                        aria-label={`Add bundle below ${index + 1}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          addBundleOfferBelow(index);
                        }}
                        className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700 transition hover:bg-blue-100"
                      >
                        <span className="relative -top-px text-2xl leading-none font-semibold">
                          +
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove bundle offer ${index + 1}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          removeBundleOffer(index);
                        }}
                        className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-200 bg-white text-red-700 transition hover:bg-red-50"
                      >
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M3 6h18" />
                          <path d="M8 6V4h8v2" />
                          <path d="m19 6-1 14H6L5 6" />
                          <path d="M10 11v5" />
                          <path d="M14 11v5" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className={isOpen ? '' : 'hidden'}>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className={compactLabelClass}>
                      <span>Title</span>
                      <input
                        name="bundleOfferTitle"
                        value={offer.title}
                        onChange={(event) =>
                          updateBundleOffer(index, { title: event.target.value })
                        }
                        className={fieldClass}
                      />
                    </label>
                  <label className={compactLabelClass}>
                    <span>Eligible Variants</span>
                    <VariantMultiSelectDropdown
                      name="bundleOfferVariantSelection"
                      options={bundleVariantOptions}
                      value={offer.variantSelection}
                      onChange={(value) =>
                        updateBundleOffer(index, { variantSelection: value })
                      }
                    />
                    {offer.isActive && !offer.variantSelection.trim() ? (
                      <p className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-semibold text-red-700">
                        Pick at least one eligible variant before activating.
                      </p>
                    ) : null}
                  </label>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className={compactLabelClass}>
                        <span>Min Qty</span>
                        <input
                          name="bundleOfferMinTotalQty"
                          inputMode="numeric"
                          value={offer.minTotalQty}
                          onChange={(event) =>
                            updateBundleOffer(index, { minTotalQty: event.target.value })
                          }
                          className={fieldClass}
                        />
                      </label>
                      <label className={compactLabelClass}>
                        <span>Discount %</span>
                        <input
                          name="bundleOfferDiscountPercent"
                          inputMode="decimal"
                          value={offer.discountPercent}
                          onChange={(event) =>
                            updateBundleOffer(index, { discountPercent: event.target.value })
                          }
                          className={fieldClass}
                        />
                        {hasConflict ? (
                          <p className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800">
                            Warning: Title says {titlePercent}% but Discount % is{' '}
                            {configuredPercent}%.
                          </p>
                        ) : null}
                        {hasMinQtyConflict ? (
                          <p className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800">
                            Warning: Title says min qty {titleMinQty} but Min Qty is{' '}
                            {configuredMinQty}.
                          </p>
                        ) : null}
                      </label>
                    </div>
                  </div>
                  </div>
                </div>
                );
              })}
            </fieldset>
          </div>

          {isEditing && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  name="submitIntent"
                  value="bundleOffers"
                  disabled={
                    isSubmittingProduct || !isBundleEditorEnabled || !hasBundleChanges
                  }
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition ${
                    !isSubmittingProduct && isBundleEditorEnabled && hasBundleChanges
                      ? 'bg-amber-700 hover:bg-amber-600'
                      : 'cursor-not-allowed bg-slate-300'
                  }`}
                >
                  {isSubmittingProduct && activeSubmitIntent === 'bundleOffers'
                    ? 'Saving...'
                    : 'Save Bundles'}
                </button>
                <button
                  type="button"
                  disabled={
                    isSubmittingProduct || !isBundleEditorEnabled || !hasBundleChanges
                  }
                  onClick={resetBundleSection}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                    isSubmittingProduct || !isBundleEditorEnabled || !hasBundleChanges
                      ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                      : 'border-amber-300 bg-white text-amber-800 hover:bg-amber-100'
                  }`}
                >
                  Cancel
                </button>
              </div>
              {isSubmittingProduct && activeSubmitIntent === 'bundleOffers' ? (
                <p className="text-xs font-medium text-amber-900">
                  Bundle save in progress... please wait.
                </p>
              ) : null}
            </div>
          )}
        </div>
      </section>
      ) : null}

    </form>
  );
}

function VariantMultiSelectDropdown({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedValues = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const selectedSet = new Set(selectedValues);
  const allChecked =
    options.length > 0 && options.every((option) => selectedSet.has(option.value));
  const summary =
    selectedValues.length === 0
      ? 'Select variants'
      : `${selectedValues.length} selected`;

  return (
    <div className="relative">
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        onBlur={() => setTimeout(() => setIsOpen(false), 140)}
        className="flex h-11 w-full items-center justify-between rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 transition hover:border-slate-400"
      >
        <span className="truncate">{summary}</span>
        <span className="text-slate-500" aria-hidden="true">
          <svg
            className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m5 8 5 5 5-5" />
          </svg>
        </span>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 max-h-56 overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/70"
            role="listbox"
          >
            {options.length > 0 ? (
              <>
                <label className="mb-2 flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={(event) =>
                      onChange(
                        event.target.checked
                          ? options.map((option) => option.value).join(',')
                          : '',
                      )
                    }
                    className="h-3.5 w-3.5 accent-amber-600"
                  />
                  <span>Check all</span>
                </label>
                {options.map((option) => {
                  const checked = selectedSet.has(option.value);
                  return (
                    <label
                      key={option.value}
                      className="mb-1 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          const next = event.target.checked
                            ? [...selectedValues, option.value]
                            : selectedValues.filter((valueItem) => valueItem !== option.value);
                          onChange([...new Set(next)].join(','));
                        }}
                        className="h-3.5 w-3.5 accent-amber-600"
                      />
                      <span className="truncate">{option.label}</span>
                    </label>
                  );
                })}
              </>
            ) : (
              <p className="px-2 py-1 text-xs text-slate-500">No saved variants yet.</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

