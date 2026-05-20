'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useEffect } from 'react';
import {
  processOrderRefundAction,
  processOrderReturnAction,
  updateOrderDetailsAction,
} from '@/app/(admin)/admin/orders/[id]/actions';
import { computeCartPricing } from '@/lib/cart-bundle-pricing';
import { getGroupedAreaOptions, getGroupedDistrictOptions } from '@/lib/location-presenter';
import { getAllowedNextSalesOrderStatuses } from '@/lib/sales-order-status';
import SearchableDropdown from '@/components/SearchableDropdown';
import SafeImage from '@/components/SafeImage';

type EditableOrderItem = {
  id: string;
  productId: string;
  variantId: string;
  productName: string;
  variantLabel: string;
  imagePath: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  lineTotal: number;
  bundleRule?: string | null;
  appliedBundleTitle?: string;
  activeBundleOffers?: Array<{
    id: string;
    title: string;
    minTotalQty: number;
    discountPercent: number;
    variantIds: string[];
    variantMatch: boolean;
    eligibleQty: number;
    triggered: boolean;
  }>;
};

type EditableOrder = {
  id: string;
  updatedAt: string;
  orderStatus: string;
  paymentMethod: string;
  paymentStatus: string;
  firstName: string;
  lastName: string;
  phone: string;
  receiverPhone: string;
  email: string;
  division: string;
  district: string;
  thana: string;
  address: string;
  notes: string;
  noteHistory: Array<{
    id: string;
    kind: 'event' | 'note';
    note: string;
    createdByName: string;
    createdAt: string;
  }>;
  subtotalAmount: number;
  discountAmount: number;
  orderLevelDiscount: number;
  deliveryCharge: number;
  totalAmount: number;
  paidAmount: number;
  returns: Array<{
    id: string;
    reason: string;
    refundAmount: number;
    refundMethod: string;
    refundReferenceNote: string;
    createdByName: string;
    createdAt: string;
    lines: Array<{
      id: string;
      orderProductId: string;
      quantity: number;
      restocked: boolean;
    }>;
  }>;
  variantCatalog: Array<{
    variantId: string;
    productId: string;
    productName: string;
    variantLabel: string;
    sku: string;
    unitPrice: number;
    imagePath: string;
  }>;
  items: EditableOrderItem[];
};

type OrderDetailsEditorProps = {
  initialOrder: EditableOrder;
};

type ReturnDraftLine = {
  orderProductId: string;
  quantity: number;
  restock: boolean;
  restockOnly?: boolean;
};

const ORDER_STATUS_OPTIONS = [
  { value: 'pending', label: 'Unfulfilled' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'processing', label: 'Processing' },
  { value: 'onHold', label: 'On Hold' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'returned', label: 'Return' },
  { value: 'cancelled', label: 'Cancelled' },
];

function formatMoney(value: number) {
  return `Tk ${value.toLocaleString('en-BD', { maximumFractionDigits: 0 })}`;
}

function formatRefundMethod(value: string) {
  if (value === 'NAGAD') return 'Nagad';
  if (value === 'BKASH') return 'bKash';
  if (value === 'BANK') return 'Bank';
  return value;
}

function PencilIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`h-4 w-4 transition-transform ${open ? 'rotate-90' : ''}`}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function formatNoteDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-BD', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

function formatTimelineActor(name: string) {
  return `@${name.trim() || 'Admin'}`;
}

function sanitizeNumberInput(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
}

function sanitizeWholeNumberInput(value: string) {
  return Math.floor(sanitizeNumberInput(value));
}

function recomputeBundleDiscounts(items: EditableOrderItem[]) {
  const lines = items.map((item) => ({
    id: item.id,
    productId: item.productId,
    variantId: item.variantId,
    quantity: Math.max(1, Math.floor(item.quantity)),
    unitPrice: Math.max(0, item.unitPrice),
  }));
  const offersByProductId = new Map<
    string,
    Array<{
      id: string;
      title: string;
      minTotalQty: number;
      discountPercent: number;
      variantIds: string[];
      isActive: boolean;
    }>
  >();

  for (const item of items) {
    const offers = (item.activeBundleOffers ?? []).map((offer) => ({
      id: offer.id,
      title: offer.title,
      minTotalQty: offer.minTotalQty,
      discountPercent: offer.discountPercent,
      variantIds: offer.variantIds,
      isActive: true,
    }));
    const current = offersByProductId.get(item.productId) ?? [];
    const next = [...current];
    for (const offer of offers) {
      if (!next.some((entry) => entry.id === offer.id)) next.push(offer);
    }
    offersByProductId.set(item.productId, next);
  }

  const pricing = computeCartPricing(lines, (productId) => offersByProductId.get(productId) ?? []);
  return items.map((item) => ({
    ...item,
    discountAmount: Math.max(0, pricing.linePricingById[item.id]?.lineDiscount ?? 0),
    lineTotal: Math.max(
      0,
      pricing.linePricingById[item.id]?.lineTotal ??
        item.quantity * item.unitPrice,
    ),
    appliedBundleTitle: pricing.linePricingById[item.id]?.bundleTitle,
  }));
}

export default function OrderDetailsEditor({ initialOrder }: OrderDetailsEditorProps) {
  const [isEditingAll, setIsEditingAll] = useState(false);
  const [isEditingCustomerOnly, setIsEditingCustomerOnly] = useState(false);
  const [isEditingItemsOnly, setIsEditingItemsOnly] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [statusChangeNote, setStatusChangeNote] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [activeRefundId, setActiveRefundId] = useState<string | null>(null);
  const [refundPaymentMethod, setRefundPaymentMethod] = useState('BKASH');
  const [refundReferenceNote, setRefundReferenceNote] = useState('');
  const [returnLines, setReturnLines] = useState<ReturnDraftLine[]>([]);
  const [order, setOrder] = useState(initialOrder);
  const [draft, setDraft] = useState(initialOrder);
  const [orderDiscountType, setOrderDiscountType] = useState<'amount' | 'percent'>('amount');
  const [orderDiscountInput, setOrderDiscountInput] = useState(
    initialOrder.orderLevelDiscount.toString(),
  );
  const [selectedVariantIdsToAdd, setSelectedVariantIdsToAdd] = useState<string[]>([]);
  const [isAddItemDropdownOpen, setIsAddItemDropdownOpen] = useState(false);
  const [addItemSearch, setAddItemSearch] = useState('');
  const [expandedAddItemProductId, setExpandedAddItemProductId] = useState<string | null>(null);
  const [isCustomerCardOpen, setIsCustomerCardOpen] = useState(false);
  const [locationDistricts, setLocationDistricts] = useState<string[]>([]);
  const [locationThanas, setLocationThanas] = useState<string[]>([]);
  const addItemDropdownRef = useRef<HTMLDivElement | null>(null);
  const isItemsEditing = isEditingAll || isEditingItemsOnly;
  const isCustomerEditing = isEditingAll || isEditingCustomerOnly;
  const isAnyEditing = isEditingAll || isEditingCustomerOnly || isEditingItemsOnly;
  const isFulfillmentLocked =
    order.orderStatus === 'shipped' || order.orderStatus === 'delivered';

  const previewSubtotal = useMemo(
    () => draft.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    [draft.items],
  );
  const previewDiscount = useMemo(
    () => draft.items.reduce((sum, item) => sum + item.discountAmount, 0),
    [draft.items],
  );
  const parsedDiscountInput = Math.max(0, sanitizeNumberInput(orderDiscountInput));
  const computedOrderLevelDiscount =
    orderDiscountType === 'percent'
      ? Math.min(previewSubtotal, (previewSubtotal * parsedDiscountInput) / 100)
      : parsedDiscountInput;
  const previewTotalDiscount = previewDiscount + Math.max(0, computedOrderLevelDiscount);
  const previewTotal = Math.max(0, previewSubtotal - previewTotalDiscount + draft.deliveryCharge);
  const previewPaid = Math.min(Math.max(0, draft.paidAmount), previewTotal);
  const previewBalance = Math.max(0, previewTotal - previewPaid);
  const addItemProducts = useMemo(() => {
    const grouped = new Map<
      string,
      {
        productId: string;
        productName: string;
        variants: EditableOrder['variantCatalog'];
        thumbnail: string;
      }
    >();
    for (const entry of order.variantCatalog) {
      const current = grouped.get(entry.productId) ?? {
        productId: entry.productId,
        productName: entry.productName,
        variants: [],
        thumbnail: '',
      };
      current.variants.push(entry);
      if (!current.thumbnail && entry.imagePath) {
        current.thumbnail = entry.imagePath;
      }
      grouped.set(entry.productId, current);
    }
    const search = addItemSearch.trim().toLowerCase();
    const products = [...grouped.values()].sort((a, b) =>
      a.productName.localeCompare(b.productName),
    );
    if (!search) return products;
    return products.filter((product) =>
      product.productName.toLowerCase().includes(search),
    );
  }, [addItemSearch, order.variantCatalog]);
  const bundlePreviewByItemId = useMemo(() => {
    const lines = draft.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      quantity: Math.max(1, Math.floor(item.quantity)),
      unitPrice: Math.max(0, item.unitPrice),
    }));
    const offersByProductId = new Map<
      string,
      Array<{
        id: string;
        title: string;
        minTotalQty: number;
        discountPercent: number;
        variantIds: string[];
        isActive: boolean;
      }>
    >();
    for (const item of draft.items) {
      const offers = (item.activeBundleOffers ?? []).map((offer) => ({
        id: offer.id,
        title: offer.title,
        minTotalQty: offer.minTotalQty,
        discountPercent: offer.discountPercent,
        variantIds: offer.variantIds,
        isActive: true,
      }));
      const current = offersByProductId.get(item.productId) ?? [];
      const next = [...current];
      for (const offer of offers) {
        if (!next.some((entry) => entry.id === offer.id)) {
          next.push(offer);
        }
      }
      offersByProductId.set(item.productId, next);
    }
    const pricing = computeCartPricing(lines, (productId) => offersByProductId.get(productId) ?? []);

    const eligibleQtyByOfferId = new Map<string, number>();
    for (const line of lines) {
      const offers = offersByProductId.get(line.productId) ?? [];
      for (const offer of offers) {
        const variantMatch =
          offer.variantIds.includes(line.variantId);
        if (!variantMatch) continue;
        eligibleQtyByOfferId.set(
          offer.id,
          (eligibleQtyByOfferId.get(offer.id) ?? 0) + line.quantity,
        );
      }
    }

    const byItemId = new Map<
      string,
      {
        appliedBundleTitle?: string;
        activeBundleOffers: Array<{
          id: string;
          title: string;
          minTotalQty: number;
          discountPercent: number;
          variantIds: string[];
          variantMatch: boolean;
          eligibleQty: number;
          triggered: boolean;
        }>;
      }
    >();
    for (const item of draft.items) {
      const offers = (offersByProductId.get(item.productId) ?? []).map((offer) => {
        const variantMatch =
          offer.variantIds.includes(item.variantId);
        const eligibleQty = eligibleQtyByOfferId.get(offer.id) ?? 0;
        return {
          id: offer.id,
          title: offer.title,
          minTotalQty: offer.minTotalQty,
          discountPercent: offer.discountPercent,
          variantIds: offer.variantIds,
          variantMatch,
          eligibleQty,
          triggered: eligibleQty >= offer.minTotalQty,
        };
      });
      byItemId.set(item.id, {
        appliedBundleTitle: pricing.linePricingById[item.id]?.bundleTitle,
        activeBundleOffers: offers,
      });
    }
    return byItemId;
  }, [draft.items]);
  const hasUnsavedChanges = useMemo(
    () =>
      JSON.stringify({
        orderStatus: draft.orderStatus,
        paymentMethod: draft.paymentMethod,
        paymentStatus: draft.paymentStatus,
        firstName: draft.firstName,
        lastName: draft.lastName,
        phone: draft.phone,
        receiverPhone: draft.receiverPhone,
        email: draft.email,
        division: draft.division,
        district: draft.district,
        thana: draft.thana,
        address: draft.address,
        notes: draft.notes,
        noteHistory: draft.noteHistory.map((entry) => ({
          id: entry.id,
          kind: entry.kind,
          note: entry.note,
          createdAt: entry.createdAt,
        })),
        paidAmount: draft.paidAmount,
        orderLevelDiscount: Math.max(0, computedOrderLevelDiscount),
        items: draft.items.map((item) => ({
          id: item.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountAmount: item.discountAmount,
        })),
      }) !==
      JSON.stringify({
        orderStatus: order.orderStatus,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        firstName: order.firstName,
        lastName: order.lastName,
        phone: order.phone,
        receiverPhone: order.receiverPhone,
        email: order.email,
        division: order.division,
        district: order.district,
        thana: order.thana,
        address: order.address,
        notes: order.notes,
        noteHistory: order.noteHistory.map((entry) => ({
          id: entry.id,
          kind: entry.kind,
          note: entry.note,
          createdAt: entry.createdAt,
        })),
        paidAmount: order.paidAmount,
        orderLevelDiscount: order.orderLevelDiscount,
        items: order.items.map((item) => ({
          id: item.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountAmount: item.discountAmount,
        })),
      }),
    [computedOrderLevelDiscount, draft, order],
  );
  const hasStatusChanges =
    draft.paymentMethod !== order.paymentMethod ||
    draft.paymentStatus !== order.paymentStatus ||
    draft.orderStatus !== order.orderStatus;
  const hasOrderStatusChange = draft.orderStatus !== order.orderStatus;
  const isDraftingReturnStatus =
    hasOrderStatusChange && draft.orderStatus === 'returned';
  const hasPendingNote = draft.notes.trim().length > 0;
  const allowedOrderStatuses = new Set([
    order.orderStatus,
    ...getAllowedNextSalesOrderStatuses(order.orderStatus),
  ]);
  const returnedQuantityByItemId = useMemo(() => {
    const returned = new Map<string, number>();
    for (const orderReturn of order.returns) {
      for (const line of orderReturn.lines) {
        returned.set(
          line.orderProductId,
          (returned.get(line.orderProductId) ?? 0) + line.quantity,
        );
      }
    }
    return returned;
  }, [order.returns]);
  const totalOrderedQuantity = order.items.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );
  const totalReturnedQuantity = [...returnedQuantityByItemId.values()].reduce(
    (sum, quantity) => sum + quantity,
    0,
  );
  const hasPartialReturn =
    totalReturnedQuantity > 0 && totalReturnedQuantity < totalOrderedQuantity;
  const orderStatusOptions = ORDER_STATUS_OPTIONS.filter((option) =>
    allowedOrderStatuses.has(option.value as never),
  ).map((option) =>
    hasPartialReturn && option.value === order.orderStatus
      ? { ...option, label: 'Partial return' }
      : option,
  );
  const pendingRestockQuantityByItemId = useMemo(() => {
    const pendingRestock = new Map<string, number>();
    for (const orderReturn of order.returns) {
      for (const line of orderReturn.lines) {
        if (line.restocked) continue;
        pendingRestock.set(
          line.orderProductId,
          (pendingRestock.get(line.orderProductId) ?? 0) + line.quantity,
        );
      }
    }
    return pendingRestock;
  }, [order.returns]);
  const isReturnEligible =
    order.orderStatus === 'shipped' ||
    order.orderStatus === 'delivered' ||
    order.orderStatus === 'returned';
  const returnableItems = order.items.map((item) => ({
    ...item,
    returnedQuantity: returnedQuantityByItemId.get(item.id) ?? 0,
    returnableQuantity: Math.max(
      0,
      item.quantity - (returnedQuantityByItemId.get(item.id) ?? 0),
    ),
    pendingRestockQuantity: pendingRestockQuantityByItemId.get(item.id) ?? 0,
  }));
  const hasReturnableItems = returnableItems.some((item) => item.returnableQuantity > 0);
  const hasPendingRestockItems = returnableItems.some(
    (item) => item.pendingRestockQuantity > 0,
  );
  const calculatedReturnRefundAmount = returnLines.reduce((sum, line) => {
    if (line.restockOnly) return sum;
    const item = returnableItems.find(
      (returnableItem) => returnableItem.id === line.orderProductId,
    );
    const refundableUnitPrice = item ? item.lineTotal / item.quantity : 0;
    return sum + refundableUnitPrice * line.quantity;
  }, 0);
  const refundableReturnAmount = Math.max(0, calculatedReturnRefundAmount);
  const pendingRefunds = order.returns.filter(
    (orderReturn) => orderReturn.refundAmount > 0 && !orderReturn.refundMethod,
  );
  const activeRefund =
    order.returns.find((orderReturn) => orderReturn.id === activeRefundId) ??
    pendingRefunds[0] ??
    null;
  const returnUnavailableMessage = !isReturnEligible
    ? 'Refunds can be processed after the order is shipped or delivered.'
    : !hasReturnableItems && !hasPendingRestockItems
      ? 'All order item quantities have already been returned and restocked.'
      : '';
  const groupedLocationThanas = getGroupedAreaOptions(
    draft.division,
    draft.district,
    locationThanas,
  );
  const groupedLocationDistricts = getGroupedDistrictOptions(locationDistricts);

  useEffect(() => {
    function handleEditRequest(event: Event) {
      const customEvent = event as CustomEvent<{ orderId?: string }>;
      if (!customEvent.detail?.orderId || customEvent.detail.orderId !== order.id) return;
      if (isFulfillmentLocked) return;
      setIsEditingAll(true);
      setIsEditingCustomerOnly(false);
      setIsEditingItemsOnly(false);
      document.getElementById('order-items-section')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }

    window.addEventListener('admin-order-edit-request', handleEditRequest as EventListener);
    return () => {
      window.removeEventListener(
        'admin-order-edit-request',
        handleEditRequest as EventListener,
      );
    };
  }, [isFulfillmentLocked, order.id]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('admin-order-dirty', {
        detail: { dirty: hasUnsavedChanges },
      }),
    );
  }, [hasUnsavedChanges]);

  useEffect(() => {
    function handleOutsidePointerDown(event: MouseEvent) {
      if (!isAddItemDropdownOpen) return;
      const target = event.target as Node | null;
      if (!target) return;
      if (addItemDropdownRef.current?.contains(target)) return;
      setIsAddItemDropdownOpen(false);
    }

    document.addEventListener('mousedown', handleOutsidePointerDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsidePointerDown);
    };
  }, [isAddItemDropdownOpen]);

  useEffect(() => {
    async function loadDistricts() {
      try {
        const response = await fetch('/api/delivery-locations?type=districts');
        const payload = (await response.json()) as { items?: string[] };
        setLocationDistricts(payload.items ?? []);
      } catch {
        setLocationDistricts([]);
      }
    }
    void loadDistricts();
  }, []);

  useEffect(() => {
    async function loadThanas() {
      if (!draft.district) {
        setLocationThanas([]);
        return;
      }
      try {
        const query = new URLSearchParams({
          type: 'areas',
          district: draft.district,
        });
        const response = await fetch(`/api/delivery-locations?${query.toString()}`);
        const payload = (await response.json()) as { items?: string[] };
        setLocationThanas(payload.items ?? []);
      } catch {
        setLocationThanas([]);
      }
    }
    void loadThanas();
  }, [draft.district]);

  useEffect(() => {
    let isMounted = true;

    if (!draft.district) return () => {
      isMounted = false;
    };

    async function resolveDivision() {
      try {
        const query = new URLSearchParams({
          type: 'division',
          district: draft.district,
        });
        const response = await fetch(`/api/delivery-locations?${query.toString()}`);
        if (!response.ok) return;
        const payload = (await response.json()) as { division?: string };
        if (!isMounted) return;
        setDraft((current) =>
          current.district === draft.district
            ? {
                ...current,
                division: payload.division?.trim() ? payload.division : current.division,
              }
            : current,
        );
      } catch {
        // Saving also resolves division server-side; keep the editor usable if lookup fails.
      }
    }

    void resolveDivision();

    return () => {
      isMounted = false;
    };
  }, [draft.district]);

  function handleCustomerDistrictSelect(district: string) {
    setDraft((prev) => ({
      ...prev,
      division: '',
      district,
      thana: '',
    }));
  }

  function toggleVariantSelection(variantId: string) {
    setSelectedVariantIdsToAdd((current) =>
      current.includes(variantId)
        ? current.filter((id) => id !== variantId)
        : [...current, variantId],
    );
  }

  function handleCancel() {
    setDraft(order);
    setOrderDiscountType('amount');
    setOrderDiscountInput(order.orderLevelDiscount.toString());
    setStatusChangeNote('');
    setError('');
    setIsEditingAll(false);
    setIsEditingCustomerOnly(false);
    setIsEditingItemsOnly(false);
  }

  function handleStatusCancel() {
    setDraft((prev) => ({
      ...prev,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus,
    }));
    setStatusChangeNote('');
    setReturnLines([]);
    setReturnReason('');
    setError('');
  }

  function handleNoteCancel() {
    setDraft((prev) => ({ ...prev, notes: '' }));
    setError('');
  }

  function handleUpdate() {
    if (isDraftingReturnStatus) {
      handleProcessReturn();
      return;
    }

    const isLockedStatusOnlyUpdate =
      isFulfillmentLocked &&
      allowedOrderStatuses.has(draft.orderStatus as never) &&
      draft.orderStatus !== order.orderStatus &&
      draft.paymentMethod === order.paymentMethod &&
      draft.paymentStatus === order.paymentStatus;
    if (isFulfillmentLocked && !isLockedStatusOnlyUpdate) {
      setError('Shipped or delivered orders can only update to the next allowed status.');
      setIsEditingAll(false);
      setIsEditingCustomerOnly(false);
      setIsEditingItemsOnly(false);
      return;
    }
    setError('');
    startTransition(async () => {
      try {
        const pendingStatusNote = hasOrderStatusChange ? statusChangeNote.trim() : '';
        const pendingTimelineNote = draft.notes.trim();
        const updateNote = [pendingStatusNote, pendingTimelineNote]
          .filter(Boolean)
          .join('\n\n');
        const updated = await updateOrderDetailsAction(order.id, {
          expectedUpdatedAt: order.updatedAt,
          orderStatus: draft.orderStatus,
          paymentMethod: draft.paymentMethod,
          paymentStatus: draft.paymentStatus,
          firstName: draft.firstName,
          lastName: draft.lastName,
          phone: draft.phone,
          receiverPhone: draft.receiverPhone.trim() || draft.phone.trim(),
          email: draft.email,
          division: draft.division,
          district: draft.district,
          thana: draft.thana,
          address: draft.address,
          notes: updateNote,
          orderLevelDiscount: Math.max(0, computedOrderLevelDiscount),
          paidAmount: Math.max(0, draft.paidAmount),
          items: draft.items.map((item) => ({
            id: item.id,
            productId: item.productId,
            variantId: item.variantId,
            quantity: Math.max(1, Math.floor(item.quantity)),
            unitPrice: Math.max(0, item.unitPrice),
            discountAmount: Math.max(0, item.discountAmount),
          })),
        });
        const next: EditableOrder = {
          ...draft,
          ...updated,
        };
        setOrder(next);
        setDraft(next);
        setOrderDiscountType('amount');
        setOrderDiscountInput(next.orderLevelDiscount.toString());
        setIsEditingAll(false);
        setIsEditingCustomerOnly(false);
        setIsEditingItemsOnly(false);
        setStatusChangeNote('');
      } catch (actionError) {
        setError(
          actionError instanceof Error
            ? actionError.message
            : 'Unable to update order right now.',
        );
      }
    });
  }

  function handleAddItem() {
    if (selectedVariantIdsToAdd.length === 0 || !isItemsEditing) return;
    const selectedVariants = order.variantCatalog.filter((entry) =>
      selectedVariantIdsToAdd.includes(entry.variantId),
    );
    if (selectedVariants.length === 0) return;
    setDraft((prev) => {
      const nextItems = [...prev.items];
      for (const selected of selectedVariants) {
        const existingIndex = nextItems.findIndex(
          (item) => item.variantId === selected.variantId,
        );
        if (existingIndex >= 0) {
          const existing = nextItems[existingIndex];
          nextItems[existingIndex] = {
            ...existing,
            quantity: existing.quantity + 1,
          };
        } else {
          nextItems.push({
            id: `new:${selected.variantId}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
            productId: selected.productId,
            variantId: selected.variantId,
            productName: selected.productName,
            variantLabel: selected.variantLabel,
            imagePath: selected.imagePath,
            quantity: 1,
            unitPrice: selected.unitPrice,
            discountAmount: 0,
            lineTotal: selected.unitPrice,
          });
        }
      }
      return { ...prev, items: recomputeBundleDiscounts(nextItems) };
    });
    setSelectedVariantIdsToAdd([]);
    setIsAddItemDropdownOpen(false);
    setAddItemSearch('');
    setExpandedAddItemProductId(null);
  }

  function handleRemoveItem(itemId: string) {
    if (!isItemsEditing) return;
    setDraft((prev) => {
      const nextItems = prev.items.filter((item) => item.id !== itemId);
      if (nextItems.length === 0) return prev;
      return { ...prev, items: recomputeBundleDiscounts(nextItems) };
    });
  }

  function updateReturnLine(
    orderProductId: string,
    nextQuantity: number,
    returnableQuantity: number,
  ) {
    const quantity = Math.max(0, Math.min(returnableQuantity, Math.floor(nextQuantity)));
    setReturnLines((current) => {
      const existing = current.find(
        (line) => line.orderProductId === orderProductId && !line.restockOnly,
      );
      if (quantity <= 0) {
        return current.filter(
          (line) => line.orderProductId !== orderProductId || line.restockOnly,
        );
      }
      if (!existing) {
        return [...current, { orderProductId, quantity, restock: false }];
      }
      return current.map((line) =>
        line.orderProductId === orderProductId && !line.restockOnly
          ? { ...line, quantity }
          : line,
      );
    });
  }

  function updateReturnRestock(orderProductId: string, restock: boolean) {
    setReturnLines((current) =>
      current.map((line) =>
        line.orderProductId === orderProductId && !line.restockOnly
          ? { ...line, restock }
          : line,
      ),
    );
  }

  function updatePendingRestockLine(
    orderProductId: string,
    quantity: number,
    restock: boolean,
  ) {
    setReturnLines((current) => {
      const next = current.filter(
        (line) => line.orderProductId !== orderProductId || !line.restockOnly,
      );
      return restock
        ? [...next, { orderProductId, quantity, restock: true, restockOnly: true }]
        : next;
    });
  }

  function handleReturnCancel() {
    setReturnLines([]);
    setReturnReason('');
    setError('');
  }

  function handleProcessReturn() {
    setError('');
    if (returnLines.length === 0) {
      setError('Add at least one returned item.');
      return;
    }

    startTransition(async () => {
      try {
        const updated = await processOrderReturnAction(order.id, {
          expectedUpdatedAt: order.updatedAt,
          lines: returnLines,
          reason: [returnReason.trim(), statusChangeNote.trim()]
            .filter(Boolean)
            .join('\n\n'),
          refundAmount: Math.max(0, refundableReturnAmount),
        });
        const next: EditableOrder = {
          ...order,
          ...updated,
          variantCatalog: order.variantCatalog,
        };
        setOrder(next);
        setDraft(next);
        setOrderDiscountInput(next.orderLevelDiscount.toString());
        setStatusChangeNote('');
        handleReturnCancel();
      } catch (actionError) {
        setError(
          actionError instanceof Error
            ? actionError.message
            : 'Unable to process return right now.',
        );
      }
    });
  }

  function handleRefundCancel() {
    setActiveRefundId(null);
    setRefundPaymentMethod('BKASH');
    setRefundReferenceNote('');
    setError('');
  }

  function handlePayRefund(orderReturnId: string) {
    setError('');
    startTransition(async () => {
      try {
        const updated = await processOrderRefundAction(order.id, {
          expectedUpdatedAt: order.updatedAt,
          orderReturnId,
          refundMethod: refundPaymentMethod,
          referenceNote: refundReferenceNote,
        });
        const next: EditableOrder = {
          ...order,
          ...updated,
          variantCatalog: order.variantCatalog,
        };
        setOrder(next);
        setDraft(next);
        setOrderDiscountInput(next.orderLevelDiscount.toString());
        handleRefundCancel();
      } catch (actionError) {
        setError(
          actionError instanceof Error
            ? actionError.message
            : 'Unable to pay refund right now.',
        );
      }
    });
  }

  function renderReturnPanel() {
    return (
      <div className="space-y-3 rounded-lg border border-orange-100 bg-orange-50/40 p-3">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-orange-100 text-sm">
            <thead className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-2 py-2">Product</th>
                <th className="px-2 py-2 text-right">Price</th>
                <th className="px-2 py-2 text-right">Ordered</th>
                <th className="px-2 py-2 text-right">Returned</th>
                <th className="px-2 py-2 text-right">Pending stock</th>
                <th className="px-2 py-2 text-right">Return</th>
                <th className="px-2 py-2 text-right">Total</th>
                <th className="px-2 py-2 text-center">Restock now</th>
                <th className="px-2 py-2 text-center">Receive stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-orange-100">
              {returnableItems.map((item) => {
                const draftLine = returnLines.find(
                  (line) => line.orderProductId === item.id && !line.restockOnly,
                );
                const pendingRestockLine = returnLines.find(
                  (line) => line.orderProductId === item.id && line.restockOnly,
                );
                const returnQuantity = draftLine?.quantity ?? 0;
                const refundableUnitPrice = item.lineTotal / item.quantity;
                const returnLineTotal = refundableUnitPrice * returnQuantity;
                return (
                  <tr key={item.id}>
                    <td className="px-2 py-2">
                      <p className="font-medium text-slate-900">{item.productName}</p>
                        <p className="text-xs text-slate-500">{item.variantLabel}</p>
                      </td>
                    <td className="px-2 py-2 text-right text-slate-700">
                      {formatMoney(item.unitPrice)}
                    </td>
                    <td className="px-2 py-2 text-right text-slate-700">
                      {item.quantity}
                    </td>
                    <td className="px-2 py-2 text-right text-slate-700">
                      {item.returnedQuantity}
                    </td>
                    <td className="px-2 py-2 text-right text-slate-700">
                      {item.pendingRestockQuantity}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        max={item.returnableQuantity}
                        step={1}
                        inputMode="numeric"
                        disabled={item.returnableQuantity <= 0 || isPending}
                        value={draftLine?.quantity ?? 0}
                        onFocus={(event) => event.target.select()}
                        onChange={(event) =>
                          updateReturnLine(
                            item.id,
                            sanitizeWholeNumberInput(event.target.value),
                            item.returnableQuantity,
                          )
                        }
                        className="h-8 w-20 rounded-md border border-orange-100 bg-white px-2 text-right text-xs text-slate-900 disabled:bg-slate-50"
                      />
                    </td>
                    <td className="px-2 py-2 text-right font-semibold text-slate-900">
                      {formatMoney(returnLineTotal)}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        disabled={!draftLine || isPending}
                        checked={draftLine?.restock ?? false}
                        onChange={(event) =>
                          updateReturnRestock(item.id, event.target.checked)
                        }
                        className="h-4 w-4 accent-orange-600"
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      {item.pendingRestockQuantity > 0 ? (
                        <label className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600">
                          <input
                            type="checkbox"
                            disabled={isPending}
                            checked={Boolean(pendingRestockLine)}
                            onChange={(event) =>
                              updatePendingRestockLine(
                                item.id,
                                item.pendingRestockQuantity,
                                event.target.checked,
                              )
                            }
                            className="h-4 w-4 accent-emerald-600"
                          />
                          Received
                        </label>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
          <label className="text-[11px] font-medium text-slate-600">
            Return note
            <input
              type="text"
              value={returnReason}
              disabled={isPending}
              onChange={(event) => setReturnReason(event.target.value)}
              className="mt-0.5 h-8 w-full rounded-md border border-orange-100 bg-white px-2 py-1 text-xs text-slate-900 disabled:bg-slate-50"
              placeholder="Reason or customer note"
            />
          </label>
          <label className="text-[11px] font-medium text-slate-600">
            Refund due
            <div className="mt-0.5 flex h-8 w-full items-center justify-end rounded-md border border-orange-100 bg-white px-2 py-1 text-xs font-semibold text-slate-900">
              {formatMoney(refundableReturnAmount)}
            </div>
          </label>
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Order Status</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <label className="text-[11px] font-medium text-slate-600">
            Payment Method
            <select
              value={draft.paymentMethod}
              disabled={isFulfillmentLocked || isPending}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  paymentMethod: event.target.value,
                }))
              }
              className="mt-0.5 h-8 w-full rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-900 disabled:bg-slate-50"
            >
              <option value="COD">Cash on Delivery</option>
              <option value="BKASH">bKash</option>
            </select>
          </label>
          <label className="text-[11px] font-medium text-slate-600">
            Payment Status
            <select
              value={draft.paymentStatus}
              disabled={isFulfillmentLocked || isPending}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  paymentStatus: event.target.value,
                }))
              }
              className="mt-0.5 h-8 w-full rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-900 disabled:bg-slate-50"
            >
              <option value="unpaid">Unpaid</option>
              <option value="paid">Paid</option>
            </select>
          </label>
          <label className="text-[11px] font-medium text-slate-600">
            Order Status
            <select
              value={draft.orderStatus}
              disabled={isPending}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  orderStatus: event.target.value,
                }))
              }
              className="mt-0.5 h-8 w-full rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-900 disabled:bg-slate-50"
            >
              {orderStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {hasStatusChanges ? (
          <div className="mt-4 space-y-3">
            {hasOrderStatusChange && !isDraftingReturnStatus ? (
              <label className="block text-[11px] font-medium text-slate-600">
                Timeline note
                <input
                  type="text"
                  value={statusChangeNote}
                  disabled={isPending}
                  onChange={(event) => setStatusChangeNote(event.target.value)}
                  className="mt-0.5 h-8 w-full rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-900 disabled:bg-slate-50"
                  placeholder="Optional note for this status change"
                />
              </label>
            ) : null}
            {isDraftingReturnStatus ? (
              hasReturnableItems || hasPendingRestockItems ? (
                renderReturnPanel()
              ) : (
                <p className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                  {returnUnavailableMessage}
                </p>
              )
            ) : null}
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={
                  isPending ||
                  (isDraftingReturnStatus && !hasReturnableItems && !hasPendingRestockItems)
                }
                onClick={isDraftingReturnStatus ? handleProcessReturn : handleUpdate}
                className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
              >
                {isPending
                  ? isDraftingReturnStatus
                    ? 'Processing...'
                    : 'Updating...'
                  : isDraftingReturnStatus
                    ? 'Submit Return'
                    : 'Update'}
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleStatusCancel}
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div
          className="flex cursor-pointer items-center justify-between gap-3"
          onClick={() => setIsCustomerCardOpen((current) => !current)}
          role="button"
          aria-expanded={isCustomerCardOpen}
          aria-controls="customer-details-body"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setIsCustomerCardOpen((current) => !current);
            }
          }}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <h3 className="shrink-0 text-sm font-semibold text-slate-900">Customer Details</h3>
            <div
              className="mx-auto grid w-full max-w-xl min-w-0 grid-cols-2 gap-2"
              onClick={(event) => event.stopPropagation()}
            >
              <label className="text-[11px] font-medium text-slate-600">
                First Name
                <input
                  type="text"
                  value={draft.firstName}
                  disabled={!isCustomerEditing}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      firstName: event.target.value,
                    }))
                  }
                  className="mt-0.5 h-8 w-full rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-900 disabled:bg-slate-50"
                />
              </label>
              <label className="text-[11px] font-medium text-slate-600">
                Last Name
                <input
                  type="text"
                  value={draft.lastName}
                  disabled={!isCustomerEditing}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      lastName: event.target.value,
                    }))
                  }
                  className="mt-0.5 h-8 w-full rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-900 disabled:bg-slate-50"
                />
              </label>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">
              <ChevronIcon open={isCustomerCardOpen} />
            </span>
            {!isCustomerEditing ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setIsCustomerCardOpen(true);
                if (isFulfillmentLocked) return;
                setIsEditingCustomerOnly(true);
                setIsEditingAll(false);
                setIsEditingItemsOnly(false);
              }}
              aria-label="Edit customer details"
              disabled={isFulfillmentLocked}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <PencilIcon />
            </button>
            ) : null}
          </div>
        </div>
        {isCustomerCardOpen ? (
          <div id="customer-details-body" className="mt-2 space-y-2">
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-[11px] font-medium text-slate-600">
              Phone
              <input
                type="text"
                value={draft.phone}
                disabled={!isCustomerEditing}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    phone: event.target.value,
                  }))
                }
                className="mt-0.5 h-8 w-full rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-900 disabled:bg-slate-50"
              />
            </label>
            <label className="text-[11px] font-medium text-slate-600">
              Receiver Phone
              <input
                type="text"
                value={draft.receiverPhone}
                disabled={!isCustomerEditing}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    receiverPhone: event.target.value,
                  }))
                }
                className="mt-0.5 h-8 w-full rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-900 disabled:bg-slate-50"
              />
            </label>
            <label className="text-[11px] font-medium text-slate-600">
              Email
              <input
                type="text"
                value={draft.email}
                disabled={!isCustomerEditing}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    email: event.target.value,
                  }))
                }
                className="mt-0.5 h-8 w-full rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-900 disabled:bg-slate-50"
              />
            </label>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-[11px] font-medium text-slate-600">
              District
              <SearchableDropdown
                value={draft.district}
                options={groupedLocationDistricts}
                placeholder="Select District"
                disabled={!isCustomerEditing}
                onSelect={handleCustomerDistrictSelect}
                className="mt-0.5 h-8 w-full rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-900 disabled:bg-slate-50"
              />
            </label>
            <label className="text-[11px] font-medium text-slate-600">
              Thana / Upozila
              <SearchableDropdown
                value={draft.thana}
                options={groupedLocationThanas}
                placeholder="Select Thana / Upozila"
                disabled={!isCustomerEditing || !draft.district}
                onSelect={(value) =>
                  setDraft((prev) => ({
                    ...prev,
                    thana: value,
                  }))
                }
                className="mt-0.5 h-8 w-full rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-900 disabled:bg-slate-50"
              />
            </label>
          </div>
          <label className="sm:col-span-2 text-[11px] font-medium text-slate-600">
            Address
            <input
              type="text"
              value={draft.address}
              disabled={!isCustomerEditing}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  address: event.target.value,
                }))
              }
              className="mt-0.5 h-8 w-full rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-900 disabled:bg-slate-50"
            />
          </label>
          {isEditingCustomerOnly ? (
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={handleUpdate}
                className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
              >
                {isPending ? 'Updating...' : 'Update'}
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleCancel}
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          ) : null}
          </div>
        ) : null}
        {isEditingCustomerOnly && !isCustomerCardOpen ? (
          <div className="mt-3 text-[11px] text-amber-700">
            Customer edit mode is active. Expand this card to review and save changes.
          </div>
        ) : null}
      </section>

      <section
        id="order-items-section"
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-900">Items</h3>
          {!isItemsEditing ? (
            <button
              type="button"
              onClick={() => {
                if (isFulfillmentLocked) return;
                setIsEditingCustomerOnly(false);
                setIsEditingItemsOnly(true);
              }}
              aria-label="Edit item discounts and totals"
              disabled={isFulfillmentLocked}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
            >
              <PencilIcon />
            </button>
          ) : null}
        </div>
        <div className="mt-4">
          {isItemsEditing ? (
            <div className="relative z-40 mb-3 flex flex-wrap items-start gap-2 overflow-visible">
              <div ref={addItemDropdownRef} className="relative z-40 w-full max-w-3xl sm:min-w-[520px] sm:flex-1 lg:flex-none">
                <input
                  type="text"
                  value={addItemSearch}
                  onFocus={() => setIsAddItemDropdownOpen(true)}
                  onClick={() => setIsAddItemDropdownOpen(true)}
                  onChange={(event) => {
                    setAddItemSearch(event.target.value);
                    setIsAddItemDropdownOpen(true);
                  }}
                  placeholder="Search product to add..."
                  className="w-full rounded-md border border-slate-200 px-3 py-2 pr-9 text-xs text-slate-900 outline-none focus:border-slate-400"
                />
                {addItemSearch ? (
                  <button
                    type="button"
                    onClick={() => {
                      setAddItemSearch('');
                      setIsAddItemDropdownOpen(true);
                    }}
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                  >
                    ×
                  </button>
                ) : null}
                {isAddItemDropdownOpen ? (
                  <div className="absolute left-0 top-[calc(100%+4px)] z-[90] max-h-80 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-xl shadow-slate-200/70">
                    {addItemProducts.map((product) => {
                      const isExpanded = expandedAddItemProductId === product.productId;
                      const productVariantIds = product.variants.map((variant) => variant.variantId);
                      const selectedCount = productVariantIds.filter((id) =>
                        selectedVariantIdsToAdd.includes(id),
                      ).length;
                      const isProductChecked = selectedCount > 0;
                      return (
                        <div key={product.productId} className="border-b border-slate-100 last:border-b-0">
                          <div className="flex items-center gap-2 px-2 py-2 text-xs font-semibold text-slate-900">
                            {isProductChecked ? (
                              <input
                                type="checkbox"
                                checked={isProductChecked}
                                onChange={(event) => {
                                  setSelectedVariantIdsToAdd((current) => {
                                    if (event.target.checked) {
                                      return [...new Set([...current, ...productVariantIds])];
                                    }
                                    return current.filter((id) => !productVariantIds.includes(id));
                                  });
                                }}
                                className="h-3.5 w-3.5 accent-slate-700"
                              />
                            ) : (
                              <span className="inline-block h-3.5 w-3.5" aria-hidden="true" />
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedAddItemProductId((current) =>
                                  current === product.productId ? null : product.productId,
                                )
                              }
                              className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left transition hover:text-slate-700"
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <div className="h-7 w-7 shrink-0 overflow-hidden rounded border border-slate-200 bg-slate-100">
                                  {product.thumbnail ? (
                                    <img
                                      src={product.thumbnail}
                                      alt={product.productName}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="h-full w-full bg-slate-100" />
                                  )}
                                </div>
                                <span className="truncate">{product.productName}</span>
                              </div>
                              <span className="text-slate-500">
                                <ChevronIcon open={isExpanded} />
                              </span>
                            </button>
                          </div>
                          {isExpanded ? (
                            <div className="space-y-1 pb-2">
                                {product.variants.map((entry) => (
                                <div
                                  key={entry.variantId}
                                  onClick={() => toggleVariantSelection(entry.variantId)}
                                  className="ml-2 flex w-[calc(100%-0.5rem)] cursor-pointer items-center gap-2 rounded px-2 py-2 text-left text-xs text-slate-900 transition hover:bg-slate-50"
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedVariantIdsToAdd.includes(entry.variantId)}
                                    readOnly
                                    className="h-3.5 w-3.5 accent-slate-700"
                                  />
                                  <div className="h-8 w-8 shrink-0 overflow-hidden rounded border border-slate-200 bg-slate-100">
                                    {entry.imagePath ? (
                                      <img
                                        src={entry.imagePath}
                                        alt={entry.productName}
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      <div className="h-full w-full bg-slate-100" />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate text-[11px] text-slate-600">
                                      {entry.variantLabel} - {entry.sku}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                    {addItemProducts.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-slate-500">No matching products.</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                disabled={selectedVariantIdsToAdd.length === 0}
                onClick={handleAddItem}
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add selected
              </button>
            </div>
          ) : null}
          <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Unit</th>
                <th className="px-3 py-2 text-right">Discount</th>
                <th className="px-3 py-2 text-right">Payable</th>
                {isItemsEditing ? <th className="px-3 py-2 text-right">Action</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {draft.items.map((item, index) => {
                const lineTotal = item.quantity * item.unitPrice - item.discountAmount;
                const bundlePreview = bundlePreviewByItemId.get(item.id);
                return (
                  <tr key={item.id}>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                          <SafeImage
                            src={item.imagePath}
                            alt={item.productName}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{item.productName}</p>
                          <p className="text-xs text-slate-600">{item.variantLabel}</p>
                          {bundlePreview?.appliedBundleTitle ? (
                            <p className="mt-1 text-[11px] font-semibold text-emerald-700">
                              Applied bundle: {bundlePreview.appliedBundleTitle}
                              {item.bundleRule ? ` (${item.bundleRule})` : ''}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right">
                      {isItemsEditing ? (
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(event) => {
                            const nextValue = Math.max(1, Math.floor(sanitizeNumberInput(event.target.value)));
                            setDraft((prev) => {
                              const nextItems = [...prev.items];
                              nextItems[index] = { ...nextItems[index], quantity: nextValue };
                              return { ...prev, items: recomputeBundleDiscounts(nextItems) };
                            });
                          }}
                          className="w-24 rounded-md border border-slate-200 px-1.5 py-1 text-right text-xs text-slate-900"
                        />
                      ) : (
                        <span className="font-medium text-slate-900">{item.quantity}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="text-slate-700">{formatMoney(item.unitPrice)}</span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      {isItemsEditing ? (
                        <input
                          type="number"
                          min={0}
                          step={1}
                          inputMode="numeric"
                          value={item.discountAmount}
                          onFocus={(event) => event.target.select()}
                          onChange={(event) => {
                            const nextValue = Math.max(0, sanitizeWholeNumberInput(event.target.value));
                            setDraft((prev) => {
                              const nextItems = [...prev.items];
                              nextItems[index] = { ...nextItems[index], discountAmount: nextValue };
                              return { ...prev, items: nextItems };
                            });
                          }}
                          className="w-24 rounded-md border border-slate-200 px-1.5 py-1 text-right text-xs text-slate-900"
                        />
                      ) : (
                        <span className="inline-flex items-center gap-2 text-slate-700">
                          {formatMoney(item.discountAmount)}
                          <button
                            type="button"
                            onClick={() => {
                              if (isFulfillmentLocked) return;
                              setIsEditingCustomerOnly(false);
                              setIsEditingItemsOnly(true);
                            }}
                            aria-label={`Edit unit discount for ${item.productName}`}
                            disabled={isFulfillmentLocked}
                            className="inline-flex h-5 w-5 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                          >
                            <PencilIcon className="h-3 w-3" />
                          </button>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-slate-900">
                      {formatMoney(Math.max(0, lineTotal))}
                    </td>
                    {isItemsEditing ? (
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="rounded-md border border-rose-200 bg-white px-2 py-1 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-50"
                        >
                          Remove
                        </button>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
          <div className="space-y-2 text-sm text-slate-700">
            <div className="flex items-center justify-between">
              <span>Subtotal</span>
              <span>{formatMoney(previewSubtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Item Discount</span>
              <span>{formatMoney(previewDiscount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Order Discount</span>
              {isItemsEditing ? (
                <div className="flex items-center gap-2">
                  <select
                    value={orderDiscountType}
                    onChange={(event) =>
                      setOrderDiscountType(event.target.value as 'amount' | 'percent')
                    }
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-900"
                  >
                    <option value="amount">Amount</option>
                    <option value="percent">%</option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    value={orderDiscountInput}
                    onFocus={(event) => event.target.select()}
                    onChange={(event) =>
                      setOrderDiscountInput(
                        Math.max(0, sanitizeWholeNumberInput(event.target.value)).toString(),
                      )
                    }
                    className="w-24 rounded-md border border-slate-200 px-1.5 py-1 text-right text-xs text-slate-900"
                  />
                </div>
              ) : (
                <span>{formatMoney(Math.max(0, draft.orderLevelDiscount))}</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span>Shipping</span>
              <span>{formatMoney(draft.deliveryCharge)}</span>
            </div>
            <div className="flex items-center justify-between font-semibold text-slate-900">
              <span>Total</span>
              <span>{formatMoney(previewTotal)}</span>
            </div>
            <div className="border-t border-slate-200 pt-2" />
            <div className="flex items-center justify-between">
              <span>Paid</span>
              {isItemsEditing ? (
                <input
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  value={draft.paidAmount}
                  onFocus={(event) => event.target.select()}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      paidAmount: Math.max(0, sanitizeWholeNumberInput(event.target.value)),
                    }))
                  }
                  className="w-24 rounded-md border border-slate-200 px-1.5 py-1 text-right text-xs text-slate-900"
                />
              ) : (
                <span>{formatMoney(previewPaid)}</span>
              )}
            </div>
            <div className="flex items-center justify-between font-semibold text-slate-900">
              <span>Balance</span>
              <span>{formatMoney(previewBalance)}</span>
            </div>
          </div>
        </div>

        {error ? <p className="mt-3 text-xs font-medium text-rose-600">{error}</p> : null}
        {isFulfillmentLocked ? (
          <p className="mt-3 text-xs font-medium text-amber-700">
            This order is shipped/delivered and locked from edits except moving to the next allowed status.
          </p>
        ) : null}

        {isAnyEditing ? (
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={handleUpdate}
              className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
            >
              {isPending ? 'Updating...' : 'Update'}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={handleCancel}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Refunds</h3>
            <p className="mt-1 text-xs text-slate-500">
              {pendingRefunds.length > 0
                ? `${pendingRefunds.length} refund payment${pendingRefunds.length === 1 ? '' : 's'} pending`
                : order.returns.length > 0
                  ? 'All recorded refunds are paid.'
                  : returnUnavailableMessage || 'No refunds recorded yet.'}
            </p>
          </div>
          {activeRefund && activeRefundId !== activeRefund.id ? (
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setActiveRefundId(activeRefund.id);
                setRefundPaymentMethod(activeRefund.refundMethod || 'BKASH');
                setRefundReferenceNote(activeRefund.refundReferenceNote || '');
              }}
              className="rounded-md border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 transition hover:bg-orange-100 disabled:opacity-50"
            >
              Pay refund
            </button>
          ) : null}
        </div>

        {activeRefundId && activeRefund ? (
          <div className="mt-4 rounded-lg border border-orange-100 bg-orange-50/40 p-3">
            <div className="grid gap-2 sm:grid-cols-[160px_180px_1fr]">
              <label className="text-[11px] font-medium text-slate-600">
                Payment method
                <select
                  value={refundPaymentMethod}
                  disabled={isPending}
                  onChange={(event) => setRefundPaymentMethod(event.target.value)}
                  className="mt-0.5 h-8 w-full rounded-md border border-orange-100 bg-white px-2 py-1 text-xs text-slate-900 disabled:bg-slate-50"
                >
                  <option value="NAGAD">Nagad</option>
                  <option value="BKASH">bKash</option>
                  <option value="BANK">Bank</option>
                </select>
              </label>
              <label className="text-[11px] font-medium text-slate-600">
                Amount
                <div className="mt-0.5 flex h-8 w-full items-center justify-end rounded-md border border-orange-100 bg-white px-2 py-1 text-xs font-semibold text-slate-900">
                  {formatMoney(activeRefund.refundAmount)}
                </div>
              </label>
              <label className="text-[11px] font-medium text-slate-600">
                Reference Note
                <input
                  type="text"
                  value={refundReferenceNote}
                  disabled={isPending}
                  onChange={(event) => setRefundReferenceNote(event.target.value)}
                  className="mt-0.5 h-8 w-full rounded-md border border-orange-100 bg-white px-2 py-1 text-xs text-slate-900 disabled:bg-slate-50"
                  placeholder="Transaction ID, bank ref, or cash note"
                />
              </label>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => handlePayRefund(activeRefund.id)}
                className="rounded-md border border-orange-200 bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-orange-700 disabled:opacity-50"
              >
                {isPending ? 'Refunding...' : 'Confirm Refund'}
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleRefundCancel}
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {order.returns.length > 0 ? (
          <div className="mt-4 space-y-2">
            {order.returns.map((orderReturn) => (
              <div key={orderReturn.id} className="rounded-md border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-slate-900">
                    {formatNoteDate(orderReturn.createdAt)}
                  </span>
                  <span className="text-slate-500">
                    {orderReturn.createdByName}
                    {orderReturn.refundAmount > 0
                      ? ` - ${
                          orderReturn.refundMethod ? 'Refunded' : 'Refund due'
                        } ${formatMoney(orderReturn.refundAmount)}${
                          orderReturn.refundMethod
                            ? ` via ${formatRefundMethod(orderReturn.refundMethod)}`
                            : ''
                        }`
                      : ''}
                  </span>
                </div>
                {orderReturn.refundReferenceNote ? (
                  <p className="mt-1 text-xs text-slate-600">
                    Reference: {orderReturn.refundReferenceNote}
                  </p>
                ) : null}
                {orderReturn.reason ? (
                  <p className="mt-1 text-xs text-slate-600">{orderReturn.reason}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  {orderReturn.lines.map((line) => {
                    const item = order.items.find(
                      (orderItem) => orderItem.id === line.orderProductId,
                    );
                    return (
                      <span
                        key={line.id}
                        className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700"
                      >
                        {item?.productName ?? 'Order item'} x {line.quantity}
                        {line.restocked ? ' restocked' : ''}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Timeline</h3>
        {draft.noteHistory.length > 0 ? (
          <div className="mt-3 space-y-2">
            {draft.noteHistory.map((entry) =>
              entry.kind === 'event' ? (
                <div
                  key={entry.id}
                  className="mx-auto w-fit max-w-full rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-center"
                >
                  <p className="text-xs font-medium text-blue-950">
                    {formatTimelineActor(entry.createdByName)} {entry.note}.
                  </p>
                </div>
              ) : (
                <div key={entry.id} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                  <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                    <span className="font-medium text-slate-700">{entry.createdByName}</span>
                    <span>{formatNoteDate(entry.createdAt)}</span>
                  </div>
                  <p className="text-xs text-slate-800">{entry.note}</p>
                </div>
              ),
            )}
          </div>
        ) : (
          <p className="mt-3 text-xs text-slate-500">No lifecycle entries or notes yet.</p>
        )}
        <textarea
          value={draft.notes}
          disabled={isFulfillmentLocked || isPending}
          onChange={(event) =>
            setDraft((prev) => ({
              ...prev,
              notes: event.target.value,
            }))
          }
          rows={4}
          className="mt-3 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-900 disabled:bg-slate-50"
          placeholder="Add a new note"
        />
        {hasPendingNote ? (
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={handleUpdate}
              className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
            >
              {isPending ? 'Updating...' : 'Update'}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={handleNoteCancel}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        ) : null}
      </section>
    </section>
  );
}
