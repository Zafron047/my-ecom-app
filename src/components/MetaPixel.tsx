'use client';

import { trackMetaBrowserAndServerEvent } from '@/lib/meta-pixel';
import { isPublicStorefrontMarketingPath } from '@/lib/meta-routes';
import { usePathname, useSearchParams } from 'next/navigation';
import Script from 'next/script';
import { Suspense, useEffect, useRef } from 'react';

const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;

function MetaPageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTrackedUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pixelId) return;
    if (!isPublicStorefrontMarketingPath(pathname)) return;

    const currentUrl = `${pathname}?${searchParams.toString()}`;
    if (lastTrackedUrlRef.current === currentUrl) return;
    lastTrackedUrlRef.current = currentUrl;

    trackMetaBrowserAndServerEvent({
      eventName: 'PageView',
      sendServer: true,
    });
  }, [pathname, searchParams]);

  return null;
}

export default function MetaPixel() {
  const pathname = usePathname();

  if (!pixelId) return null;
  if (!isPublicStorefrontMarketingPath(pathname)) return null;

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${pixelId}');
        `}
      </Script>
      <Suspense fallback={null}>
        <MetaPageViewTracker />
      </Suspense>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}
