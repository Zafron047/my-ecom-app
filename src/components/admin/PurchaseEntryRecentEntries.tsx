'use client';

import { useState } from 'react';
import { Fragment } from 'react';

type RecentPurchaseEntryLine = {
  batchNumber: string;
  lineTotal: string;
  productName: string;
  quantity: number;
  sku: string;
  unitCost: string;
  variantLabel: string;
};

type RecentPurchaseEntry = {
  entryNumber: string;
  lines: RecentPurchaseEntryLine[];
  paymentMethod: string | null;
  paymentReference: string | null;
  paymentStatus: string;
  purchaseDate: string;
  status: string;
  supplierName: string | null;
  totalCost: string;
  totalQuantity: number;
};

type PurchaseEntryRecentEntriesProps = {
  entries: RecentPurchaseEntry[];
};

function formatEntryStatus(status: string) {
  const labels: Record<string, string> = {
    cancelled: 'Cancelled',
    closed_short: 'Closed Short',
    draft: 'Draft',
    full_received: 'Full Received',
    partial_received: 'Partial Received',
    received: 'Received',
    recorded: 'Confirmed',
  };
  return labels[status] ?? status.replace(/_/g, ' ');
}

function formatPaymentStatus(status: string) {
  const labels: Record<string, string> = {
    due: 'Due',
    paid: 'Paid',
    partial_paid: 'Partially Paid',
  };
  return labels[status] ?? status.replace(/_/g, ' ');
}

function getStatusTone(status: string) {
  if (status === 'draft') return 'bg-amber-50 text-amber-700';
  if (status === 'cancelled') return 'bg-rose-50 text-rose-700';
  if (status === 'recorded' || status === 'partial_received') {
    return 'bg-blue-50 text-blue-700';
  }
  return 'bg-emerald-50 text-emerald-700';
}

export default function PurchaseEntryRecentEntries({
  entries,
}: PurchaseEntryRecentEntriesProps) {
  const [openEntryNumber, setOpenEntryNumber] = useState<string | null>(null);

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          <tr>
            <th className="px-3 py-3">Entry</th>
            <th className="px-3 py-3">Status</th>
            <th className="px-3 py-3">Supplier</th>
            <th className="px-3 py-3">Payment</th>
            <th className="px-3 py-3">Date</th>
            <th className="px-3 py-3 text-right">Units</th>
            <th className="px-3 py-3 text-right">Cost</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {entries.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                No purchase entries yet.
              </td>
            </tr>
          ) : (
            entries.map((entry) => {
              const isOpen = openEntryNumber === entry.entryNumber;

              return (
                <Fragment key={entry.entryNumber}>
                  <tr
                    className="cursor-pointer transition hover:bg-slate-50"
                    onClick={() =>
                      setOpenEntryNumber((current) =>
                        current === entry.entryNumber ? null : entry.entryNumber,
                      )
                    }
                  >
                    <td className="px-3 py-3 font-mono text-xs text-slate-700">
                      <span className="mr-2 inline-block w-3 text-slate-400">
                        {isOpen ? '-' : '+'}
                      </span>
                      {entry.entryNumber}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold capitalize ${getStatusTone(
                          entry.status,
                        )}`}
                      >
                        {formatEntryStatus(entry.status)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      {entry.supplierName || '-'}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      <div className="font-semibold text-slate-800">
                        {formatPaymentStatus(entry.paymentStatus)}
                      </div>
                      <div className="text-xs capitalize text-slate-500">
                        {entry.paymentMethod || '-'}
                        {entry.paymentReference ? ` / ${entry.paymentReference}` : ''}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-600">{entry.purchaseDate}</td>
                    <td className="px-3 py-3 text-right font-semibold text-slate-900">
                      {entry.totalQuantity}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-slate-900">
                      {entry.totalCost}
                    </td>
                  </tr>
                  {isOpen ? (
                    <tr>
                      <td colSpan={7} className="bg-slate-50 px-3 py-3">
                        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                          <table className="min-w-full divide-y divide-slate-100 text-xs">
                            <thead className="bg-white text-left font-semibold uppercase tracking-wide text-slate-500">
                              <tr>
                                <th className="px-3 py-2">Product</th>
                                <th className="px-3 py-2">Variant</th>
                                <th className="px-3 py-2">Batch</th>
                                <th className="px-3 py-2 text-right">Qty</th>
                                <th className="px-3 py-2 text-right">Unit Cost</th>
                                <th className="px-3 py-2 text-right">Line Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {entry.lines.map((line, index) => (
                                <tr key={`${entry.entryNumber}-${line.batchNumber}-${index}`}>
                                  <td className="px-3 py-2 font-medium text-slate-900">
                                    {line.productName}
                                  </td>
                                  <td className="px-3 py-2 text-slate-600">
                                    <div>{line.variantLabel}</div>
                                    <div className="font-mono text-[10px] text-slate-400">
                                      {line.sku}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2 font-mono text-[10px] text-slate-500">
                                    {line.batchNumber}
                                  </td>
                                  <td className="px-3 py-2 text-right font-semibold text-slate-900">
                                    {line.quantity}
                                  </td>
                                  <td className="px-3 py-2 text-right text-slate-700">
                                    {line.unitCost}
                                  </td>
                                  <td className="px-3 py-2 text-right font-semibold text-slate-900">
                                    {line.lineTotal}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
