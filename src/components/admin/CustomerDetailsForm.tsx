'use client';

import { useState, useTransition } from 'react';
import { updateCustomerDetailsAction } from '@/app/(admin)/admin/customers/[id]/actions';

type CustomerFormData = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  division: string;
  district: string;
  thana: string;
  address: string;
  customerType: string;
  identifierTag: string;
  behaviorTags: string[];
  notes: string;
  isBlocked: boolean;
};

type CustomerDetailsFormProps = {
  initialCustomer: CustomerFormData;
};

const behaviorOptions = [
  'HIGH_VALUE_BUYER',
  'PREPAID_BUYER',
  'BULK_BUYER',
  'DISCOUNT_SEEKER',
];

export default function CustomerDetailsForm({
  initialCustomer,
}: CustomerDetailsFormProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [customer, setCustomer] = useState(initialCustomer);
  const [draft, setDraft] = useState(initialCustomer);

  function toggleBehavior(tag: string) {
    setDraft((prev) => {
      const hasTag = prev.behaviorTags.includes(tag);
      return {
        ...prev,
        behaviorTags: hasTag
          ? prev.behaviorTags.filter((item) => item !== tag)
          : [...prev.behaviorTags, tag],
      };
    });
  }

  function handleCancel() {
    setDraft(customer);
    setIsEditing(false);
    setError('');
  }

  function handleUpdate() {
    setError('');
    startTransition(async () => {
      try {
        const updated = await updateCustomerDetailsAction(customer.id, {
          firstName: draft.firstName,
          lastName: draft.lastName,
          email: draft.email,
          phone: draft.phone,
          division: draft.division,
          district: draft.district,
          thana: draft.thana,
          address: draft.address,
          customerType: draft.customerType,
          identifierTag: draft.identifierTag,
          behaviorTags: draft.behaviorTags,
          notes: draft.notes,
          isBlocked: draft.isBlocked,
        });
        setCustomer(updated);
        setDraft(updated);
        setIsEditing(false);
      } catch (actionError) {
        setError(
          actionError instanceof Error
            ? actionError.message
            : 'Unable to update customer.',
        );
      }
    });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900">Customer Details</h3>
        {!isEditing ? (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
            aria-label="Edit customer details"
          >
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
              <path d="M14.69 2.86a1.5 1.5 0 0 1 2.12 2.12l-8.3 8.3-3.35.85.84-3.35 8.7-7.92Zm-9 9.6 1.86 1.86" />
            </svg>
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-slate-600">
          First Name
          <input
            type="text"
            value={draft.firstName}
            disabled={!isEditing}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, firstName: event.target.value }))
            }
            className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-900 disabled:bg-slate-50"
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Last Name
          <input
            type="text"
            value={draft.lastName}
            disabled={!isEditing}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, lastName: event.target.value }))
            }
            className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-900 disabled:bg-slate-50"
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Email
          <input
            type="email"
            value={draft.email}
            disabled={!isEditing}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, email: event.target.value }))
            }
            className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-900 disabled:bg-slate-50"
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Phone
          <input
            type="text"
            value={draft.phone}
            disabled={!isEditing}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, phone: event.target.value }))
            }
            className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-900 disabled:bg-slate-50"
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Division
          <input
            type="text"
            value={draft.division}
            disabled={!isEditing}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, division: event.target.value }))
            }
            className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-900 disabled:bg-slate-50"
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          District
          <input
            type="text"
            value={draft.district}
            disabled={!isEditing}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, district: event.target.value }))
            }
            className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-900 disabled:bg-slate-50"
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Thana / Upozila
          <input
            type="text"
            value={draft.thana}
            disabled={!isEditing}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, thana: event.target.value }))
            }
            className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-900 disabled:bg-slate-50"
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Detailed Address
          <input
            type="text"
            value={draft.address}
            disabled={!isEditing}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, address: event.target.value }))
            }
            className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-900 disabled:bg-slate-50"
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Customer Type
          <select
            value={draft.customerType}
            disabled={!isEditing}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, customerType: event.target.value }))
            }
            className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-900 disabled:bg-slate-50"
          >
            <option value="retail">Retail</option>
            <option value="reseller">Reseller</option>
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          Identifier Tag
          <select
            value={draft.identifierTag}
            disabled={!isEditing}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, identifierTag: event.target.value }))
            }
            className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-900 disabled:bg-slate-50"
          >
            <option value="NEW">NEW</option>
            <option value="RISING">RISING</option>
            <option value="PRIORITY">PRIORITY</option>
            <option value="HIGH_PRIORITY">HIGH PRIORITY</option>
            <option value="RISKY">RISKY</option>
            <option value="HIGH_RISKY">HIGH RISKY</option>
          </select>
        </label>
      </div>

      <div className="mt-4">
        <p className="text-xs font-medium text-slate-600">Behavior Tags</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {behaviorOptions.map((tag) => {
            const isSelected = draft.behaviorTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                disabled={!isEditing}
                onClick={() => toggleBehavior(tag)}
                className={`rounded-md border px-2 py-1 text-xs font-medium transition ${
                  isSelected
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-700'
                } disabled:opacity-60`}
              >
                {tag.replaceAll('_', ' ')}
              </button>
            );
          })}
        </div>
      </div>

      <label className="mt-4 block text-xs font-medium text-slate-600">
        Notes
        <textarea
          rows={4}
          value={draft.notes}
          disabled={!isEditing}
          onChange={(event) =>
            setDraft((prev) => ({ ...prev, notes: event.target.value }))
          }
          className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-900 disabled:bg-slate-50"
        />
      </label>

      <label className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-slate-700">
        <input
          type="checkbox"
          checked={draft.isBlocked}
          disabled={!isEditing}
          onChange={(event) =>
            setDraft((prev) => ({ ...prev, isBlocked: event.target.checked }))
          }
        />
        Block customer
      </label>

      {error ? <p className="mt-3 text-xs font-medium text-rose-600">{error}</p> : null}

      {isEditing ? (
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
  );
}
