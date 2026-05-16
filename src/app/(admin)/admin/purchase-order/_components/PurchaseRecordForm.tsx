'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  PURCHASE_PAYMENT_STATUS,
  formatPurchasePaymentStatus,
  getPurchaseEntryLifecycleLabel,
} from '@/lib/purchase-order-status';

type PurchaseRecordLine = {
  batchNumber: string;
  id: string;
  imagePath: string | null;
  lineTotal: number;
  orderedQuantity: number;
  productName: string;
  receivedQuantity: number;
  sku: string;
  unitCost: number;
  variantLabel: string;
};

type PurchaseRecord = {
  entryNumber: string;
  id: string;
  lines: PurchaseRecordLine[];
  notes: string;
  paidAmount: number;
  paymentMethod: string;
  paymentReference: string;
  paymentStatus: string;
  purchaseDate: string;
  referenceNo: string;
  status: string;
  supplierName: string;
  totalCost: number;
  totalQuantity: number;
};

type PurchaseRecordFormProps = {
  payAction: (formData: FormData) => Promise<PurchaseRecordActionState>;
  receiveAction: (formData: FormData) => Promise<PurchaseRecordActionState>;
  record: PurchaseRecord;
};

type PurchaseRecordActionState = {
  error?: string;
  message?: string;
  paidAmount?: number;
  paymentMethod?: string;
  paymentReference?: string;
  paymentStatus?: string;
  receivedByLine?: Array<[string, number]>;
  status?: string;
};

type PaymentSnapshot = {
  paidAmount: number;
  paymentMethod: string;
  paymentReference: string;
  paymentStatus: string;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-BD', {
    currency: 'BDT',
    maximumFractionDigits: 2,
    style: 'currency',
  }).format(value);
}

function getInitialPaidAmount(record: PurchaseRecord) {
  return record.paidAmount;
}

function createPaymentSnapshot(record: PurchaseRecord): PaymentSnapshot {
  return {
    paidAmount: getInitialPaidAmount(record),
    paymentMethod: record.paymentMethod,
    paymentReference: record.paymentReference,
    paymentStatus: record.paymentStatus || PURCHASE_PAYMENT_STATUS.DUE,
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
  payAction,
  receiveAction,
  record,
}: PurchaseRecordFormProps) {
  const router = useRouter();
  const initialPayment = createPaymentSnapshot(record);
  const [recordStatus, setRecordStatus] = useState(record.status);
  const [isProductListOpen, setIsProductListOpen] = useState(true);
  const [isPaymentOpen, setIsPaymentOpen] = useState(true);
  const [isEditingPayment, setIsEditingPayment] = useState(false);
  const [isEditingReceive, setIsEditingReceive] = useState(false);
  const [savedPayment, setSavedPayment] = useState(initialPayment);
  const [paymentStatus, setPaymentStatus] = useState(initialPayment.paymentStatus);
  const [paymentMethod, setPaymentMethod] = useState(initialPayment.paymentMethod);
  const [paymentReference, setPaymentReference] = useState(
    initialPayment.paymentReference,
  );
  const [paymentAmount, setPaymentAmount] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [isSavingReceive, setIsSavingReceive] = useState(false);
  const [receivedByLine, setReceivedByLine] = useState(() =>
    new Map(record.lines.map((line) => [line.id, line.receivedQuantity])),
  );
  const [receiveNowByLine, setReceiveNowByLine] = useState(() =>
    new Map(record.lines.map((line) => [line.id, '0'])),
  );

  const displayPayment = isEditingPayment
    ? {
        paidAmount: getPreviewPaidAmountForStatus({
          paymentAmount,
          paymentStatus,
          savedPayment,
          totalCost: record.totalCost,
        }),
        paymentStatus,
      }
    : {
        paidAmount: getSavedPaidAmountForStatus({
          paymentStatus: savedPayment.paymentStatus,
          savedPaidAmount: savedPayment.paidAmount,
          totalCost: record.totalCost,
        }),
        paymentStatus: savedPayment.paymentStatus,
      };
  const savedPaidAmount = getSavedPaidAmountForStatus({
    paymentStatus: savedPayment.paymentStatus,
    savedPaidAmount: savedPayment.paidAmount,
    totalCost: record.totalCost,
  });
  const payableAmount = Math.max(0, record.totalCost - displayPayment.paidAmount);
  const receivedTotal = useMemo(
    () =>
      record.lines.reduce(
        (sum, line) => sum + (receivedByLine.get(line.id) ?? line.receivedQuantity),
        0,
      ),
    [receivedByLine, record.lines],
  );
  const remainingTotal = Math.max(0, record.totalQuantity - receivedTotal);
  const lifecycleLabel = getPurchaseEntryLifecycleLabel({
    paymentStatus: displayPayment.paymentStatus,
    receivedQuantity: receivedTotal,
    status: recordStatus,
    totalQuantity: record.totalQuantity,
  });

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

  function cancelPaymentEdit() {
    setPaymentStatus(savedPayment.paymentStatus);
    setPaymentMethod(savedPayment.paymentMethod);
    setPaymentReference(savedPayment.paymentReference);
    setPaymentAmount('');
    setIsEditingPayment(false);
    clearActionState();
  }

  function cancelReceiveEdit() {
    setReceiveNowByLine(new Map(record.lines.map((line) => [line.id, '0'])));
    setIsEditingReceive(false);
    clearActionState();
  }

  function fillFullReceive() {
    setReceiveNowByLine(
      new Map(
        record.lines.map((line) => {
          const alreadyReceived = receivedByLine.get(line.id) ?? line.receivedQuantity;
          return [line.id, String(Math.max(0, line.orderedQuantity - alreadyReceived))];
        }),
      ),
    );
  }

  function applyReceivePreview() {
    clearActionState();

    const formData = new FormData();
    formData.set('recordId', record.id);
    let hasReceiveQuantity = false;

    for (const line of record.lines) {
      const rawReceiveQuantity = receiveNowByLine.get(line.id) ?? '0';
      const receiveQuantity = Number(rawReceiveQuantity) || 0;
      const alreadyReceived = receivedByLine.get(line.id) ?? line.receivedQuantity;
      const remainingQuantity = Math.max(0, line.orderedQuantity - alreadyReceived);

      if (
        rawReceiveQuantity.trim() &&
        (!Number.isInteger(Number(rawReceiveQuantity)) ||
          Number(rawReceiveQuantity) < 0)
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
        if (result.status) setRecordStatus(result.status);
        setReceiveNowByLine(new Map(record.lines.map((line) => [line.id, '0'])));
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
        ? record.totalCost
        : paymentStatus === PURCHASE_PAYMENT_STATUS.PARTIAL_PAID
          ? Number(paymentAmount)
          : 0;
    const nextPaidAmount =
      paymentStatus === PURCHASE_PAYMENT_STATUS.PARTIAL_PAID
        ? getPaymentBaseAmount({
            requestedPaymentStatus: paymentStatus,
            savedPayment,
          }) + numericPaymentAmount
        : numericPaymentAmount;

    if (paymentStatus !== PURCHASE_PAYMENT_STATUS.DUE && !paymentMethod) {
      setActionError('Payment method is required when payment is paid or partially paid.');
      return;
    }
    if (
      paymentStatus === PURCHASE_PAYMENT_STATUS.PARTIAL_PAID &&
      (!Number.isFinite(numericPaymentAmount) ||
        numericPaymentAmount <= 0 ||
        nextPaidAmount >= record.totalCost)
    ) {
      setActionError(
        'Partial payment must be greater than 0 and leave payable amount due.',
      );
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
              {record.entryNumber}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">
              Purchase Order
            </h2>
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
          <Link
            href="/admin/purchase-order"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Back to POs
          </Link>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="space-y-1.5 text-sm font-medium text-slate-700">
            <span>Supplier</span>
            <input
              readOnly
              value={record.supplierName}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm text-slate-700 outline-none"
            />
          </label>
          <label className="space-y-1.5 text-sm font-medium text-slate-700">
            <span>Invoice / Reference</span>
            <input
              readOnly
              value={record.referenceNo}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm text-slate-700 outline-none"
            />
          </label>
          <label className="space-y-1.5 text-sm font-medium text-slate-700">
            <span>Purchase Date</span>
            <input
              readOnly
              value={record.purchaseDate}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm text-slate-700 outline-none"
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
              {record.totalQuantity} units / {formatMoney(record.totalCost)}
            </p>
          </div>
          <span className="text-lg font-semibold text-slate-500">
            {isProductListOpen ? '-' : '+'}
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
                      <p className="text-[11px] font-semibold text-slate-500">
                        Unit Cost
                      </p>
                      <p className="text-sm font-semibold text-slate-900">
                        {formatMoney(line.unitCost)}
                      </p>
                    </div>
                    <div className="md:text-right">
                      <p className="text-[11px] font-semibold text-slate-500">Total</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {formatMoney(line.lineTotal)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          aria-expanded={isPaymentOpen}
          onClick={() => setIsPaymentOpen((current) => !current)}
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
        >
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Payment</h3>
            <p className="mt-1 text-xs font-medium text-slate-500">
              {formatMoney(displayPayment.paidAmount)} paid / {formatMoney(payableAmount)} due
            </p>
          </div>
          <span className="text-lg font-semibold text-slate-500">
            {isPaymentOpen ? '-' : '+'}
          </span>
        </button>

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
                    setPaymentAmount('');
                  }}
                  className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-300 disabled:bg-slate-100 disabled:text-slate-500"
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
                  disabled={!isEditingPayment}
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-300 disabled:bg-slate-100 disabled:text-slate-500"
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
                  className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-300 read-only:bg-slate-100 read-only:text-slate-500"
                />
              </label>
              <label className="space-y-1.5 text-xs font-semibold text-slate-600">
                <span>Paid</span>
                <input
                  readOnly
                  value={savedPaidAmount}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm font-semibold text-slate-700 outline-none"
                />
              </label>
              <label className="space-y-1.5 text-xs font-semibold text-slate-600">
                <span>Payment Amount</span>
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
                          totalCost: record.totalCost,
                        })
                      : isEditingPayment
                        ? paymentAmount
                        : displayPayment.paidAmount
                  }
                  onChange={(event) => setPaymentAmount(event.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-300 read-only:bg-slate-100 read-only:text-slate-500"
                />
              </label>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] font-semibold text-slate-500">Payable</p>
                <p className="truncate text-sm font-bold text-slate-900">
                  {formatMoney(payableAmount)}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              {isEditingPayment ? (
                <>
                  <button
                    type="button"
                    disabled={isSavingPayment}
                    onClick={cancelPaymentEdit}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSavingPayment}
                    onClick={applyPaymentPreview}
                    className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {isSavingPayment ? 'Saving Payment...' : 'Save Payment'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={isSavingPayment || isSavingReceive}
                  onClick={() => {
                    clearActionState();
                    setPaymentStatus(savedPayment.paymentStatus);
                    setPaymentMethod(savedPayment.paymentMethod);
                    setPaymentReference(savedPayment.paymentReference);
                    setPaymentAmount('');
                    setIsEditingPayment(true);
                  }}
                  className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  Update
                </button>
              )}
            </div>
          </div>
        ) : null}
      </section>

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
                disabled={isSavingReceive || remainingTotal === 0}
                onClick={fillFullReceive}
                className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
              >
                Full Receive
              </button>
              <button
                type="button"
                disabled={isSavingReceive || remainingTotal === 0}
                onClick={applyReceivePreview}
                className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isSavingReceive ? 'Saving Receive...' : 'Save Receive'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={isSavingPayment || isSavingReceive || remainingTotal === 0}
              onClick={() => {
                clearActionState();
                setIsEditingReceive(true);
              }}
              className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Update
            </button>
          )}
        </div>

        <div className="space-y-3">
          {record.lines.map((line) => {
            const alreadyReceived = receivedByLine.get(line.id) ?? line.receivedQuantity;
            const receiveNow = isEditingReceive
              ? Number(receiveNowByLine.get(line.id)) || 0
              : 0;
            const projectedReceived = Math.min(
              line.orderedQuantity,
              alreadyReceived + receiveNow,
            );
            const toReceive = Math.max(0, line.orderedQuantity - projectedReceived);

            return (
              <div
                key={line.id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-3"
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
                      value={line.batchNumber}
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
                    <span>Receive Now</span>
                    <input
                      readOnly={!isEditingReceive}
                      inputMode="numeric"
                      max={Math.max(0, line.orderedQuantity - alreadyReceived)}
                      value={isEditingReceive ? receiveNowByLine.get(line.id) ?? '0' : '0'}
                      onChange={(event) => updateReceiveNow(line.id, event.target.value)}
                      className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-300 read-only:border-slate-200 read-only:bg-slate-100 read-only:font-semibold read-only:text-slate-700"
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="block space-y-1.5 text-sm font-medium text-slate-700">
          <span>Notes</span>
          <textarea
            readOnly
            rows={3}
            value={record.notes}
            className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-700 outline-none"
          />
        </label>
      </section>

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
