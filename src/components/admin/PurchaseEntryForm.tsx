'use client';

import Image from 'next/image';
import type { FormEvent } from 'react';
import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAdminNavigationGuard } from '@/components/admin/AdminNavigationGuard';

type PurchaseVariantOption = {
  color: string | null;
  currentFifoCost: string | null;
  id: string;
  imagePath: string | null;
  productId: string;
  productImage: string | null;
  productName: string;
  size: string | null;
  sku: string;
  stockQuantity: number;
};

type PurchaseEntryFormProps = {
  discardDraftAction: (
    formData: FormData,
  ) => Promise<{ draftId?: string; error?: string; message?: string }>;
  initialDraft: PurchaseEntryDraft | null;
  recordAction: (
    previousState: { error?: string; message?: string },
    formData: FormData,
  ) => Promise<{ error?: string; message?: string }>;
  saveDraftAction: (
    formData: FormData,
  ) => Promise<{ draftId?: string; error?: string; message?: string }>;
  variants: PurchaseVariantOption[];
};

type DraftLine = {
  id: string;
  productId: string;
  quantity: string;
  unitCost: string;
  variantId: string;
};

type PurchaseEntryDraftLine = {
  id: string;
  productId: string | null;
  quantity: number;
  unitCost: string | null;
  variantId: string | null;
};

type PurchaseEntryDraft = {
  id: string;
  lines: PurchaseEntryDraftLine[];
  notes: string;
  purchaseDate: string;
  paymentMethod: string;
  paymentReference: string;
  paymentStatus: string;
  referenceNo: string;
  supplierName: string;
};

type ProductOption = {
  id: string;
  image: string | null;
  name: string;
  variantCount: number;
};

type DraftSnapshotInput = {
  lines: DraftLine[];
  notes: string;
  partialPaymentAmount: string;
  paymentMethod: string;
  paymentReference: string;
  paymentStatus: string;
  purchaseDate: string;
  referenceNo: string;
  supplierName: string;
};

type GuardActionResult = {
  error?: string;
  ok: boolean;
};

function getDefaultPurchaseDate() {
  return new Date().toISOString().slice(0, 10);
}

function newLine(productId = '', variantId = ''): DraftLine {
  return {
    id: crypto.randomUUID(),
    productId,
    quantity: '1',
    unitCost: '',
    variantId,
  };
}

function formatVariantLabel(variant: PurchaseVariantOption) {
  return [
    variant.color,
    variant.size,
    variant.sku,
  ]
    .filter(Boolean)
    .join(' / ');
}

function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      className="block h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </svg>
  );
}

function createDraftSnapshot({
  lines,
  notes,
  partialPaymentAmount,
  paymentMethod,
  paymentReference,
  paymentStatus,
  purchaseDate,
  referenceNo,
  supplierName,
}: DraftSnapshotInput) {
  return JSON.stringify({
    lines: lines.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      unitCost: line.unitCost,
      variantId: line.variantId,
    })),
    notes,
    partialPaymentAmount,
    paymentMethod,
    paymentReference,
    paymentStatus,
    purchaseDate,
    referenceNo,
    supplierName,
  });
}

export default function PurchaseEntryForm({
  discardDraftAction,
  initialDraft,
  recordAction,
  saveDraftAction,
  variants,
}: PurchaseEntryFormProps) {
  const defaultPurchaseDate = useMemo(() => getDefaultPurchaseDate(), []);
  const { registerNavigationGuard } = useAdminNavigationGuard();
  const initialLines = useMemo(
    () =>
      initialDraft?.lines.map((line) => ({
        id: line.id || crypto.randomUUID(),
        productId: line.productId ?? '',
        quantity: String(line.quantity || 1),
        unitCost: line.unitCost ?? '',
        variantId: line.variantId ?? '',
      })) ?? [],
    [initialDraft],
  );
  const emptyDraftSnapshot = useMemo(
    () =>
      createDraftSnapshot({
        lines: [],
        notes: '',
        partialPaymentAmount: '',
        paymentMethod: '',
        paymentReference: '',
        paymentStatus: 'due',
        purchaseDate: defaultPurchaseDate,
        referenceNo: '',
        supplierName: '',
      }),
    [defaultPurchaseDate],
  );
  const initialDraftSnapshot = useMemo(
    () =>
      createDraftSnapshot({
        lines: initialLines,
        notes: initialDraft?.notes ?? '',
        partialPaymentAmount: '',
        paymentMethod: initialDraft?.paymentMethod ?? '',
        paymentReference: initialDraft?.paymentReference ?? '',
        paymentStatus: initialDraft?.paymentStatus ?? 'due',
        purchaseDate: initialDraft?.purchaseDate ?? defaultPurchaseDate,
        referenceNo: initialDraft?.referenceNo ?? '',
        supplierName: initialDraft?.supplierName ?? '',
      }),
    [defaultPurchaseDate, initialDraft, initialLines],
  );
  const [state, formAction, isPending] = useActionState(recordAction, {});
  const [isDraftPending, setIsDraftPending] = useState(false);
  const [draftId, setDraftId] = useState(initialDraft?.id ?? '');
  const [lines, setLines] = useState<DraftLine[]>(() => initialLines);
  const [supplierName, setSupplierName] = useState(initialDraft?.supplierName ?? '');
  const [referenceNo, setReferenceNo] = useState(initialDraft?.referenceNo ?? '');
  const [purchaseDate, setPurchaseDate] = useState(
    initialDraft?.purchaseDate ?? defaultPurchaseDate,
  );
  const [paymentStatus, setPaymentStatus] = useState(
    initialDraft?.paymentStatus ?? 'due',
  );
  const [partialPaymentAmount, setPartialPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(
    initialDraft?.paymentMethod ?? '',
  );
  const [paymentReference, setPaymentReference] = useState(
    initialDraft?.paymentReference ?? '',
  );
  const [notes, setNotes] = useState(initialDraft?.notes ?? '');
  const [query, setQuery] = useState('');
  const [clientError, setClientError] = useState('');
  const [draftMessage, setDraftMessage] = useState(
    initialDraft ? 'Draft loaded' : '',
  );
  const [isProductListOpen, setIsProductListOpen] = useState(false);
  const [openVariantLineId, setOpenVariantLineId] = useState<string | null>(null);
  const [savedDraftSnapshot, setSavedDraftSnapshot] =
    useState(initialDraftSnapshot);
  const formRef = useRef<HTMLFormElement>(null);
  const draftRequestIdRef = useRef(0);
  const handledSuccessMessageRef = useRef('');
  const productSearchRef = useRef<HTMLDivElement>(null);

  const variantById = useMemo(
    () => new Map(variants.map((variant) => [variant.id, variant])),
    [variants],
  );
  const products = useMemo(() => {
    const productById = new Map<string, ProductOption>();
    for (const variant of variants) {
      const existing = productById.get(variant.productId);
      productById.set(variant.productId, {
        id: variant.productId,
        image: existing?.image ?? variant.productImage,
        name: variant.productName,
        variantCount: (existing?.variantCount ?? 0) + 1,
      });
    }
    return [...productById.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [variants]);
  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const variantsByProductId = useMemo(() => {
    const grouped = new Map<string, PurchaseVariantOption[]>();
    for (const variant of variants) {
      const productVariants = grouped.get(variant.productId) ?? [];
      productVariants.push(variant);
      grouped.set(variant.productId, productVariants);
    }
    return grouped;
  }, [variants]);
  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return products;

    return products.filter((product) =>
      product.name.toLowerCase().includes(normalized) ||
      variants.some(
        (variant) =>
          variant.productId === product.id &&
          [variant.sku, variant.color ?? '', variant.size ?? '']
            .join(' ')
            .toLowerCase()
            .includes(normalized),
      ),
    );
  }, [products, query, variants]);
  const totalQuantity = lines.reduce(
    (sum, line) => sum + (Number(line.quantity) || 0),
    0,
  );
  const totalCost = lines.reduce(
    (sum, line) =>
      sum + (Number(line.quantity) || 0) * (Number(line.unitCost) || 0),
    0,
  );
  const partialPaidAmount = Number(partialPaymentAmount) || 0;
  const payableAmount =
    paymentStatus === 'paid'
      ? 0
      : Math.max(
          0,
          totalCost - (paymentStatus === 'partial_paid' ? partialPaidAmount : 0),
        );
  const isPartialPaymentValid =
    paymentStatus !== 'partial_paid' ||
    (partialPaidAmount > 0 && partialPaidAmount < totalCost);
  const canSubmit = lines.every(
    (line) =>
      line.variantId &&
      Number.isInteger(Number(line.quantity)) &&
      Number(line.quantity) > 0 &&
      Number.isFinite(Number(line.unitCost)) &&
      Number(line.unitCost) > 0,
  );
  const canSave = lines.length > 0 && canSubmit;
  const canRecord =
    canSave &&
    (paymentStatus === 'due' || Boolean(paymentMethod)) &&
    isPartialPaymentValid;
  const hasDraftContent =
    lines.length > 0 ||
    supplierName.trim().length > 0 ||
    referenceNo.trim().length > 0 ||
    partialPaymentAmount.trim().length > 0 ||
    paymentMethod.trim().length > 0 ||
    paymentReference.trim().length > 0 ||
    paymentStatus !== 'due' ||
    notes.trim().length > 0 ||
    purchaseDate !== defaultPurchaseDate;
  const hasSaveableDraft = hasDraftContent || Boolean(draftId);
  const currentDraftSnapshot = useMemo(
    () =>
      createDraftSnapshot({
        lines,
        notes,
        partialPaymentAmount,
        paymentMethod,
        paymentReference,
        paymentStatus,
        purchaseDate,
        referenceNo,
        supplierName,
      }),
    [
      lines,
      notes,
      partialPaymentAmount,
      paymentMethod,
      paymentReference,
      paymentStatus,
      purchaseDate,
      referenceNo,
      supplierName,
    ],
  );
  const hasUnsavedDraftChanges = currentDraftSnapshot !== savedDraftSnapshot;
  const productLineGroups = useMemo(() => {
    const grouped = new Map<
      string,
      {
        lines: DraftLine[];
        product: ProductOption;
        variants: PurchaseVariantOption[];
      }
    >();

    for (const line of lines) {
      const productId = line.productId || variantById.get(line.variantId)?.productId || '';
      const product = productById.get(productId);
      if (!product) continue;

      const existing = grouped.get(productId);
      if (existing) {
        existing.lines.push(line);
      } else {
        grouped.set(productId, {
          lines: [line],
          product,
          variants: variantsByProductId.get(productId) ?? [],
        });
      }
    }

    return [...grouped.values()];
  }, [lines, productById, variantById, variantsByProductId]);

  const resetPurchaseEntryForm = useCallback(() => {
    formRef.current?.reset();
    setDraftId('');
    setLines([]);
    setSupplierName('');
    setReferenceNo('');
    setPurchaseDate(defaultPurchaseDate);
    setPaymentStatus('due');
    setPartialPaymentAmount('');
    setPaymentMethod('');
    setPaymentReference('');
    setNotes('');
    setQuery('');
    setDraftMessage('');
    setIsProductListOpen(false);
    setOpenVariantLineId(null);
    setClientError('');
    setSavedDraftSnapshot(emptyDraftSnapshot);
  }, [defaultPurchaseDate, emptyDraftSnapshot]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (
        productSearchRef.current &&
        !productSearchRef.current.contains(event.target as Node)
      ) {
        setIsProductListOpen(false);
      }
      if (
        event.target instanceof Element &&
        !event.target.closest('[data-variant-picker-root]')
      ) {
        setOpenVariantLineId(null);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const buildPurchaseFormData = useCallback(() => {
    const formData = new FormData();
    if (draftId) formData.set('purchaseEntryId', draftId);
    formData.set('supplierName', supplierName);
    formData.set('referenceNo', referenceNo);
    formData.set('purchaseDate', purchaseDate);
    formData.set('paymentStatus', paymentStatus);
    formData.set('partialPaymentAmount', partialPaymentAmount);
    formData.set('paymentMethod', paymentMethod);
    formData.set('paymentReference', paymentReference);
    formData.set('notes', notes);

    for (const line of lines) {
      formData.append('productId', line.productId);
      formData.append('variantId', line.variantId);
      formData.append('quantity', line.quantity);
      formData.append('unitCost', line.unitCost);
    }

    return formData;
  }, [
    draftId,
    lines,
    notes,
    partialPaymentAmount,
    paymentMethod,
    paymentReference,
    paymentStatus,
    purchaseDate,
    referenceNo,
    supplierName,
  ]);

  const saveDraft = useCallback(async (): Promise<GuardActionResult> => {
    if (!hasSaveableDraft) return { ok: true };

    const requestId = draftRequestIdRef.current + 1;
    draftRequestIdRef.current = requestId;
    const formData = buildPurchaseFormData();
    const snapshot = currentDraftSnapshot;

    setIsDraftPending(true);
    setDraftMessage('Saving draft...');

    try {
      const result = await saveDraftAction(formData);
      if (draftRequestIdRef.current !== requestId) {
        return { error: 'Another draft request is already in progress.', ok: false };
      }

      if (result.error) {
        setClientError(result.error);
        setDraftMessage('');
        return { error: result.error, ok: false };
      }

      if (result.draftId) setDraftId(result.draftId);
      setSavedDraftSnapshot(snapshot);
      setClientError('');
      setDraftMessage(result.message ?? 'Draft saved.');
      return { ok: true };
    } catch {
      if (draftRequestIdRef.current === requestId) {
        setClientError('Failed to save draft.');
        setDraftMessage('');
      }
      return { error: 'Failed to save draft.', ok: false };
    } finally {
      if (draftRequestIdRef.current === requestId) {
        setIsDraftPending(false);
      }
    }
  }, [
    buildPurchaseFormData,
    currentDraftSnapshot,
    hasSaveableDraft,
    saveDraftAction,
  ]);

  useEffect(() => {
    if (!state.message || handledSuccessMessageRef.current === state.message) return;

    handledSuccessMessageRef.current = state.message;
    const resetTimer = window.setTimeout(() => {
      resetPurchaseEntryForm();
    }, 0);

    return () => window.clearTimeout(resetTimer);
  }, [resetPurchaseEntryForm, state.message]);

  function updateLine(lineId: string, patch: Partial<DraftLine>) {
    setClientError('');
    setDraftMessage('');
    setLines((current) =>
      current.map((line) => (line.id === lineId ? { ...line, ...patch } : line)),
    );
  }

  function removeLine(lineId: string) {
    setClientError('');
    setDraftMessage('');
    setOpenVariantLineId((current) => (current === lineId ? null : current));
    setLines((current) => current.filter((line) => line.id !== lineId));
  }

  function selectProduct(product: ProductOption) {
    setClientError('');
    setDraftMessage('');
    setQuery(product.name);
    setIsProductListOpen(false);
    setLines((current) => {
      const hasProduct = current.some((line) => {
        const productId = line.productId || variantById.get(line.variantId)?.productId;
        return productId === product.id;
      });
      return hasProduct ? current : [...current, newLine(product.id)];
    });
  }

  function clearProductSearch() {
    setDraftMessage('');
    setQuery('');
    setIsProductListOpen(false);
  }

  const discardDraft = useCallback(async (): Promise<GuardActionResult> => {
    if (!draftId) {
      resetPurchaseEntryForm();
      setDraftMessage('Draft discarded.');
      return { ok: true };
    }

    const formData = new FormData();
    formData.set('purchaseEntryId', draftId);
    setIsDraftPending(true);
    setDraftMessage('Discarding draft...');

    try {
      const result = await discardDraftAction(formData);
      if (result.error) {
        setClientError(result.error);
        return { error: result.error, ok: false };
      }

      resetPurchaseEntryForm();
      setDraftMessage(result.message ?? 'Draft discarded.');
      return { ok: true };
    } catch {
      setClientError('Failed to discard draft.');
      return { error: 'Failed to discard draft.', ok: false };
    } finally {
      setIsDraftPending(false);
    }
  }, [discardDraftAction, draftId, resetPurchaseEntryForm]);

  function validateBeforeSubmit(event: FormEvent<HTMLFormElement>) {
    if (lines.length === 0) {
      event.preventDefault();
      setClientError('Add at least one purchase line.');
      return;
    }

    const invalidLineIndex = lines.findIndex(
      (line) =>
        !line.variantId ||
        !Number.isInteger(Number(line.quantity)) ||
        Number(line.quantity) <= 0 ||
        !Number.isFinite(Number(line.unitCost)) ||
        Number(line.unitCost) <= 0,
    );

    if (invalidLineIndex >= 0) {
      event.preventDefault();
      setClientError(
        `Line ${invalidLineIndex + 1}: variant, qty, and unit cost are required.`,
      );
      return;
    }

    if (paymentStatus !== 'due' && !paymentMethod) {
      event.preventDefault();
      setClientError('Payment method is required when payment is paid or partially paid.');
      return;
    }

    if (!isPartialPaymentValid) {
      event.preventDefault();
      setClientError('Partial payment must be greater than 0 and less than total cost.');
      return;
    }

    setClientError('');
  }

  useEffect(
    () =>
      registerNavigationGuard({
        discardLabel: 'Discard',
        message:
          'This purchase entry has unsaved changes. Save it as a draft or discard it before leaving.',
        onDiscard: discardDraft,
        onSave: saveDraft,
        saveLabel: 'Save as Draft',
        shouldBlock: () => hasUnsavedDraftChanges,
        stayLabel: 'Stay',
        title: 'Leave purchase entry?',
      }),
    [discardDraft, hasUnsavedDraftChanges, registerNavigationGuard, saveDraft],
  );

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={validateBeforeSubmit}
      className="space-y-5"
    >
      {draftId ? <input type="hidden" name="purchaseEntryId" value={draftId} /> : null}
      <div className="space-y-0">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-1.5 text-sm font-medium text-slate-700">
            <span>Supplier</span>
            <input
              name="supplierName"
              placeholder="Supplier name"
              value={supplierName}
              onChange={(event) => setSupplierName(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-300"
            />
          </label>
          <label className="space-y-1.5 text-sm font-medium text-slate-700">
            <span>Invoice / Reference</span>
            <input
              name="referenceNo"
              placeholder="Invoice no."
              value={referenceNo}
              onChange={(event) => setReferenceNo(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-300"
            />
          </label>
          <label className="space-y-1.5 text-sm font-medium text-slate-700">
            <span>Purchase Date</span>
            <input
              name="purchaseDate"
              type="date"
              value={purchaseDate}
              onChange={(event) => setPurchaseDate(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-blue-300"
            />
          </label>
        </div>

        <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50/70 p-2 md:grid-cols-[150px_150px_minmax(160px,1fr)_150px_150px] md:items-end">
          <label className="min-w-0 space-y-0.5 text-[11px] font-semibold text-slate-600">
            <span>Payment</span>
            <select
              name="paymentStatus"
              value={paymentStatus}
              onChange={(event) => {
                const nextStatus = event.target.value;
                setPaymentStatus(nextStatus);
                if (nextStatus !== 'partial_paid') setPartialPaymentAmount('');
              }}
              className="h-8 w-full rounded-lg border border-slate-300 bg-white px-1.5 py-0 text-[12px] leading-4 text-slate-900 outline-none transition focus:border-blue-300"
            >
              <option value="due">Due</option>
              <option value="partial_paid">Partially Paid</option>
              <option value="paid">Paid</option>
            </select>
          </label>
          <label className="min-w-0 space-y-0.5 text-[11px] font-semibold text-slate-600">
            <span>Method</span>
            <select
              name="paymentMethod"
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
              className="h-8 w-full rounded-lg border border-slate-300 bg-white px-1.5 py-0 text-[12px] leading-4 text-slate-900 outline-none transition focus:border-blue-300"
            >
              <option value="">Method</option>
              <option value="cash">Cash</option>
              <option value="bank">Bank</option>
              <option value="bkash">bKash</option>
            </select>
          </label>
          <label className="min-w-0 space-y-0.5 text-[11px] font-semibold text-slate-600">
            <span>Reference</span>
            <input
              name="paymentReference"
              placeholder="Txn / cheque ref"
              value={paymentReference}
              onChange={(event) => setPaymentReference(event.target.value)}
              className="h-8 w-full rounded-lg border border-slate-300 bg-white px-1.5 py-0 text-[12px] leading-4 text-slate-900 outline-none transition focus:border-blue-300"
            />
          </label>
          {paymentStatus === 'partial_paid' ? (
            <label className="min-w-0 space-y-0.5 text-[11px] font-semibold text-slate-600">
              <span>Paid Amount</span>
              <input
                name="partialPaymentAmount"
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                value={partialPaymentAmount}
                onChange={(event) => setPartialPaymentAmount(event.target.value)}
                className="h-8 w-full rounded-lg border border-slate-300 bg-white px-1.5 py-0 text-[12px] leading-4 text-slate-900 outline-none transition focus:border-blue-300"
              />
            </label>
          ) : (
            <input type="hidden" name="partialPaymentAmount" value="" />
          )}
          <div className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Payable
            </p>
            <p className="truncate text-sm font-bold text-slate-900">
              {payableAmount.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div
          ref={productSearchRef}
          className="sticky top-20 z-40 -mx-3 mb-4 rounded-xl border border-blue-200 bg-white p-3 shadow-lg shadow-slate-200/80 ring-1 ring-blue-100/80"
        >
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setIsProductListOpen(true);
            }}
            onFocus={() => setIsProductListOpen(true)}
            onClick={() => setIsProductListOpen(true)}
            placeholder="Search product"
            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 pr-10 text-sm outline-none transition focus:border-blue-300"
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear product search"
              onClick={clearProductSearch}
              className="absolute right-5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            >
              X
            </button>
          ) : null}
          {isProductListOpen ? (
            <div className="absolute left-3 right-3 top-[calc(100%+6px)] z-20 max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
              {filteredProducts.length > 0 ? (
                filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => selectProduct(product)}
                    className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition hover:bg-blue-50"
                  >
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                      {product.image ? (
                        <Image
                          src={product.image}
                          alt={product.name}
                          width={48}
                          height={48}
                          unoptimized
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full bg-slate-100" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {product.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {product.variantCount} variant{product.variantCount === 1 ? '' : 's'}
                      </p>
                    </div>
                  </button>
                ))
              ) : (
                <p className="px-3 py-4 text-sm font-medium text-slate-500">
                  No products found.
                </p>
              )}
            </div>
          ) : null}
        </div>

        {productLineGroups.length > 0 ? (
          <div className="space-y-3">
            {productLineGroups.map((group) => {
              const selectedVariantIds = new Set(
                lines.map((line) => line.variantId).filter(Boolean),
              );
              const nextVariant = group.variants.find(
                (variant) => !selectedVariantIds.has(variant.id),
              );
              const hasOpenVariantSlot = group.lines.some((line) => !line.variantId);

              return (
                <section
                  key={group.product.id}
                  className="rounded-xl border border-slate-200 bg-white p-3"
                >
                  <div className="mb-3 flex min-w-0 items-center gap-3">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                      {group.product.image ? (
                        <Image
                          src={group.product.image}
                          alt={group.product.name}
                          width={48}
                          height={48}
                          unoptimized
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full bg-slate-100" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {group.product.name}
                      </p>
                      <p className="text-xs font-medium text-slate-500">
                        {group.lines.length} selected / {group.product.variantCount} variant
                        {group.product.variantCount === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {group.lines.map((line, index) => {
                      const selectedVariant = variantById.get(line.variantId);
                      const selectedVariantIdsForLine = new Set(
                        lines
                          .filter((candidate) => candidate.id !== line.id)
                          .map((candidate) => candidate.variantId)
                          .filter(Boolean),
                      );
                      const availableVariants = group.variants.filter(
                        (variant) =>
                          variant.id === line.variantId ||
                          !selectedVariantIdsForLine.has(variant.id),
                      );

                      return (
                        <div
                          key={line.id}
                          className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                        >
                          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_110px_150px_150px_44px] md:items-start">
                          <div
                            data-variant-picker-root
                            className="relative space-y-1.5 text-xs font-semibold text-slate-600"
                          >
                            <span>Variant {index + 1}</span>
                            <input type="hidden" name="productId" value={line.productId} />
                            <input type="hidden" name="variantId" value={line.variantId} />
                            <button
                              type="button"
                              disabled={group.variants.length === 0}
                              onClick={() =>
                                setOpenVariantLineId((current) =>
                                  current === line.id ? null : line.id,
                                )
                              }
                              className="flex h-11 w-full items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-left text-sm font-normal text-slate-900 outline-none transition focus:border-blue-300 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                            >
                              {selectedVariant?.imagePath ? (
                                <Image
                                  src={selectedVariant.imagePath}
                                  alt={formatVariantLabel(selectedVariant)}
                                  width={28}
                                  height={28}
                                  unoptimized
                                  className="h-7 w-7 rounded-md object-cover"
                                />
                              ) : null}
                              <span className="truncate">
                                {selectedVariant
                                  ? formatVariantLabel(selectedVariant)
                                  : 'Select variant'}
                              </span>
                            </button>
                            {openVariantLineId === line.id ? (
                              <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 max-h-64 overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                                {availableVariants.length > 0 ? (
                                  availableVariants.map((variant) => (
                                    <button
                                      key={variant.id}
                                      type="button"
                                      onClick={() => {
                                        updateLine(line.id, {
                                          productId: variant.productId,
                                          variantId: variant.id,
                                        });
                                        setOpenVariantLineId(null);
                                      }}
                                      className="group relative flex w-full items-center gap-2 rounded-lg p-2 text-left transition hover:bg-blue-50"
                                    >
                                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                                        {variant.imagePath ? (
                                          <Image
                                            src={variant.imagePath}
                                            alt={formatVariantLabel(variant)}
                                            width={40}
                                            height={40}
                                            unoptimized
                                            className="h-full w-full object-cover"
                                          />
                                        ) : (
                                          <div className="h-full w-full bg-slate-100" />
                                        )}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="truncate text-xs font-semibold text-slate-800">
                                          {formatVariantLabel(variant)}
                                        </p>
                                        <p className="text-[11px] font-medium text-slate-500">
                                          Stock {variant.stockQuantity}
                                        </p>
                                      </div>
                                      {variant.imagePath ? (
                                        <div className="pointer-events-none absolute left-12 top-2 z-30 hidden h-32 w-32 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl group-hover:block">
                                          <Image
                                            src={variant.imagePath}
                                            alt={formatVariantLabel(variant)}
                                            fill
                                            unoptimized
                                            sizes="128px"
                                            className="object-cover"
                                          />
                                        </div>
                                      ) : null}
                                    </button>
                                  ))
                                ) : (
                                  <p className="px-3 py-4 text-sm font-medium text-slate-500">
                                    No more variants available for this product.
                                  </p>
                                )}
                              </div>
                            ) : null}
                          </div>
                          <label className="mb-0 space-y-1.5 text-xs font-semibold text-slate-600">
                            <span>Stock</span>
                            <input
                              readOnly
                              value={selectedVariant?.stockQuantity ?? ''}
                              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm font-semibold text-slate-700 outline-none"
                            />
                          </label>
                          <label className="mb-0 space-y-1.5 text-xs font-semibold text-slate-600">
                            <span>Qty</span>
                            <input
                              name="quantity"
                              type="number"
                              min={1}
                              required
                              value={line.quantity}
                              onChange={(event) =>
                                updateLine(line.id, { quantity: event.target.value })
                              }
                              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition focus:border-blue-300"
                            />
                          </label>
                          <label className="mb-0 space-y-1.5 text-xs font-semibold text-slate-600">
                            <span>Unit Cost</span>
                            <input
                              name="unitCost"
                              type="number"
                              min={0.01}
                              step="0.01"
                              required
                              value={line.unitCost}
                              onChange={(event) =>
                                updateLine(line.id, { unitCost: event.target.value })
                              }
                              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition focus:border-blue-300"
                            />
                          </label>
                          <button
                            type="button"
                            aria-label={`Remove ${group.product.name} variant ${index + 1}`}
                            onClick={() => removeLine(line.id)}
                            className="flex h-11 w-11 shrink-0 items-center justify-center justify-self-end self-end rounded-xl border border-rose-200 bg-rose-50 text-rose-600 transition hover:bg-rose-100 hover:text-rose-700"
                          >
                            <TrashIcon />
                          </button>
                          </div>
                          {selectedVariant ? (
                            <div className="mt-1.5 text-[11px] font-medium text-slate-500">
                              {selectedVariant.currentFifoCost
                                ? `FIFO cost ${selectedVariant.currentFifoCost}`
                                : 'No FIFO batch yet'}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      disabled={hasOpenVariantSlot || !nextVariant}
                      onClick={() =>
                        setLines((current) => [
                          ...current,
                          newLine(group.product.id),
                        ])
                      }
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Add Variant
                    </button>
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm font-medium text-slate-500">
            Select a product to add purchase variants.
          </div>
        )}
      </div>

      <label className="block space-y-1.5 text-sm font-medium text-slate-700">
        <span>Notes</span>
        <textarea
          name="notes"
          rows={3}
          placeholder="Optional purchase note"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-300"
        />
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="text-sm text-slate-600">
          <span className="font-semibold text-slate-900">{totalQuantity}</span> units /
          <span className="ml-1 font-semibold text-slate-900">
            {totalCost.toFixed(2)}
          </span>{' '}
          total cost
          {draftMessage ? (
            <span className="ml-2 text-xs font-semibold text-emerald-700">
              {draftMessage}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasSaveableDraft ? (
            <button
              type="button"
              onClick={() => {
                void discardDraft();
              }}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Discard Draft
            </button>
          ) : null}
          <button
            type="button"
            disabled={!hasSaveableDraft || isDraftPending || isPending}
            onClick={() => {
              void saveDraft();
            }}
            className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
          >
            {isDraftPending ? 'Saving Draft...' : 'Save Draft'}
          </button>
          <button
            type="submit"
            disabled={!canRecord || isPending || isDraftPending}
            className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isPending ? 'Recording...' : 'Submit Record'}
          </button>
        </div>
      </div>

      {clientError || state.error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {clientError || state.error}
        </p>
      ) : null}
      {state.message ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
