'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ProductStatus } from '@prisma/client';

type CategoryOption = {
  id: string;
  name: string;
};

type VariantFormRow = {
  id: string;
  sku: string;
  color: string;
  imageSelection: string;
  size: string;
  price: string;
  compareAtPrice: string;
  costPrice: string;
  stockQuantity: string;
  reorderLevel: string;
  isActive: boolean;
};

type SpecificationFormRow = {
  id: string;
  name: string;
  value: string;
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
  status: ProductStatus;
  categoryIds: string[];
  specifications: SpecificationFormRow[];
  variants: VariantFormRow[];
};

type ProductFormProps = {
  action: (formData: FormData) => void;
  categories: CategoryOption[];
  product?: ProductFormValue;
  submitLabel: string;
};

const statuses: ProductStatus[] = ['draft', 'active', 'archived'];
const PRODUCT_NAME_WORD_LIMIT = 6;
const SHORT_DESCRIPTION_WORD_LIMIT = 40;
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
  label: string;
  previewUrl: string;
  value: string;
};

const emptyVariant = (): VariantFormRow => ({
  id: '',
  sku: '',
  color: '',
  imageSelection: '',
  size: '',
  price: '',
  compareAtPrice: '',
  costPrice: '',
  stockQuantity: '0',
  reorderLevel: '10',
  isActive: true,
});

const emptySpecification = (): SpecificationFormRow => ({
  id: '',
  name: '',
  value: '',
});

function getInitialProduct(product: ProductFormValue | undefined): ProductFormValue {
  return (
    product ?? {
      name: '',
      slug: '',
      images: [],
      shortDescription: '',
      description: '',
      status: 'draft',
      categoryIds: [],
      specifications: [emptySpecification()],
      variants: [emptyVariant()],
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

function getProductInitials(name: string) {
  const initials = name
    .trim()
    .toUpperCase()
    .match(/[A-Z0-9]+/g)
    ?.map((part) => part[0])
    .join('');

  return initials || 'PRODUCT';
}

function generateSku(name: string, color: string, size: string) {
  return [
    getProductInitials(name),
    normalizeSkuPart(color),
    normalizeSkuPart(size),
  ]
    .filter(Boolean)
    .join('-');
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

function getImageOrderKey(item: ProductImageItem) {
  return item.type === 'existing'
    ? `existing:${item.id}`
    : `new:${item.clientId}`;
}

function formatDescriptionAsBullets(value: string) {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-*\u2022]\s+/, ''))
    .filter(Boolean);

  if (lines.length === 0) return value;

  return lines.map((line) => `\u2022 ${line}`).join('\n');
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const nextItems = [...items];
  const [item] = nextItems.splice(fromIndex, 1);
  if (!item) return items;
  nextItems.splice(toIndex, 0, item);
  return nextItems;
}

function SelectArrow() {
  return (
    <span className="pointer-events-none absolute inset-y-0 right-3 flex flex-col items-center justify-center text-slate-500">
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
  id,
  label,
  name,
  onChange,
  options,
  value,
}: {
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
        onClick={() => setIsOpen((current) => !current)}
        onBlur={() => setTimeout(() => setIsOpen(false), 120)}
        className={`h-11 w-full rounded-xl border bg-white px-3.5 py-2.5 pr-11 text-left text-sm outline-none transition ${
          isOpen
            ? 'border-slate-500 text-slate-900 shadow-md ring-2 ring-slate-200'
            : 'border-slate-300 text-slate-800'
        }`}
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
  const selectedOption = mediaOptions.find((option) => option.value === value);

  return (
    <div className="relative">
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        onBlur={() => setTimeout(() => setIsOpen(false), 120)}
        className="flex h-11 w-full items-center gap-2 rounded-xl border border-slate-300 bg-white px-2.5 text-slate-700 transition hover:border-slate-400"
      >
        {selectedOption ? (
          <>
            <span className="relative block h-7 w-7 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
              <Image
                src={selectedOption.previewUrl}
                alt={selectedOption.label}
                fill
                unoptimized
                sizes="28px"
                className="object-contain p-0.5"
              />
            </span>
            <span className="min-w-0 text-left text-xs font-semibold text-slate-600">
              Change
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
            className="absolute left-0 top-[calc(100%+8px)] z-20 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-xl shadow-slate-200/70"
            role="listbox"
          >
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                role="option"
                aria-selected={value === ''}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange('');
                  setIsOpen(false);
                }}
                className={`flex aspect-square items-center justify-center rounded-xl border text-xl font-semibold transition ${
                  value === ''
                    ? 'border-slate-900 bg-slate-100 text-slate-900'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-slate-100'
                }`}
              >
                +
              </button>
              {mediaOptions.map((option) => (
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
                  className={`relative aspect-square overflow-hidden rounded-xl border transition ${
                    value === option.value
                      ? 'border-slate-900 bg-slate-100'
                      : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100'
                  }`}
                  title={option.label}
                >
                  <Image
                    src={option.previewUrl}
                    alt={option.label}
                    fill
                    unoptimized
                    sizes="56px"
                    className="object-contain p-1"
                  />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ProductForm({
  action,
  categories,
  product,
  submitLabel,
}: ProductFormProps) {
  const initialProduct = useMemo(() => getInitialProduct(product), [product]);
  const [productName, setProductName] = useState(initialProduct.name);
  const [shortDescription, setShortDescription] = useState(
    initialProduct.shortDescription,
  );
  const [description, setDescription] = useState(initialProduct.description);
  const shortDescriptionRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const [specifications, setSpecifications] = useState(
    initialProduct.specifications.length > 0
      ? initialProduct.specifications
      : [emptySpecification()],
  );
  const [removedSpecificationIds, setRemovedSpecificationIds] = useState<string[]>([]);
  const [rows, setRows] = useState(initialProduct.variants);
  const [removedVariantIds, setRemovedVariantIds] = useState<string[]>([]);
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
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([]);
  const [draggedImageKey, setDraggedImageKey] = useState<string | null>(null);
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
        rows: rows.map((row) => ({
          color: row.color,
          compareAtPrice: row.compareAtPrice,
          costPrice: row.costPrice,
          id: row.id,
          imageSelection: row.imageSelection,
          isActive: row.isActive,
          price: row.price,
          reorderLevel: row.reorderLevel,
          size: row.size,
          stockQuantity: row.stockQuantity,
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
      imageItems,
      productName,
      removedImageIds,
      removedSpecificationIds,
      removedVariantIds,
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
        images: initialProduct.images.map((image) => ({
          key: `existing:${image.id}`,
        })),
        productName: initialProduct.name,
        removedImageIds: [],
        removedSpecificationIds: [],
        removedVariantIds: [],
        rows: initialProduct.variants.map((row) => ({
          color: row.color,
          compareAtPrice: row.compareAtPrice,
          costPrice: row.costPrice,
          id: row.id,
          imageSelection: row.imageSelection,
          isActive: row.isActive,
          price: row.price,
          reorderLevel: row.reorderLevel,
          size: row.size,
          stockQuantity: row.stockQuantity,
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
    [initialProduct],
  );
  const hasChanges = currentSnapshot !== initialSnapshot;

  useEffect(() => {
    imageItemsRef.current = imageItems;
  }, [imageItems]);

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
        setRemovedVariantIds((ids) => [...ids, row.id]);
      }

      const nextRows = current.filter((_, rowIndex) => rowIndex !== index);
      return nextRows.length > 0 ? nextRows : [emptyVariant()];
    });
  }

  function removeSpecification(index: number) {
    setSpecifications((current) => {
      const specification = current[index];
      if (specification?.id) {
        setRemovedSpecificationIds((ids) => [...ids, specification.id]);
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
    const nextItems: NewImageItem[] = Array.from(files ?? []).map((file) => ({
      clientId: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      type: 'new',
    }));

    setImageItems((current) => [...current, ...nextItems]);
  }

  function removeImage(item: ProductImageItem) {
    const imageKey = getImageOrderKey(item);
    if (item.type === 'existing') {
      setRemovedImageIds((ids) => [...ids, item.id]);
    } else {
      URL.revokeObjectURL(item.previewUrl);
    }

    setRows((current) =>
      current.map((row) =>
        row.imageSelection === imageKey
          ? { ...row, imageSelection: '' }
          : row,
      ),
    );

    setImageItems((current) =>
      current.filter((currentItem) => getImageOrderKey(currentItem) !== imageKey),
    );
  }

  function moveDraggedImage(targetKey: string) {
    if (!draggedImageKey || draggedImageKey === targetKey) return;

    setImageItems((current) => {
      const fromIndex = current.findIndex(
        (item) => getImageOrderKey(item) === draggedImageKey,
      );
      const toIndex = current.findIndex(
        (item) => getImageOrderKey(item) === targetKey,
      );

      if (fromIndex < 0 || toIndex < 0) return current;
      return moveItem(current, fromIndex, toIndex);
    });

    setDraggedImageKey(null);
  }

  return (
    <form action={action} className="space-y-6 pb-2">
      {initialProduct.id && (
        <input type="hidden" name="productId" value={initialProduct.id} />
      )}
      {removedVariantIds.map((id) => (
        <input key={id} type="hidden" name="removeVariantIds" value={id} />
      ))}
      {removedSpecificationIds.map((id) => (
        <input key={id} type="hidden" name="removeSpecificationIds" value={id} />
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

      <section className="space-y-4 border-b border-slate-200 pb-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
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
                placeholder="brand? 1 + name 2- 3 + size? 1"
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
                onChange={(value) => setSelectedStatus(value as ProductStatus)}
              />
            </label>
          </div>

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
                  className="grid gap-3 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_40px]"
                >
                  <input
                    type="hidden"
                    name="specificationId"
                    value={specification.id}
                  />
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
        </div>
      </section>

      <section className="space-y-4 border-b border-slate-200 pb-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-900">Media</p>
          <input
            ref={imageInputRef}
            name="productImages"
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => handleImageSelection(event.target.files)}
            className="sr-only"
          />

          <div className="mt-3 flex flex-wrap items-start gap-2">
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
                  onDragStart={() => setDraggedImageKey(imageKey)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => moveDraggedImage(imageKey)}
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

            <button
              type="button"
              aria-label="Add product images"
              onClick={() => imageInputRef.current?.click()}
              className="flex h-[108px] w-[108px] shrink-0 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-3xl font-light text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
            >
              +
            </button>
          </div>

          <div className="mt-5">
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
                className={`h-11 w-full rounded-xl border bg-white px-3.5 py-2.5 pr-11 text-left text-sm outline-none transition ${
                  isCategoryDropdownOpen
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
        </div>
      </section>

      <section className="space-y-4 border-b border-slate-200 pb-6">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Variants</h3>
          <p className="mt-1 text-sm text-slate-600">
            Each product needs at least one variant for stock and order entry.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="space-y-4">
            {rows.map((row, index) => {
              const generatedSku = generateSku(productName, row.color, row.size);

              return (
                <div
                  key={`${row.id || 'new'}-${index}`}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"
                >
                  <input type="hidden" name="variantId" value={row.id} />
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-4">
                      <p className="inline-flex items-center self-center text-xs font-semibold uppercase leading-none tracking-wide text-slate-500">
                        Variant {index + 1}
                      </p>
                      <label className="mb-0 inline-flex items-center gap-2">
                        <span className="inline-flex shrink-0 items-center text-xs font-semibold leading-none text-slate-600">
                          SKU
                        </span>
                        <input
                          name="variantSku"
                          readOnly
                          value={generatedSku}
                          className={`${readOnlyFieldClass} w-[220px]`}
                        />
                      </label>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="mb-0 flex h-11 items-center gap-2">
                        <span className="shrink-0 text-xs font-semibold text-slate-600">
                          Status
                        </span>
                        <div className="w-[110px]">
                          <FormDropdown
                            id={`variantIsActive-${index}`}
                            name="variantIsActive"
                            options={activeOptions}
                            value={row.isActive ? 'true' : 'false'}
                            onChange={(value) =>
                              updateRow(index, { isActive: value === 'true' })
                            }
                          />
                        </div>
                      </label>
                      <button
                        type="button"
                        aria-label={`Remove variant ${index + 1}`}
                        onClick={() => removeRow(index)}
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

                  <div className="grid gap-3 md:grid-cols-[minmax(150px,0.95fr)_minmax(150px,1fr)_minmax(120px,0.8fr)_minmax(110px,0.75fr)_minmax(120px,0.85fr)]">
                    <label className={compactLabelClass}>
                      <span>Image</span>
                      <VariantImagePicker
                        name="variantImageSelection"
                        mediaOptions={mediaOptions}
                        value={row.imageSelection}
                        onChange={(value) =>
                          updateRow(index, { imageSelection: value })
                        }
                      />
                    </label>
                    <label className={compactLabelClass}>
                      <span>Color</span>
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
                    <label className={compactLabelClass}>
                      <span>Stock</span>
                      <input
                        name="variantStockQuantity"
                        required
                        inputMode="numeric"
                        value={row.stockQuantity}
                        onChange={(event) =>
                          updateRow(index, {
                            stockQuantity: event.target.value,
                          })
                        }
                        className={fieldClass}
                      />
                    </label>
                    <label className={compactLabelClass}>
                      <span>Reorder Level</span>
                      <input
                        name="variantReorderLevel"
                        required
                        inputMode="numeric"
                        value={row.reorderLevel}
                        onChange={(event) =>
                          updateRow(index, {
                            reorderLevel: event.target.value,
                          })
                        }
                        className={fieldClass}
                      />
                    </label>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <label className={compactLabelClass}>
                      <span>Price</span>
                      <input
                        name="variantPrice"
                        required
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
                    <label className={compactLabelClass}>
                      <span>Cost</span>
                      <input
                        name="variantCostPrice"
                        inputMode="decimal"
                        value={row.costPrice}
                        onChange={(event) =>
                          updateRow(index, { costPrice: event.target.value })
                        }
                        className={fieldClass}
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            aria-label="Add variant"
            onClick={() =>
              setRows((current) => {
                const lastRow = current[current.length - 1] ?? emptyVariant();
                return [
                  ...current,
                  {
                    ...lastRow,
                    id: '',
                    sku: '',
                  },
                ];
              })
            }
            className="mt-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700 shadow-sm transition hover:bg-blue-100"
          >
            <span className="relative -top-px text-2xl leading-none font-semibold">
              +
            </span>
          </button>
        </div>
      </section>

      <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 px-5 py-4 shadow-lg shadow-slate-200/70 backdrop-blur">
        <button
          type="submit"
          disabled={!hasChanges}
          className={`rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition ${
            hasChanges
              ? 'bg-blue-700 text-white hover:bg-blue-600'
              : 'cursor-not-allowed bg-slate-200 text-slate-500 shadow-none'
          }`}
        >
          {submitLabel}
        </button>
        <Link
          href="/admin/products"
          className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold !text-red-700 shadow-sm transition hover:bg-red-50 hover:!text-red-700"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
