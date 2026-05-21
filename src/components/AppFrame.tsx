'use client';

import { usePathname } from 'next/navigation';
import { CartProvider } from '@/components/CartProvider';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import type { StorefrontBusinessProfile } from '@/lib/storefront-types';

function isStorefrontPath(pathname: string) {
  return !(
    pathname.startsWith('/admin') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register')
  );
}

export default function AppFrame({
  businessProfile,
  children,
}: {
  businessProfile: StorefrontBusinessProfile;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const shouldUseStorefrontFrame = isStorefrontPath(pathname);

  if (!shouldUseStorefrontFrame) {
    return <main className="min-h-full">{children}</main>;
  }

  return (
    <CartProvider>
      <Header businessProfile={businessProfile} />
      <main className="flex-1">{children}</main>
      <Footer businessProfile={businessProfile} />
    </CartProvider>
  );
}

