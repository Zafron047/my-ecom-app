import CustomerForgotPasswordForm from '@/components/CustomerForgotPasswordForm';
import { Suspense } from 'react';

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="w-full max-w-md text-center text-sm text-gray-600">Loading reset form...</div>}>
      <CustomerForgotPasswordForm />
    </Suspense>
  );
}
