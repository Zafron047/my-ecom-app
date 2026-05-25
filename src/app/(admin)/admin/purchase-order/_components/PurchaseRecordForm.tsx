'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import AdminTimelinePanel from '@/components/admin/AdminTimelinePanel';
import {
  PURCHASE_ORDER_STATUS,
  PURCHASE_PAYMENT_STATUS,
  formatPurchasePaymentStatus,
  getPurchaseOrderLifecycleLabel,
  isPurchaseOrderLockedClosed,
} from '@/lib/purchase-order-status';

type PurchaseRecordLine = {
  batchNumber: string;
  id: string;
  imagePath: string | null;
  lineTotal: number | null;
  orderedQuantity: number;
  productName: string;
  receivedQuantity: number;
  sku: string;
  unitCost: number | null;
  variantLabel: string;
};

type PurchaseRecord = {
  id: string;
  lines: PurchaseRecordLine[];
  notes: string;
  orderNumber: string;
  paidAmount: number;
  paymentMethod: string;
  paymentReference: string;
  paymentStatus: string;
  purchaseDate: string;
  referenceNo: string;
  status: string;
  supplierName: string;
  totalCost: number | null;
  totalQuantity: number;
  timeline: PurchaseRecordTimelineEntry[];
};

type PurchaseRecordFormProps = {
  canManagePayment: boolean;
  canViewCost: boolean;
  cancelAction: (formData: FormData) => Promise<PurchaseRecordActionState>;
  deleteNoteAction: (formData: FormData) => Promise<PurchaseRecordActionState>;
  editNoteAction: (formData: FormData) => Promise<PurchaseRecordActionState>;
  noteAction: (formData: FormData) => Promise<PurchaseRecordActionState>;
  payAction: (formData: FormData) => Promise<PurchaseRecordActionState>;
  receiveAction: (formData: FormData) => Promise<PurchaseRecordActionState>;
  record: PurchaseRecord;
  updateDetailsAction: (formData: FormData) => Promise<PurchaseRecordActionState>;
};

type PurchaseRecordActionState = {
  batchNumberByLine?: Array<[string, string]>;
  error?: string;
  message?: string;
  notes?: string;
  paidAmount?: number;
  paymentMethod?: string;
  paymentReference?: string;
  paymentStatus?: string;
  purchaseDate?: string;
  receivedByLine?: Array<[string, number]>;
  referenceNo?: string;
  status?: string;
  supplierName?: string;
  timeline?: PurchaseRecordTimelineEntry[];
};

type PurchaseRecordTimelineEntry = {
  createdAt: string;
  createdByName: string;
  id: string;
  kind: 'event' | 'note';
  note: string;
};

type PaymentSnapshot = {
  paidAmount: number;
  paymentMethod: string;
  paymentReference: string;
  paymentStatus: string;
};

type PurchaseDetailsSnapshot = {
  notes: string;
  purchaseDate: string;
  referenceNo: string;
  supplierName: string;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-BD', {
    currency: 'BDT',
    maximumFractionDigits: 2,
    style: 'currency',
  }).format(value);
}

function PencilIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
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

function getInitialPaidAmount(record: PurchaseRecord) {
  return record.paidAmount;
}

function createPaymentSnapshot(record: PurchaseRecord): PaymentSnapshot {
  const paymentStatus = record.paymentStatus || PURCHASE_PAYMENT_STATUS.DUE;

  return {
    paidAmount: getInitialPaidAmount(record),
    paymentMethod:
      paymentStatus === PURCHASE_PAYMENT_STATUS.DUE ? '' : record.paymentMethod,
    paymentReference:
      paymentStatus === PURCHASE_PAYMENT_STATUS.DUE ? '' : record.paymentReference,
    paymentStatus,
  };
}

function createDetailsSnapshot(record: PurchaseRecord): PurchaseDetailsSnapshot {
  return {
    notes: record.notes,
    purchaseDate: record.purchaseDate,
    referenceNo: record.referenceNo,
    supplierName: record.supplierName,
  };
}

function getSavedPaidAmountForStatus(input: {
  savedPaidAmount: number;
  paymentStatus: string;
  totalCost: number;
}) {
  if (input.paymentStatus === PURCHASE_PAYMENT_STATUS.PAID) return input.totalCost;
  if (input.paymentStatus === PURCHASE_PAYMENT_STATUS.PARTIAL_PAID) {
    return input.savedPaidAmount;
  }
  return 0;
}

function getPaymentBaseAmount(input: {
  requestedPaymentStatus: string;
  savedPayment: PaymentSnapshot;
}) {
  if (
    input.requestedPaymentStatus === PURCHASE_PAYMENT_STATUS.PARTIAL_PAID &&
    input.savedPayment.paymentStatus === PURCHASE_PAYMENT_STATUS.PARTIAL_PAID
  ) {
    return input.savedPayment.paidAmount;
  }

  return 0;
}

function getPaymentCompletionAmount(input: {
  savedPayment: PaymentSnapshot;
  totalCost: number;
}) {
  const alreadyPaid =
    input.savedPayment.paymentStatus === PURCHASE_PAYMENT_STATUS.PAID
      ? input.totalCost
      : input.savedPayment.paymentStatus === PURCHASE_PAYMENT_STATUS.PARTIAL_PAID
        ? input.savedPayment.paidAmount
        : 0;

  return Math.max(0, input.totalCost - alreadyPaid);
}

function normalizeBatchNumberInput(value: string) {
  return value === '-' ? '' : value;
}

function formatBatchNumberDisplay(value: string) {
  return value.trim() || '-';
}

function getBatchDatePart(purchaseDate: string) {
  const datePart = purchaseDate.replace(/\D/g, '').slice(0, 8);
  return datePart || new Date().toISOString().slice(0, 10).replace(/\D/g, '');
}

function getStableFourDigitCode(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return String(1000 + (hash % 9000)).padStart(4, '0');
}

function getSuggestedBatchNumber(
  purchaseDate: string,
  lineId: string,
  lineIndex: number,
) {
  return `${getBatchDatePart(purchaseDate)}-${getStableFourDigitCode(
    `${lineId}-${lineIndex}`,
  )}`;
}

function getReceiveBatchNumber(
  line: PurchaseRecordLine,
  purchaseDate: string,
  lineIndex: number,
) {
  return (
    normalizeBatchNumberInput(line.batchNumber) ||
    getSuggestedBatchNumber(purchaseDate, line.id, lineIndex)
  );
}

function getPreviewPaidAmountForStatus(input: {
  paymentAmount: number | string;
  paymentStatus: string;
  savedPayment: PaymentSnapshot;
  totalCost: number;
}) {
  if (input.paymentStatus === PURCHASE_PAYMENT_STATUS.PAID) return input.totalCost;
  if (input.paymentStatus === PURCHASE_PAYMENT_STATUS.PARTIAL_PAID) {
    return (
      getPaymentBaseAmount({
        requestedPaymentStatus: input.paymentStatus,
        savedPayment: input.savedPayment,
      }) + (Number(input.paymentAmount) || 0)
    );
  }
  return 0;
}

export default function PurchaseRecordForm({
  canManagePayment,
  canViewCost,
  cancelAction,
  deleteNoteAction,
  editNoteAction,
  noteAction,
  payAction,
  receiveAction,
  record,
  updateDetailsAction,
}: PurchaseRecordFormProps) {
  const router = useRouter();
  const initialDetails = createDetailsSnapshot(record);
  const initialPayment = createPaymentSnapshot(record);
  const [recordStatus, setRecordStatus] = useState(record.status);
  const [isProductListOpen, setIsProductListOpen] = useState(true);
  const [isPaymentOpen, setIsPaymentOpen] = useState(true);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [isEditingPayment, setIsEditingPayment] = useState(false);
  const [isEditingReceive, setIsEditingReceive] = useState(false);
  const [savedDetails, setSavedDetails] = useState(initialDetails);
  const [supplierName, setSupplierName] = useState(initialDetails.supplierName);
  const [referenceNo, setReferenceNo] = useState(initialDetails.referenceNo);
  const [purchaseDate, setPurchaseDate] = useState(initialDetails.purchaseDate);
  const [timeline, setTimeline] = useState(record.timeline);
  const [savedPayment, setSavedPayment] = useState(initialPayment);
  const [paymentStatus, setPaymentStatus] = useState(initialPayment.paymentStatus);
  const [paymentMethod, setPaymentMethod] = useState(initialPayment.paymentMethod);
  const [paymentReference, setPaymentReference] = useState(
    initialPayment.paymentReference,
  );
  const [paymentAmount, setPaymentAmount] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isCancellingPo, setIsCancellingPo] = useState(false);
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [isSavingReceive, setIsSavingReceive] = useState(false);
  const [receivedByLine, setReceivedByLine] = useState(() =>
    new Map(record.lines.map((line) => [line.id, line.receivedQuantity])),
  );
  const [savedBatchNumberByLine, setSavedBatchNumberByLine] = useState(() =>
    new Map(
      record.lines.map((line) => [
        line.id,
        normalizeBatchNumberInput(line.batchNumber),
      ]),
    ),
  );
  const [batchNumberByLine, setBatchNumberByLine] = useState(() =>
    new Map(
      record.lines.map((line, index) => [
        line.id,
        getReceiveBatchNumber(line, record.purchaseDate, index),
      ]),
    ),
  );
  const [receiveNowByLine, setReceiveNowByLine] = useState(() =>
    new Map(record.lines.map((line) => [line.id, ''])),
  );

  const recordTotalCost = record.totalCost ?? 0;
  const displayPayment = isEditingPayment
    ? {
        paidAmount: getPreviewPaidAmountForStatus({
          paymentAmount,
          paymentStatus,
          savedPayment,
          totalCost: recordTotalCost,
        }),
        paymentStatus,
      }
    : {
        paidAmount: getSavedPaidAmountForStatus({
          paymentStatus: savedPayment.paymentStatus,
          savedPaidAmount: savedPayment.paidAmount,
          totalCost: recordTotalCost,
        }),
        paymentStatus: savedPayment.paymentStatus,
      };
  const savedPaidAmount = getSavedPaidAmountForStatus({
    paymentStatus: savedPayment.paymentStatus,
    savedPaidAmount: savedPayment.paidAmount,
    totalCost: recordTotalCost,
  });
  const payableAmount = Math.max(0, recordTotalCost - displayPayment.paidAmount);
  const paymentCompletionAmount = getPaymentCompletionAmount({
    savedPayment,
    totalCost: recordTotalCost,
  });
  const trimmedPaymentAmount = paymentAmount.trim();
  const numericPaymentAmount = Number(paymentAmount);
  const hasPartialPaymentAmount = trimmedPaymentAmount.length > 0;
  const isPartialPaymentSelected =
    paymentStatus === PURCHASE_PAYMENT_STATUS.PARTIAL_PAID;
  const isSettingPartialPaidAmount =
    isPartialPaymentSelected &&
    savedPayment.paymentStatus === PURCHASE_PAYMENT_STATUS.PAID;
  const nextPartialPaidAmount =
    isPartialPaymentSelected
      ? getPaymentBaseAmount({
          requestedPaymentStatus: paymentStatus,
          savedPayment,
        }) + (Number.isFinite(numericPaymentAmount) ? numericPaymentAmount : 0)
      : 0;
  const hasPaymentAmountInputError =
    isPartialPaymentSelected &&
    hasPartialPaymentAmount &&
    (!Number.isFinite(numericPaymentAmount) ||
      numericPaymentAmount < 0 ||
      numericPaymentAmount >
        (isSettingPartialPaidAmount ? recordTotalCost : paymentCompletionAmount));
  const isPartialPaymentAmountIncomplete =
    isPartialPaymentSelected &&
    (!hasPartialPaymentAmount ||
      !Number.isFinite(numericPaymentAmount) ||
      numericPaymentAmount <= 0 ||
      nextPartialPaidAmount >= recordTotalCost);
  const isPaymentAmountInvalid =
    isEditingPayment && hasPaymentAmountInputError;
  const isPaymentMethodDisabled =
    !isEditingPayment || paymentStatus === PURCHASE_PAYMENT_STATUS.DUE;
  const paymentAmountLabel = isSettingPartialPaidAmount
    ? 'Paid Amount'
    : 'Payment Amount';
  const hasPaymentChanges =
    paymentStatus !== savedPayment.paymentStatus ||
    paymentMethod !== savedPayment.paymentMethod ||
    paymentReference !== savedPayment.paymentReference ||
    (paymentStatus === PURCHASE_PAYMENT_STATUS.PARTIAL_PAID &&
      paymentAmount.trim().length > 0);
  const paymentSaveBlockReason = !isEditingPayment
    ? 'Open payment edit mode first.'
    : !hasPaymentChanges
      ? 'Change payment fields before saving.'
    : paymentStatus !== PURCHASE_PAYMENT_STATUS.DUE && !paymentMethod
      ? 'Payment method is required.'
      : isPartialPaymentAmountIncomplete || isPaymentAmountInvalid
        ? 'Invalid paid amount.'
        : '';
  const receivedTotal = useMemo(
    () =>
      record.lines.reduce(
        (sum, line) => sum + (receivedByLine.get(line.id) ?? line.receivedQuantity),
        0,
      ),
    [receivedByLine, record.lines],
  );
  const remainingTotal = Math.max(0, record.totalQuantity - receivedTotal);
  const lifecycleLabel = getPurchaseOrderLifecycleLabel({
    paymentStatus: displayPayment.paymentStatus,
    receivedQuantity: receivedTotal,
    status: recordStatus,
    totalQuantity: record.totalQuantity,
  });
  const isRecordLocked = isPurchaseOrderLockedClosed(recordStatus);
  const canToggleDetailsEdit =
    !isSavingDetails &&
    !isSavingPayment &&
    !isSavingReceive &&
    !isCancellingPo &&
    !isEditingPayment &&
    !isEditingReceive &&
    !isRecordLocked &&
    canManagePayment;
  const canTogglePaymentEdit =
    !isSavingDetails &&
    !isSavingPayment &&
    !isSavingReceive &&
    !isCancellingPo &&
    !isEditingDetails &&
    !isEditingReceive &&
    !isRecordLocked;
  const canStartReceiveEdit =
    !isSavingDetails &&
    !isSavingPayment &&
    !isSavingReceive &&
    !isCancellingPo &&
    !isEditingDetails &&
    !isEditingPayment &&
    !isRecordLocked;
  const canCancelPo =
    !isSavingDetails &&
    !isSavingPayment &&
    !isSavingReceive &&
    !isCancellingPo &&
    !isRecordLocked;
  const receiveSaveBlockReason = (() => {
    if (!isEditingReceive) return 'Open receive edit mode first.';
    if (remainingTotal === 0) return 'No quantity left to receive.';

    let hasReceiveQuantity = false;
    for (const line of record.lines) {
      const rawReceiveQuantity = receiveNowByLine.get(line.id) ?? '';
      const receiveQuantity = Number(rawReceiveQuantity);
      const alreadyReceived = receivedByLine.get(line.id) ?? line.receivedQuantity;
      const remainingQuantity = Math.max(0, line.orderedQuantity - alreadyReceived);

      if (remainingQuantity === 0) continue;
      if (!rawReceiveQuantity.trim()) continue;

      if (
        !Number.isInteger(receiveQuantity) ||
        receiveQuantity < 0
      ) {
        return 'Received Now must be a whole number.';
      }
      if (receiveQuantity > remainingQuantity) {
        return `Cannot receive more than ${remainingQuantity} unit(s).`;
      }
      if (receiveQuantity > 0) hasReceiveQuantity = true;
    }

    return hasReceiveQuantity ? '' : 'Enter at least one received quantity.';
  })();
  const canSavePayment = !paymentSaveBlockReason && !isSavingPayment;
  const canSaveReceive = !receiveSaveBlockReason && !isSavingReceive;

  function updateReceiveNow(lineId: string, rawValue: string) {
    setReceiveNowByLine((current) => {
      const next = new Map(current);
      next.set(lineId, rawValue);
      return next;
    });
  }

  function clearActionState() {
    setActionError('');
    setActionMessage('');
  }

  function beginDetailsEdit() {
    clearActionState();
    setSupplierName(savedDetails.supplierName);
    setReferenceNo(savedDetails.referenceNo);
    setPurchaseDate(savedDetails.purchaseDate);
    setIsEditingDetails(true);
  }

  function cancelDetailsEdit() {
    setSupplierName(savedDetails.supplierName);
    setReferenceNo(savedDetails.referenceNo);
    setPurchaseDate(savedDetails.purchaseDate);
    setIsEditingDetails(false);
    clearActionState();
  }

  function toggleDetailsEdit() {
    if (isEditingDetails) {
      cancelDetailsEdit();
      return;
    }
    beginDetailsEdit();
  }

  function beginPaymentEdit() {
    clearActionState();
    setPaymentStatus(savedPayment.paymentStatus);
    setPaymentMethod(savedPayment.paymentMethod);
    setPaymentReference(savedPayment.paymentReference);
    setPaymentAmount('');
    setIsPaymentOpen(true);
    setIsEditingPayment(true);
  }

  function cancelPaymentEdit() {
    setPaymentStatus(savedPayment.paymentStatus);
    setPaymentMethod(savedPayment.paymentMethod);
    setPaymentReference(savedPayment.paymentReference);
    setPaymentAmount('');
    setIsEditingPayment(false);
    clearActionState();
  }

  function cancelReceiveEdit() {
    setReceiveNowByLine(new Map(record.lines.map((line) => [line.id, ''])));
    setBatchNumberByLine(
      new Map(
        record.lines.map((line, index) => [
          line.id,
          savedBatchNumberByLine.get(line.id) ||
            getSuggestedBatchNumber(record.purchaseDate, line.id, index),
        ]),
      ),
    );
    setIsEditingReceive(false);
    clearActionState();
  }

  function applyDetailsPreview() {
    clearActionState();

    if (!purchaseDate || Number.isNaN(new Date(purchaseDate).getTime())) {
      setActionError('Purchase date is invalid.');
      return;
    }

    const formData = new FormData();
    formData.set('recordId', record.id);
    formData.set('supplierName', supplierName);
    formData.set('referenceNo', referenceNo);
    formData.set('purchaseDate', purchaseDate);
    formData.set('notes', savedDetails.notes);

    setIsSavingDetails(true);
    void updateDetailsAction(formData)
      .then((result) => {
        if (result.error) {
          setActionError(result.error);
          setActionMessage('');
          return;
        }

        const nextDetails = {
          notes:
            typeof result.notes === 'string' ? result.notes : savedDetails.notes,
          purchaseDate:
            typeof result.purchaseDate === 'string'
              ? result.purchaseDate
              : purchaseDate,
          referenceNo:
            typeof result.referenceNo === 'string' ? result.referenceNo : referenceNo,
          supplierName:
            typeof result.supplierName === 'string' ? result.supplierName : supplierName,
        };
        setSavedDetails(nextDetails);
        setSupplierName(nextDetails.supplierName);
        setReferenceNo(nextDetails.referenceNo);
        setPurchaseDate(nextDetails.purchaseDate);
        if (result.timeline) setTimeline(result.timeline);
        setActionError('');
        setActionMessage(result.message ?? 'PO details saved.');
        setIsEditingDetails(false);
        router.refresh();
      })
      .catch(() => {
        setActionError('Failed to save PO details.');
        setActionMessage('');
      })
      .finally(() => {
        setIsSavingDetails(false);
      });
  }

  function confirmCancelPo() {
    clearActionState();

    const formData = new FormData();
    formData.set('recordId', record.id);

    setIsCancellingPo(true);
    void cancelAction(formData)
      .then((result) => {
        if (result.error) {
          setActionError(result.error);
          setActionMessage('');
          return;
        }

        setRecordStatus(result.status ?? PURCHASE_ORDER_STATUS.CANCELLED);
        if (result.timeline) setTimeline(result.timeline);
        setIsCancelModalOpen(false);
        setActionError('');
        setActionMessage(result.message ?? 'PO cancelled.');
        router.refresh();
      })
      .catch(() => {
        setActionError('Failed to cancel PO.');
        setActionMessage('');
      })
      .finally(() => {
        setIsCancellingPo(false);
      });
  }

  function applyReceivePreview() {
    clearActionState();

    const formData = new FormData();
    formData.set('recordId', record.id);
    let hasReceiveQuantity = false;

    for (const line of record.lines) {
      const rawReceiveQuantity = receiveNowByLine.get(line.id) ?? '';
      const receiveQuantity = Number(rawReceiveQuantity) || 0;
      const alreadyReceived = receivedByLine.get(line.id) ?? line.receivedQuantity;
      const remainingQuantity = Math.max(0, line.orderedQuantity - alreadyReceived);

      if (remainingQuantity === 0) continue;
      if (!rawReceiveQuantity.trim()) continue;

      if (
        !Number.isInteger(Number(rawReceiveQuantity)) ||
        Number(rawReceiveQuantity) < 0
      ) {
        setActionError('Received quantity must be a whole number.');
        return;
      }
      if (receiveQuantity > remainingQuantity) {
        setActionError(`Cannot receive more than ${remainingQuantity} unit(s).`);
        return;
      }
      if (receiveQuantity > 0) hasReceiveQuantity = true;

      formData.append('lineId', line.id);
      formData.append('receiveQuantity', rawReceiveQuantity);
    }

    if (!hasReceiveQuantity) {
      setActionError('Enter at least one received quantity.');
      return;
    }

    setIsSavingReceive(true);
    void receiveAction(formData)
      .then((result) => {
        if (result.error) {
          setActionError(result.error);
          setActionMessage('');
          return;
        }

        if (result.receivedByLine) {
          setReceivedByLine(new Map(result.receivedByLine));
        }
        if (result.batchNumberByLine) {
          const nextSavedBatchNumberByLine = new Map(
            result.batchNumberByLine.map(([lineId, batchNumber]) => [
              lineId,
              normalizeBatchNumberInput(batchNumber),
            ]),
          );
          setSavedBatchNumberByLine(nextSavedBatchNumberByLine);
          setBatchNumberByLine(
            new Map(
              record.lines.map((line, index) => [
                line.id,
                nextSavedBatchNumberByLine.get(line.id) ||
                  getSuggestedBatchNumber(record.purchaseDate, line.id, index),
              ]),
            ),
          );
        }
        if (result.status) setRecordStatus(result.status);
        if (result.timeline) setTimeline(result.timeline);
        setReceiveNowByLine(new Map(record.lines.map((line) => [line.id, ''])));
        setActionError('');
        setActionMessage(result.message ?? 'Received quantities saved.');
        setIsEditingReceive(false);
        router.refresh();
      })
      .catch(() => {
        setActionError('Failed to save received quantities.');
        setActionMessage('');
      })
      .finally(() => {
        setIsSavingReceive(false);
      });
  }

  function applyPaymentPreview() {
    clearActionState();

    const numericPaymentAmount =
      paymentStatus === PURCHASE_PAYMENT_STATUS.PAID
        ? recordTotalCost
        : paymentStatus === PURCHASE_PAYMENT_STATUS.PARTIAL_PAID
          ? Number(paymentAmount)
          : 0;

    if (paymentStatus !== PURCHASE_PAYMENT_STATUS.DUE && !paymentMethod) {
      setActionError('Payment method is required when payment is paid or partially paid.');
      return;
    }
    if (
      paymentStatus === PURCHASE_PAYMENT_STATUS.PARTIAL_PAID &&
      (isPartialPaymentAmountIncomplete || isPaymentAmountInvalid)
    ) {
      setActionError('Invalid paid amount.');
      return;
    }

    const formData = new FormData();
    formData.set('recordId', record.id);
    formData.set('paymentStatus', paymentStatus);
    formData.set('paymentMethod', paymentMethod);
    formData.set('paymentReference', paymentReference);
    formData.set('paidAmount', String(numericPaymentAmount));

    setIsSavingPayment(true);
    void payAction(formData)
      .then((result) => {
        if (result.error) {
          setActionError(result.error);
          setActionMessage('');
          return;
        }

        const nextPayment = {
          paidAmount:
            typeof result.paidAmount === 'number'
              ? result.paidAmount
              : numericPaymentAmount,
          paymentMethod:
            typeof result.paymentMethod === 'string'
              ? result.paymentMethod
              : paymentMethod,
          paymentReference:
            typeof result.paymentReference === 'string'
              ? result.paymentReference
              : paymentReference,
          paymentStatus: result.paymentStatus ?? paymentStatus,
        };
        setSavedPayment(nextPayment);
        setPaymentStatus(nextPayment.paymentStatus);
        setPaymentMethod(nextPayment.paymentMethod);
        setPaymentReference(nextPayment.paymentReference);
        setPaymentAmount('');
        if (result.status) setRecordStatus(result.status);
        if (result.timeline) setTimeline(result.timeline);
        setActionError('');
        setActionMessage(result.message ?? 'Payment saved.');
        setIsEditingPayment(false);
        router.refresh();
      })
      .catch(() => {
        setActionError('Failed to save payment.');
        setActionMessage('');
      })
      .finally(() => {
        setIsSavingPayment(false);
      });
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => event.preventDefault()}
    >
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs font-semibold text-slate-500">
              {record.orderNumber}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-slate-900">
                Purchase Order
              </h2>
              <button
                type="button"
                aria-label={
                  isEditingDetails ? 'Close PO section edit mode' : 'Edit PO section'
                }
                aria-pressed={isEditingDetails}
                disabled={!canToggleDetailsEdit}
                onClick={toggleDetailsEdit}
                title={isEditingDetails ? 'Close PO section edit mode' : 'Edit PO section'}
                className={`flex h-9 w-9 items-center justify-center rounded-xl border text-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  isEditingDetails
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <PencilIcon />
              </button>
              {isEditingDetails ? (
                <button
                  type="button"
                  disabled={isSavingDetails}
                  onClick={applyDetailsPreview}
                  className="rounded-xl bg-blue-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isSavingDetails ? 'Saving Edit...' : 'Save Edit'}
                </button>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                {lifecycleLabel}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                {formatPurchasePaymentStatus(paymentStatus)}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                {receivedTotal} / {record.totalQuantity} received
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!canCancelPo}
              onClick={() => {
                clearActionState();
                setIsCancelModalOpen(true);
              }}
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
            >
              Cancel PO
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="space-y-1.5 text-sm font-medium text-slate-700">
            <span>Supplier</span>
            <input
              readOnly={!isEditingDetails}
              placeholder="Supplier name"
              value={supplierName}
              onChange={(event) => setSupplierName(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-300 read-only:border-slate-200 read-only:bg-slate-100 read-only:text-slate-700"
            />
          </label>
          <label className="space-y-1.5 text-sm font-medium text-slate-700">
            <span>Invoice / Reference</span>
            <input
              readOnly={!isEditingDetails}
              placeholder="Invoice no."
              value={referenceNo}
              onChange={(event) => setReferenceNo(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-300 read-only:border-slate-200 read-only:bg-slate-100 read-only:text-slate-700"
            />
          </label>
          <label className="space-y-1.5 text-sm font-medium text-slate-700">
            <span>Purchase Date</span>
            <input
              readOnly={!isEditingDetails}
              type="date"
              value={purchaseDate}
              onChange={(event) => setPurchaseDate(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-300 read-only:border-slate-200 read-only:bg-slate-100 read-only:text-slate-700"
            />
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          aria-expanded={isProductListOpen}
          onClick={() => setIsProductListOpen((current) => !current)}
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
        >
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Product List</h3>
            <p className="mt-1 text-xs font-medium text-slate-500">
              {record.totalQuantity} units
              {canViewCost ? ` / ${formatMoney(recordTotalCost)}` : ''}
            </p>
          </div>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500">
            <ChevronIcon open={isProductListOpen} />
          </span>
        </button>

        {isProductListOpen ? (
          <div className="border-t border-slate-100 px-5 py-4">
            <div className="space-y-3">
              {record.lines.map((line) => (
                <div
                  key={line.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_110px_130px_130px] md:items-center">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
                        {line.imagePath ? (
                          <Image
                            src={line.imagePath}
                            alt={line.productName}
                            width={44}
                            height={44}
                            unoptimized
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {line.productName}
                        </p>
                        <p className="truncate text-xs font-medium text-slate-500">
                          {line.variantLabel} / {line.sku}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-500">Ordered</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {line.orderedQuantity}
                      </p>
                    </div>
                    <div>
                      {canViewCost ? (
                        <>
                          <p className="text-[11px] font-semibold text-slate-500">
                            Unit Cost
                          </p>
                          <p className="text-sm font-semibold text-slate-900">
                            {formatMoney(line.unitCost ?? 0)}
                          </p>
                        </>
                      ) : null}
                    </div>
                    <div className="md:text-right">
                      {canViewCost ? (
                        <>
                          <p className="text-[11px] font-semibold text-slate-500">
                            Total
                          </p>
                          <p className="text-sm font-semibold text-slate-900">
                            {formatMoney(line.lineTotal ?? 0)}
                          </p>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {canManagePayment ? (
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-stretch">
          <button
            type="button"
            aria-expanded={isPaymentOpen}
            onClick={() => setIsPaymentOpen((current) => !current)}
            className="flex min-w-0 flex-1 items-center justify-between gap-3 px-5 py-4 text-left"
          >
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-900">Payment</h3>
              <p className="mt-1 text-xs font-medium text-slate-500">
                {formatMoney(displayPayment.paidAmount)} paid / {formatMoney(payableAmount)} due
              </p>
            </div>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500">
              <ChevronIcon open={isPaymentOpen} />
            </span>
          </button>
          <div className="flex items-center gap-2 pr-5">
            {isEditingPayment ? (
              <>
                <button
                  type="button"
                  disabled={!canSavePayment}
                  title={paymentSaveBlockReason || undefined}
                  onClick={applyPaymentPreview}
                  className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isSavingPayment ? 'Saving Payment...' : 'Save Payment'}
                </button>
                <button
                  type="button"
                  disabled={isSavingPayment}
                  onClick={cancelPaymentEdit}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
              </>
            ) : null}
            <button
              type="button"
              aria-label="Edit payment"
              aria-pressed={isEditingPayment}
              disabled={!canTogglePaymentEdit}
              onClick={beginPaymentEdit}
              title="Edit payment"
              className={`flex h-10 w-10 items-center justify-center rounded-xl border text-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
                isEditingPayment
                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <PencilIcon />
            </button>
          </div>
        </div>

        {isPaymentOpen ? (
          <div className="border-t border-slate-100 px-5 py-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[150px_170px_minmax(160px,1fr)_130px_150px_150px] xl:items-end">
              <label className="space-y-1.5 text-xs font-semibold text-slate-600">
                <span>Payment</span>
                <select
                  disabled={!isEditingPayment}
                  value={paymentStatus}
                  onChange={(event) => {
                    const nextStatus = event.target.value;
                    setPaymentStatus(nextStatus);
                    if (nextStatus === PURCHASE_PAYMENT_STATUS.DUE) {
                      setPaymentMethod('');
                    }
                    setPaymentAmount('');
                  }}
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 py-0 text-sm text-slate-900 outline-none transition focus:border-blue-300 disabled:bg-slate-100 disabled:text-slate-500"
                >
                  <option value={PURCHASE_PAYMENT_STATUS.DUE}>Due</option>
                  <option value={PURCHASE_PAYMENT_STATUS.PARTIAL_PAID}>
                    Partially Paid
                  </option>
                  <option value={PURCHASE_PAYMENT_STATUS.PAID}>Paid</option>
                </select>
              </label>
              <label className="space-y-1.5 text-xs font-semibold text-slate-600">
                <span>Payment Method</span>
                <select
                  disabled={isPaymentMethodDisabled}
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 py-0 text-sm text-slate-900 outline-none transition focus:border-blue-300 disabled:bg-slate-100 disabled:text-slate-500"
                >
                  <option value="">Payment Method</option>
                  <option value="cash">Cash</option>
                  <option value="bank">Bank</option>
                  <option value="bkash">bKash</option>
                </select>
              </label>
              <label className="space-y-1.5 text-xs font-semibold text-slate-600">
                <span>Reference</span>
                <input
                  readOnly={!isEditingPayment}
                  value={paymentReference}
                  onChange={(event) => setPaymentReference(event.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none transition focus:border-blue-300 read-only:bg-slate-100 read-only:text-slate-500"
                />
              </label>
              <label className="space-y-1.5 text-xs font-semibold text-slate-600">
                <span>Paid</span>
                <input
                  readOnly
                  value={savedPaidAmount}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-slate-100 px-2 text-sm font-semibold text-slate-700 outline-none"
                />
              </label>
              <label className="space-y-1.5 text-xs font-semibold text-slate-600">
                <span>{paymentAmountLabel}</span>
                <input
                  readOnly={
                    !isEditingPayment ||
                    paymentStatus !== PURCHASE_PAYMENT_STATUS.PARTIAL_PAID
                  }
                  inputMode="decimal"
                  value={
                    paymentStatus === PURCHASE_PAYMENT_STATUS.PAID
                      ? getPaymentCompletionAmount({
                          savedPayment,
                          totalCost: recordTotalCost,
                        })
                      : isEditingPayment
                        ? paymentAmount
                        : displayPayment.paidAmount
                  }
                  onChange={(event) => setPaymentAmount(event.target.value)}
                  className={`h-9 w-full rounded-lg border bg-white px-2 text-sm text-slate-900 outline-none transition focus:border-blue-300 read-only:bg-slate-100 read-only:text-slate-500 ${
                    isPaymentAmountInvalid ? 'border-rose-400' : 'border-slate-300'
                  }`}
                />
              </label>
              <div
                className={`rounded-lg border bg-slate-50 px-3 py-1.5 ${
                  isPaymentAmountInvalid ? 'border-rose-300' : 'border-slate-200'
                }`}
              >
                <p className="flex items-center gap-1.5 text-[11px] font-semibold">
                  {isPaymentAmountInvalid ? (
                    <span className="text-rose-600">Invalid Amount</span>
                  ) : null}
                  <span className="text-slate-500">Payable</span>
                </p>
                <p className="truncate text-sm font-bold text-slate-900">
                  {formatMoney(payableAmount)}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Goods Receive</h3>
            <p className="mt-1 text-xs font-medium text-slate-500">
              {receivedTotal} received / {remainingTotal} left
            </p>
          </div>
          {isEditingReceive ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isSavingReceive}
                onClick={cancelReceiveEdit}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canSaveReceive}
                title={receiveSaveBlockReason || undefined}
                onClick={applyReceivePreview}
                className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isSavingReceive ? 'Saving Receive...' : 'Save Receive'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={!canStartReceiveEdit || remainingTotal === 0}
              onClick={() => {
                clearActionState();
                setIsEditingReceive(true);
              }}
              className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Receive
            </button>
          )}
        </div>

        <div className="space-y-3">
          {record.lines.map((line) => {
            const alreadyReceived = receivedByLine.get(line.id) ?? line.receivedQuantity;
            const batchNumber =
              batchNumberByLine.get(line.id) ??
              normalizeBatchNumberInput(line.batchNumber);
            const receiveNow = isEditingReceive
              ? Number(receiveNowByLine.get(line.id)) || 0
              : 0;
            const projectedReceived = Math.min(
              line.orderedQuantity,
              alreadyReceived + receiveNow,
            );
            const toReceive = Math.max(0, line.orderedQuantity - projectedReceived);
            const remainingQuantity = Math.max(0, line.orderedQuantity - alreadyReceived);
            const isLineFullyReceived = remainingQuantity === 0;

            return (
              <div
                key={line.id}
                className={`rounded-xl border p-3 ${
                  isLineFullyReceived
                    ? 'border-slate-200 bg-slate-100/80'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_135px_105px_105px_120px_120px] md:items-start">
                  <div className="min-w-0 space-y-1.5 text-xs font-semibold text-slate-600">
                    <span>Variant</span>
                    <div className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                        {line.imagePath ? (
                          <Image
                            src={line.imagePath}
                            alt={line.productName}
                            width={40}
                            height={40}
                            unoptimized
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {line.productName}
                        </p>
                        <p className="truncate text-xs font-medium text-slate-500">
                          {line.variantLabel} / {line.sku}
                        </p>
                      </div>
                    </div>
                  </div>
                  <label className="space-y-1.5 text-xs font-semibold text-slate-600">
                    <span>Batch Number</span>
                    <input
                      readOnly
                      value={formatBatchNumberDisplay(batchNumber)}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm font-semibold text-slate-700 outline-none"
                    />
                  </label>
                  <label className="space-y-1.5 text-xs font-semibold text-slate-600">
                    <span>Ordered</span>
                    <input
                      readOnly
                      value={line.orderedQuantity}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm font-semibold text-slate-700 outline-none"
                    />
                  </label>
                  <label className="space-y-1.5 text-xs font-semibold text-slate-600">
                    <span>Left</span>
                    <input
                      readOnly
                      value={toReceive}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm font-semibold text-slate-700 outline-none"
                    />
                  </label>
                  <label className="space-y-1.5 text-xs font-semibold text-slate-600">
                    <span>Received</span>
                    <input
                      readOnly
                      value={alreadyReceived}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm font-semibold text-slate-700 outline-none"
                    />
                  </label>
                  <label className="space-y-1.5 text-xs font-semibold text-slate-600">
                    <span className="flex items-center justify-between gap-2">
                      <span>Receive Now</span>
                      {isLineFullyReceived ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                          Full
                        </span>
                      ) : null}
                    </span>
                    <input
                      disabled={isLineFullyReceived}
                      readOnly={!isEditingReceive || isLineFullyReceived}
                      inputMode="numeric"
                      max={remainingQuantity}
                      value={
                        isLineFullyReceived
                          ? '0'
                          : isEditingReceive
                            ? receiveNowByLine.get(line.id) ?? ''
                            : '0'
                      }
                      onChange={(event) => updateReceiveNow(line.id, event.target.value)}
                      className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-300 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:font-semibold disabled:text-slate-500 read-only:border-slate-200 read-only:bg-slate-100 read-only:font-semibold read-only:text-slate-700"
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <AdminTimelinePanel
        addNoteAction={noteAction}
        deleteNoteAction={deleteNoteAction}
        editNoteAction={editNoteAction}
        noteAddedMessage="PO note added."
        notePlaceholder="Add a new PO note"
        noteUpdatedMessage="PO note updated."
        recordId={record.id}
        timeline={timeline}
      />

      {isCancelModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div
            aria-modal="true"
            role="dialog"
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
          >
            <h3 className="text-base font-semibold text-slate-900">Cancel PO</h3>
            <p className="mt-2 text-sm font-medium text-slate-600">
              Are you sure you want to cancel this Purchase Order?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={isCancellingPo}
                onClick={() => setIsCancelModalOpen(false)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                No
              </button>
              <button
                type="button"
                disabled={isCancellingPo}
                onClick={confirmCancelPo}
                className="rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isCancellingPo ? 'Cancelling...' : 'Yes'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {actionError ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {actionError}
        </p>
      ) : null}
      {actionMessage ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
          {actionMessage}
        </p>
      ) : null}
    </form>
  );
}
