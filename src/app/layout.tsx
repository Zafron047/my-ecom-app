import type { Metadata } from 'next';
import { CartProvider } from '@/components/CartProvider';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
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
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-white">
        <CartProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
