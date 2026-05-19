import CustomerResetPasswordForm from '@/components/CustomerResetPasswordForm';

type ResetPasswordPageProps = {
  params: Promise<{ token: string }>;
};

export default async function ResetPasswordPage({
  params,
}: ResetPasswordPageProps) {
  const { token } = await params;

  return <CustomerResetPasswordForm token={token} />;
}
