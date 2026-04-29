import type { Metadata } from 'next';
import AppFrame from '@/components/AppFrame';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://shopeasy.com.bd'),
  title: 'Shop Easy - Trending AliExpress Finds',
  description:
    'Shop trending gadgets, home finds, accessories, and everyday AliExpress picks.',
  alternates: {
    canonical: '/',
  },
  icons: {
    icon: '/shop-easy-logo.svg',
    shortcut: '/shop-easy-logo.svg',
    apple: '/shop-easy-logo.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-white">
        <AppFrame>{children}</AppFrame>
      </body>
    </html>
  );
}
