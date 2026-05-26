import type { Metadata } from 'next';
import Script from 'next/script';
import AppFrame from '@/components/AppFrame';
import { businessData } from '@/lib/business-data';
import { getBusinessProfile, getStorefrontCategories } from '@/lib/storefront-data';
import './globals.css';

function getSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || businessData.websiteUrl;

  try {
    const url = new URL(configuredUrl);
    if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
      return new URL(businessData.websiteUrl);
    }
    return url;
  } catch {
    return new URL(businessData.websiteUrl);
  }
}

const siteUrl = getSiteUrl();

export async function generateMetadata(): Promise<Metadata> {
  const businessProfile = await getBusinessProfile();
  const name = businessProfile.businessName || businessData.name;
  const title = businessProfile.metaTitle || businessData.siteTitle;
  const description = businessProfile.metaDescription || businessData.description;
  const socialImageUrl = new URL(
    businessProfile.ogImageUrl || businessData.ogImage,
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
  const [businessProfile, categoryData] = await Promise.all([
    getBusinessProfile(),
    getStorefrontCategories(),
  ]);

  return (
    <html lang="en" data-scroll-behavior="smooth" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-white">
        <Script id="strip-extension-button-attrs" strategy="beforeInteractive">
          {`
            (() => {
              const attributeName = 'fdprocessedid';

              const stripAttribute = (root) => {
                if (!root) return;

                if (root.nodeType === Node.ELEMENT_NODE && root.hasAttribute?.(attributeName)) {
                  root.removeAttribute(attributeName);
                }

                root.querySelectorAll?.('[' + attributeName + ']').forEach((element) => {
                  element.removeAttribute(attributeName);
                });
              };

              stripAttribute(document.documentElement);

              const observer = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                  if (mutation.type === 'attributes') {
                    stripAttribute(mutation.target);
                    continue;
                  }

                  mutation.addedNodes.forEach(stripAttribute);
                }
              });

              observer.observe(document.documentElement, {
                attributeFilter: [attributeName],
                attributes: true,
                childList: true,
                subtree: true,
              });

              window.addEventListener('load', () => {
                window.setTimeout(() => observer.disconnect(), 5000);
              }, { once: true });
            })();
          `}
        </Script>
        <AppFrame
          businessProfile={businessProfile}
          catalogCategories={categoryData.categories}
        >
          {children}
        </AppFrame>
      </body>
    </html>
  );
}
