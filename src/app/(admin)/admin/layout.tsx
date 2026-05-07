import AdminShell from '@/components/admin/AdminShell';
import { requireAdminSession } from '@/lib/admin-session';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdminSession('/admin', {
    allowPasswordResetRequired: true,
  });

  return <AdminShell session={session}>{children}</AdminShell>;
}
