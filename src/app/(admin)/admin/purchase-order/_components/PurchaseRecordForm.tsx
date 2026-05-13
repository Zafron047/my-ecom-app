'use client';

import { useMemo, useState } from 'react';

type PurchaseRecordLine = {
  id: string;
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
  lines: PurchaseRecordLine[];
  notes: string;
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
  record: PurchaseRecord;
};

type EditMode = 'view' | 'receive' | 'pay';

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-BD', {
    currency: 'BDT',
    maximumFractionDigits: 2,
    style: 'currency',
  }).format(value);
}

function formatStatus(status: string) {
  const labels: Record<string, string> = {
    cancelled: 'Cancelled',
    closed_short: 'Closed Short',
    full_received: 'Full Received',
    partial_received: 'Partial Received',
    received: 'Received',
    recorded: 'Recorded',
  };
  return labels[status] ?? status.replace(/_/g, ' ');
}

function getInitialPaidAmount(record: PurchaseRecord) {
  if (record.paymentStatus === 'paid') return record.totalCost;
  return 0;
}

export default function PurchaseRecordForm({ record }: PurchaseRecordFormProps) {
  const [mode, setMode] = useState<EditMode>('view');
  const [paymentStatus, setPaymentStatus] = useState(record.paymentStatus || 'due');
  const [paymentMethod, setPaymentMethod] = useState(record.paymentMethod);
  const [paymentReference, setPaymentReference] = useState(record.paymentReference);
  const [paidAmount, setPaidAmount] = useState(String(getInitialPaidAmount(record)));
  const [receivedByLine, setReceivedByLine] = useState(() =>
    new Map(record.lines.map((line) => [line.id, line.receivedQuantity])),
  );
  const [receiveNowByLine, setReceiveNowByLine] = useState(() =>
    new Map(record.lines.map((line) => [line.id, '0'])),
  );

  const numericPaidAmount =
    paymentStatus === 'paid'
      ? record.totalCost
      : paymentStatus === 'partial_paid'
        ? Number(paidAmount) || 0
        : 0;
  const payableAmount = Math.max(0, record.totalCost - numericPaidAmount);
  const receivedTotal = useMemo(
    () =>
      record.lines.reduce(
        (sum, line) => sum + (receivedByLine.get(line.id) ?? line.receivedQuantity),
        0,
      ),
    [receivedByLine, record.lines],
  );
  const remainingTotal = Math.max(0, record.totalQuantity - receivedTotal);
  const isFullyReceived = remainingTotal === 0;
  const isFullyPaid = paymentStatus === 'paid' || payableAmount === 0;
  const settlementLabel =
    isFullyReceived && isFullyPaid
      ? 'Ready to Close'
      : isFullyReceived
        ? 'Payment Open'
        : isFullyPaid
          ? 'Receiving Open'
          : 'Open';

  function updateReceiveNow(lineId: string, rawValue: string) {
    setReceiveNowByLine((current) => {
      const next = new Map(current);
      next.set(lineId, rawValue);
      return next;
    });
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
    setReceivedByLine((current) => {
      const next = new Map(current);
      for (const line of record.lines) {
        const alreadyReceived = next.get(line.id) ?? line.receivedQuantity;
        const receiveNow = Number(receiveNowByLine.get(line.id)) || 0;
        next.set(line.id, Math.min(line.orderedQuantity, alreadyReceived + receiveNow));
      }
      return next;
    });
    setReceiveNowByLine(new Map(record.lines.map((line) => [line.id, '0'])));
    setMode('view');
  }

  function applyPaymentPreview() {
    if (paymentStatus === 'paid') setPaidAmount(String(record.totalCost));
    if (paymentStatus === 'due') setPaidAmount('0');
    setMode('view');
  }

  return (
    <form className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs font-semibold text-slate-500">
              {record.entryNumber}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">
              Purchase Record
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                {formatStatus(record.status)}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                {settlementLabel}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {mode === 'view' ? (
              <>
                <button
                  type="button"
                  onClick={() => setMode('receive')}
                  className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                >
                  Receive
                </button>
                <button
                  type="button"
                  onClick={() => setMode('pay')}
                  className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-600"
                >
                  Pay
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setMode('view')}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
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

        <div className="mt-4 grid gap-2 rounded-lg border border-slate-200 bg-slate-50/70 p-2 md:grid-cols-[150px_150px_minmax(160px,1fr)_150px_150px] md:items-end">
          <label className="min-w-0 space-y-0.5 text-[11px] font-semibold text-slate-600">
            <span>Payment</span>
            <select
              disabled={mode !== 'pay'}
              value={paymentStatus}
              onChange={(event) => {
                const nextStatus = event.target.value;
                setPaymentStatus(nextStatus);
                if (nextStatus === 'paid') setPaidAmount(String(record.totalCost));
                if (nextStatus === 'due') setPaidAmount('0');
              }}
              className="h-8 w-full rounded-lg border border-slate-300 bg-white px-1.5 py-0 text-[12px] leading-4 text-slate-900 outline-none transition focus:border-blue-300 disabled:bg-slate-100 disabled:text-slate-500"
            >
              <option value="due">Due</option>
              <option value="partial_paid">Partially Paid</option>
              <option value="paid">Paid</option>
            </select>
          </label>
          <label className="min-w-0 space-y-0.5 text-[11px] font-semibold text-slate-600">
            <span>Method</span>
            <select
              disabled={mode !== 'pay'}
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
              className="h-8 w-full rounded-lg border border-slate-300 bg-white px-1.5 py-0 text-[12px] leading-4 text-slate-900 outline-none transition focus:border-blue-300 disabled:bg-slate-100 disabled:text-slate-500"
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
              readOnly={mode !== 'pay'}
              value={paymentReference}
              onChange={(event) => setPaymentReference(event.target.value)}
              className="h-8 w-full rounded-lg border border-slate-300 bg-white px-1.5 py-0 text-[12px] leading-4 text-slate-900 outline-none transition focus:border-blue-300 read-only:bg-slate-100 read-only:text-slate-500"
            />
          </label>
          <label className="min-w-0 space-y-0.5 text-[11px] font-semibold text-slate-600">
            <span>Paid Amount</span>
            <input
              readOnly={mode !== 'pay' || paymentStatus !== 'partial_paid'}
              type="number"
              min={0}
              step="0.01"
              value={paymentStatus === 'paid' ? record.totalCost : paidAmount}
              onChange={(event) => setPaidAmount(event.target.value)}
              className="h-8 w-full rounded-lg border border-slate-300 bg-white px-1.5 py-0 text-[12px] leading-4 text-slate-900 outline-none transition focus:border-blue-300 read-only:bg-slate-100 read-only:text-slate-500"
            />
          </label>
          <div className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Payable
            </p>
            <p className="truncate text-sm font-bold text-slate-900">
              {formatMoney(payableAmount)}
            </p>
          </div>
        </div>

        {mode === 'pay' ? (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={applyPaymentPreview}
              className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-600"
            >
              Save Payment
            </button>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-900">Items</h3>
          <div className="text-sm text-slate-600">
            <span className="font-semibold text-slate-900">{receivedTotal}</span>{' '}
            received /{' '}
            <span className="font-semibold text-slate-900">{remainingTotal}</span>{' '}
            to receive
          </div>
        </div>

        <div className="space-y-3">
          {record.lines.map((line) => {
            const alreadyReceived = receivedByLine.get(line.id) ?? line.receivedQuantity;
            const receiveNow = mode === 'receive' ? Number(receiveNowByLine.get(line.id)) || 0 : 0;
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
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_120px_120px_120px_150px] md:items-start">
                  <div className="min-w-0 space-y-1.5 text-xs font-semibold text-slate-600">
                    <span>Variant</span>
                    <div className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {line.productName}
                      </p>
                      <p className="truncate text-xs font-medium text-slate-500">
                        {line.variantLabel} / {line.sku}
                      </p>
                    </div>
                  </div>
                  <label className="space-y-1.5 text-xs font-semibold text-slate-600">
                    <span>Ordered</span>
                    <input
                      readOnly
                      value={line.orderedQuantity}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm font-semibold text-slate-700 outline-none"
                    />
                  </label>
                  <label className="space-y-1.5 text-xs font-semibold text-slate-600">
                    <span>To Receive</span>
                    <input
                      readOnly
                      value={toReceive}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm font-semibold text-slate-700 outline-none"
                    />
                  </label>
                  <label className="space-y-1.5 text-xs font-semibold text-slate-600">
                    <span>Received</span>
                    <input
                      readOnly={mode !== 'receive'}
                      type="number"
                      min={0}
                      max={Math.max(0, line.orderedQuantity - alreadyReceived)}
                      value={
                        mode === 'receive'
                          ? receiveNowByLine.get(line.id) ?? '0'
                          : alreadyReceived
                      }
                      onChange={(event) => updateReceiveNow(line.id, event.target.value)}
                      className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-300 read-only:border-slate-200 read-only:bg-slate-100 read-only:font-semibold read-only:text-slate-700"
                    />
                  </label>
                  <label className="space-y-1.5 text-xs font-semibold text-slate-600">
                    <span>Unit Cost</span>
                    <input
                      readOnly
                      value={formatMoney(line.unitCost)}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm font-semibold text-slate-700 outline-none"
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        {mode === 'receive' ? (
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={fillFullReceive}
              className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
            >
              Full Receive
            </button>
            <button
              type="button"
              onClick={applyReceivePreview}
              className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-600"
            >
              Save Receive
            </button>
          </div>
        ) : null}
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
    </form>
  );
}
