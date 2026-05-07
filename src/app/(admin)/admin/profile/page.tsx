import AdminPasswordPanel from '@/components/admin/AdminPasswordPanel';
import { requireAdminSession } from '@/lib/admin-session';

type AdminProfilePageProps = {
  searchParams: Promise<{ forcePasswordReset?: string }>;
};

export default async function AdminProfilePage({
  searchParams,
}: AdminProfilePageProps) {
  const session = await requireAdminSession('/admin/profile', {
    allowPasswordResetRequired: true,
  });
  const params = await searchParams;

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Profile</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Name</dt>
            <dd className="font-medium text-slate-900">{session.name}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Email</dt>
            <dd className="font-medium text-slate-900">{session.email}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Role</dt>
            <dd className="font-medium capitalize text-slate-900">
              {session.role}
            </dd>
          </div>
        </dl>
      </div>

      <AdminPasswordPanel
        forcePasswordReset={params.forcePasswordReset === '1'}
        mustResetPassword={session.mustResetPassword}
      />
    </section>
  );
}

