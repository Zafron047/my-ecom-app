'use client';

import { useMemo, useState } from 'react';
import type { AdminRole } from '@/lib/admin-rbac';

type ManageRolesUser = {
  createdAt: string;
  email: string;
  id: string;
  isActive: boolean;
  lastSeenAt: string | null;
  name: string;
  role: AdminRole;
};

type ManageRolesPanelProps = {
  currentAdminId: string;
  users: ManageRolesUser[];
};

type RowBusyState = {
  isTogglingActive: boolean;
  isUpdatingRole: boolean;
};

const roleOptions: AdminRole[] = ['admin', 'manager', 'support'];

function formatRole(role: AdminRole): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function formatDate(value: string | null): string {
  if (!value) return 'Never';
  return new Date(value).toLocaleString();
}

export default function ManageRolesPanel({
  currentAdminId,
  users,
}: ManageRolesPanelProps) {
  const [rows, setRows] = useState(users);
  const [pendingRole, setPendingRole] = useState<Record<string, AdminRole>>(() =>
    Object.fromEntries(users.map((user) => [user.id, user.role])),
  );
  const [busyByRow, setBusyByRow] = useState<Record<string, RowBusyState>>({});
  const [feedback, setFeedback] = useState<{
    kind: 'error' | 'success';
    message: string;
  } | null>(null);

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) => {
        if (a.role === 'admin' && b.role !== 'admin') return -1;
        if (a.role !== 'admin' && b.role === 'admin') return 1;
        return a.email.localeCompare(b.email);
      }),
    [rows],
  );

  function setRowBusy(id: string, patch: Partial<RowBusyState>) {
    setBusyByRow((prev) => ({
      ...prev,
      [id]: {
        isTogglingActive: prev[id]?.isTogglingActive ?? false,
        isUpdatingRole: prev[id]?.isUpdatingRole ?? false,
        ...patch,
      },
    }));
  }

  async function patchAdminUser(
    userId: string,
    payload: { isActive?: boolean; role?: AdminRole },
  ) {
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as {
      error?: string;
      user?: ManageRolesUser;
    };

    if (!response.ok || !data.user) {
      throw new Error(data.error ?? 'Failed to update user.');
    }

    const updatedUser = data.user;
    setRows((prev) => prev.map((user) => (user.id === userId ? updatedUser : user)));
    setPendingRole((prev) => ({ ...prev, [userId]: updatedUser.role }));
    return updatedUser;
  }

  async function handleRoleUpdate(userId: string) {
    setFeedback(null);
    const role = pendingRole[userId];
    if (!role) return;

    setRowBusy(userId, { isUpdatingRole: true });
    try {
      const updated = await patchAdminUser(userId, { role });
      setFeedback({
        kind: 'success',
        message: `Updated ${updated.email} to ${formatRole(updated.role)}.`,
      });
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Role update failed.',
      });
    } finally {
      setRowBusy(userId, { isUpdatingRole: false });
    }
  }

  async function handleToggleActive(userId: string, isActive: boolean) {
    setFeedback(null);

    setRowBusy(userId, { isTogglingActive: true });
    try {
      const updated = await patchAdminUser(userId, { isActive: !isActive });
      setFeedback({
        kind: 'success',
        message: `${updated.email} is now ${updated.isActive ? 'active' : 'inactive'}.`,
      });
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Status update failed.',
      });
    } finally {
      setRowBusy(userId, { isTogglingActive: false });
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Manage Roles</h2>
        <p className="mt-1 text-sm text-slate-600">
          Change admin role and active status. Role changes are logged in audit
          history.
        </p>
      </div>

      {feedback && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            feedback.kind === 'error'
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {feedback.message}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Last Seen</th>
              <th className="px-3 py-2">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedRows.map((user) => {
              const busy = busyByRow[user.id];
              const isSelf = user.id === currentAdminId;
              return (
                <tr key={user.id} className="align-top">
                  <td className="px-3 py-3">
                    <p className="font-medium text-slate-900">
                      {user.name}{' '}
                      {isSelf && (
                        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-blue-700">
                          You
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">{user.email}</p>
                  </td>

                  <td className="px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={pendingRole[user.id] ?? user.role}
                        onChange={(event) =>
                          setPendingRole((prev) => ({
                            ...prev,
                            [user.id]: event.target.value as AdminRole,
                          }))
                        }
                        disabled={busy?.isUpdatingRole}
                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-blue-300"
                      >
                        {roleOptions.map((role) => (
                          <option key={role} value={role}>
                            {formatRole(role)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={busy?.isUpdatingRole || pendingRole[user.id] === user.role}
                        onClick={() => handleRoleUpdate(user.id)}
                        className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busy?.isUpdatingRole ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </td>

                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(user.id, user.isActive)}
                      disabled={busy?.isTogglingActive}
                      className={`rounded-md border px-2 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        user.isActive
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {busy?.isTogglingActive
                        ? 'Updating...'
                        : user.isActive
                          ? 'Active'
                          : 'Inactive'}
                    </button>
                  </td>

                  <td className="px-3 py-3 text-xs text-slate-600">
                    {formatDate(user.lastSeenAt)}
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-600">
                    {formatDate(user.createdAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
