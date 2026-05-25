'use client';

import { usePathname } from 'next/navigation';
import { CartProvider } from '@/components/CartProvider';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MetaPixel from '@/components/MetaPixel';
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
  catalogCategories,
  children,
}: {
  businessProfile: StorefrontBusinessProfile;
  catalogCategories: string[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const shouldUseStorefrontFrame = isStorefrontPath(pathname);

  if (!shouldUseStorefrontFrame) {
    return <main className="min-h-full">{children}</main>;
  }

  return (
    <CartProvider>
      <MetaPixel />
      <Header
        businessProfile={businessProfile}
        catalogCategories={catalogCategories}
      />
      <main className="flex-1 pt-[5.75rem] sm:pt-[6.25rem] lg:pt-[6.75rem]">
        {children}
      </main>
      <Footer businessProfile={businessProfile} />
    </CartProvider>
  );
}

