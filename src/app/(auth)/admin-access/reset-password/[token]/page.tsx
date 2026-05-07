import AdminResetPasswordForm from '@/components/admin/AdminResetPasswordForm';

type AdminResetPasswordPageProps = {
  params: Promise<{ token: string }>;
};

export default async function AdminResetPasswordPage({
  params,
}: AdminResetPasswordPageProps) {
  const { token } = await params;

  return <AdminResetPasswordForm token={token} />;
}
