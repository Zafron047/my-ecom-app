'use client';

import { useMemo, useState } from 'react';
import {
  type AdminRole,
  canAssignAdminRole,
  canManageAdminUser,
  formatAdminRole,
  getAssignableAdminRoles,
} from '@/lib/admin-rbac';

type ManageRolesUser = {
  createdAt: string;
  email: string;
  id: string;
  isActive: boolean;
  lastSeenAt: string | null;
  mustResetPassword: boolean;
  name: string;
  passwordUpdatedAt: string | null;
  phone: string | null;
  role: AdminRole;
};

type ManageRolesAuditLog = {
  action: string;
  actorLabel: string | null;
  createdAt: string;
  entityType: string;
  id: string;
  ipAddress: string | null;
  message: string | null;
};

type ManageRolesPanelProps = {
  auditLogs: ManageRolesAuditLog[];
  currentAdminId: string;
  currentAdminRole: AdminRole;
  users: ManageRolesUser[];
};

type RowBusyState = {
  isResettingPassword: boolean;
  isRevokingSessions: boolean;
  isTogglingActive: boolean;
  isUpdatingRole: boolean;
};

function formatDate(value: string | null): string {
  if (!value) return 'Never';
  return new Date(value).toLocaleString();
}

export default function ManageRolesPanel({
  auditLogs,
  currentAdminId,
  currentAdminRole,
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
  const [createForm, setCreateForm] = useState({
    email: '',
    name: '',
    phone: '',
    role: 'support' as AdminRole,
  });
  const [isCreating, setIsCreating] = useState(false);
  const roleOptions = useMemo(
    () => getAssignableAdminRoles(currentAdminRole),
    [currentAdminRole],
  );

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) => {
        if (a.role === 'supaAdmin' && b.role !== 'supaAdmin') return -1;
        if (a.role !== 'supaAdmin' && b.role === 'supaAdmin') return 1;
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
        isResettingPassword: prev[id]?.isResettingPassword ?? false,
        isRevokingSessions: prev[id]?.isRevokingSessions ?? false,
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

  async function handleCreateUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setIsCreating(true);

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createForm),
      });

      const data = (await response.json()) as {
        emailSent?: boolean;
        error?: string;
        resetExpiresAt?: string;
        user?: ManageRolesUser;
      };

      if (!response.ok || !data.user || !data.resetExpiresAt) {
        throw new Error(data.error ?? 'Failed to create admin user.');
      }

      const createdUser = data.user;
      setRows((prev) => [...prev, createdUser]);
      setPendingRole((prev) => ({
        ...prev,
        [createdUser.id]: createdUser.role,
      }));
      setCreateForm({ email: '', name: '', phone: '', role: 'support' });
      setFeedback({
        kind: 'success',
        message: data.emailSent
          ? `Created ${createdUser.email} and emailed the setup link.`
          : `Created ${createdUser.email}.`,
      });
    } catch (error) {
      setFeedback({
        kind: 'error',
        message:
          error instanceof Error ? error.message : 'Admin user creation failed.',
      });
    } finally {
      setIsCreating(false);
    }
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
        message: `Updated ${updated.email} to ${formatAdminRole(updated.role)}.`,
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

  async function handlePasswordReset(user: ManageRolesUser) {
    setFeedback(null);
    setRowBusy(user.id, { isResettingPassword: true });

    try {
      const response = await fetch(`/api/admin/users/${user.id}/password-reset`, {
        method: 'POST',
      });
      const data = (await response.json()) as {
        emailSent?: boolean;
        error?: string;
        resetExpiresAt?: string;
      };

      if (!response.ok || !data.resetExpiresAt) {
        throw new Error(data.error ?? 'Failed to create reset link.');
      }

      setRows((prev) =>
        prev.map((row) =>
          row.id === user.id ? { ...row, mustResetPassword: true } : row,
        ),
      );
      setFeedback({
        kind: 'success',
        message: data.emailSent
          ? `Sent password reset email to ${user.email}.`
          : `Created password reset link for ${user.email}.`,
      });
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Password reset failed.',
      });
    } finally {
      setRowBusy(user.id, { isResettingPassword: false });
    }
  }

  async function handleRevokeSessions(user: ManageRolesUser) {
    setFeedback(null);
    setRowBusy(user.id, { isRevokingSessions: true });

    try {
      const response = await fetch(`/api/admin/users/${user.id}/sessions/revoke`, {
        method: 'POST',
      });
      const data = (await response.json()) as {
        error?: string;
        revokedCount?: number;
      };

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to revoke sessions.');
      }

      setFeedback({
        kind: 'success',
        message: `Revoked ${data.revokedCount ?? 0} active session(s) for ${user.email}.`,
      });
    } catch (error) {
      setFeedback({
        kind: 'error',
        message:
          error instanceof Error ? error.message : 'Session revocation failed.',
      });
    } finally {
      setRowBusy(user.id, { isRevokingSessions: false });
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Admin Access</h2>
          <p className="mt-1 text-sm text-slate-600">
            Create staff, update roles, reset passwords, and revoke sessions.
          </p>
        </div>

        {feedback && (
          <div
            className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
              feedback.kind === 'error'
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
            }`}
          >
            {feedback.message}
          </div>
        )}

        <form
          onSubmit={handleCreateUser}
          className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_160px_auto]"
        >
          <div>
            <label
              htmlFor="adminName"
              className="mb-1 block text-xs font-semibold uppercase text-slate-500"
            >
              Name
            </label>
            <input
              id="adminName"
              value={createForm.name}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, name: event.target.value }))
              }
              required
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
            />
          </div>

          <div>
            <label
              htmlFor="adminEmail"
              className="mb-1 block text-xs font-semibold uppercase text-slate-500"
            >
              Email
            </label>
            <input
              id="adminEmail"
              type="email"
              value={createForm.email}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, email: event.target.value }))
              }
              required
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
            />
          </div>

          <div>
            <label
              htmlFor="adminPhone"
              className="mb-1 block text-xs font-semibold uppercase text-slate-500"
            >
              Mobile
            </label>
            <input
              id="adminPhone"
              type="tel"
              value={createForm.phone}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, phone: event.target.value }))
              }
              placeholder="017XXXXXXXX"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
            />
          </div>

          <div>
            <label
              htmlFor="adminRole"
              className="mb-1 block text-xs font-semibold uppercase text-slate-500"
            >
              Role
            </label>
            <select
              id="adminRole"
              value={createForm.role}
              onChange={(event) =>
                setCreateForm((prev) => ({
                  ...prev,
                  role: event.target.value as AdminRole,
                }))
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
            >
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {formatAdminRole(role)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end md:col-span-2 xl:col-span-1">
            <button
              type="submit"
              disabled={isCreating}
              className="w-full rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Password</th>
              <th className="px-3 py-2">Sessions</th>
              <th className="px-3 py-2">Last Seen</th>
              <th className="px-3 py-2">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedRows.map((user) => {
              const busy = busyByRow[user.id];
              const isSelf = user.id === currentAdminId;
              const canManageUser = canManageAdminUser(currentAdminRole, user.role);
              const selectableRoles = roleOptions.includes(user.role)
                ? roleOptions
                : [user.role, ...roleOptions];
              const selectedRole = pendingRole[user.id] ?? user.role;
              const canSaveRole =
                canManageUser &&
                selectedRole !== user.role &&
                canAssignAdminRole(currentAdminRole, selectedRole);
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
                    {user.phone && (
                      <p className="text-xs text-slate-500">{user.phone}</p>
                    )}
                  </td>

                  <td className="px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={selectedRole}
                        onChange={(event) =>
                          setPendingRole((prev) => ({
                            ...prev,
                            [user.id]: event.target.value as AdminRole,
                          }))
                        }
                        disabled={busy?.isUpdatingRole || !canManageUser}
                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-blue-300"
                      >
                        {selectableRoles.map((role) => (
                          <option key={role} value={role}>
                            {formatAdminRole(role)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={
                          busy?.isUpdatingRole || !canSaveRole
                        }
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
                      disabled={busy?.isTogglingActive || !canManageUser}
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

                  <td className="px-3 py-3">
                    <div className="space-y-1">
                      <span
                        className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${
                          user.mustResetPassword
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {user.mustResetPassword ? 'Reset due' : 'Current'}
                      </span>
                      <p className="text-xs text-slate-500">
                        Updated {formatDate(user.passwordUpdatedAt)}
                      </p>
                      <button
                        type="button"
                        onClick={() => handlePasswordReset(user)}
                        disabled={
                          busy?.isResettingPassword || !user.isActive || !canManageUser
                        }
                        className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busy?.isResettingPassword ? 'Creating...' : 'Reset'}
                      </button>
                    </div>
                  </td>

                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => handleRevokeSessions(user)}
                      disabled={busy?.isRevokingSessions || !canManageUser}
                      className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busy?.isRevokingSessions ? 'Revoking...' : 'Logout all'}
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

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Auth Audit</h2>
        </div>
        <table className="mt-4 min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Time</th>
              <th className="px-3 py-2">Actor</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Message</th>
              <th className="px-3 py-2">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {auditLogs.length > 0 ? (
              auditLogs.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-3 py-3 text-xs text-slate-600">
                    {formatDate(entry.createdAt)}
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-600">
                    {entry.actorLabel ?? 'System'}
                  </td>
                  <td className="px-3 py-3 text-xs font-semibold text-slate-700">
                    {entry.action}
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-700">
                    {entry.message ?? entry.entityType}
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-600">
                    {entry.ipAddress ?? '-'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-3 py-6 text-center text-slate-500" colSpan={5}>
                  No auth audit entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
