import type { Metadata } from 'next';
import AppFrame from '@/components/AppFrame';
import { getBusinessProfile } from '@/lib/storefront-data';
import './globals.css';

const siteName = 'BDBuyEasy';
const siteTitle = 'BDBuyEasy - Trending AliExpress Finds';
const siteDescription =
  'Shop trending gadgets, home finds, accessories, and everyday AliExpress picks.';
const fallbackSiteUrl = 'https://bdbuyeasy.com.bd';

function getSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || fallbackSiteUrl;

  try {
    const url = new URL(configuredUrl);
    if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
      return new URL(fallbackSiteUrl);
    }
    return url;
  } catch {
    return new URL(fallbackSiteUrl);
  }
}

const siteUrl = getSiteUrl();

export async function generateMetadata(): Promise<Metadata> {
  const businessProfile = await getBusinessProfile();
  const name = businessProfile.businessName || siteName;
  const title = businessProfile.metaTitle || siteTitle;
  const description = businessProfile.metaDescription || siteDescription;
  const socialImageUrl = new URL(
    businessProfile.ogImageUrl || '/og-image.png',
    siteUrl,
  ).toString();

  return {
    metadataBase: siteUrl,
    title: {
      default: title,
      template: `%s | ${name}`,
    },
    description,
    applicationName: name,
    alternates: {
      canonical: '/',
    },
    keywords: businessProfile.metaKeywords
      ?.split(',')
      .map((keyword) => keyword.trim())
      .filter(Boolean),
    openGraph: {
      type: 'website',
      locale: 'en_US',
      url: siteUrl.toString(),
      siteName: name,
      title,
      description,
      images: [
        {
          url: socialImageUrl,
          width: 1200,
          height: 630,
          alt: `${name} social preview`,
          type: 'image/png',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [
        {
          url: socialImageUrl,
          alt: `${name} social preview`,
        },
      ],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
    icons: {
      icon: businessProfile.logoUrl,
      shortcut: businessProfile.logoUrl,
      apple: businessProfile.logoUrl,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const businessProfile = await getBusinessProfile();

  return (
    <html lang="en" data-scroll-behavior="smooth" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-white">
        <AppFrame businessProfile={businessProfile}>{children}</AppFrame>
      </body>
    </html>
  );
}
