import Image from 'next/image';
import Link from 'next/link';
import type { StorefrontBusinessProfile } from '@/lib/storefront-types';

export default function Footer({
  businessProfile,
}: {
  businessProfile: StorefrontBusinessProfile;
}) {
  const currentYear = new Date().getFullYear();
  const footerAssurances = [
    'Cash on Delivery',
    'Fast Nationwide delivery',
    'Secure checkout',
    'Problem-solving finds',
  ];

  return (
    <footer className="border-t border-zinc-200/80 bg-[#f7f7f5] text-zinc-950">
      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        <div className="border border-zinc-200/70 bg-white/70 shadow-[0_12px_34px_rgba(24,24,27,0.035)]">
          <div className="flex flex-col gap-4 px-5 py-5 sm:px-6 sm:py-6">
            <div className="grid gap-5 md:grid-cols-[1.15fr_1fr] md:items-start">
              <div className="flex flex-col items-start gap-3.5 text-left">
                <div className="flex items-center gap-3">
                <Link href="/" className="inline-flex items-center rounded-md transition duration-300 hover:opacity-85 focus:outline-none focus:ring-4 focus:ring-zinc-950/10">
                  <div className="relative grid h-12 w-16 place-items-center rounded-md bg-zinc-950 px-1.5 ring-1 ring-zinc-950/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/wowmall-logo-header-transparent.png"
                      alt={businessProfile.logoAlt}
                      className="h-auto w-full object-contain"
                    />
                  </div>
                </Link>
                <div>
                  <p className="text-[0.64rem] font-medium uppercase tracking-[0.18em] text-zinc-500">
                    {businessProfile.businessName}
                  </p>
                  <p className="mt-1 max-w-md text-sm font-normal leading-6 text-zinc-600">
                    Curated products that solve real everyday friction points.
                  </p>
                </div>
              </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                  {footerAssurances.map((assurance) => (
                    <span
                      key={assurance}
                      className="border-b border-zinc-200/80 pb-0.5 text-[0.62rem] font-medium uppercase tracking-[0.1em] text-zinc-500"
                    >
                      {assurance}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-start gap-2 text-sm font-medium text-zinc-700 md:justify-end">
                <a
                  href="#"
                  className="rounded-md border border-zinc-200/80 bg-white/60 px-3 py-1.5 text-zinc-600 transition duration-300 hover:border-zinc-300 hover:bg-zinc-950 hover:text-white focus:outline-none focus:ring-4 focus:ring-zinc-950/10"
                >
                  Support
                </a>
                <a
                  href="#"
                  className="rounded-md border border-zinc-200/80 bg-white/60 px-3 py-1.5 text-zinc-600 transition duration-300 hover:border-zinc-300 hover:bg-zinc-950 hover:text-white focus:outline-none focus:ring-4 focus:ring-zinc-950/10"
                >
                  Delivery
                </a>
                <a
                  href={businessProfile.facebookUrl || businessProfile.websiteUrl || '#'}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${businessProfile.businessName} Facebook`}
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200/80 bg-white/60 text-zinc-500 transition duration-300 hover:border-zinc-300 hover:bg-zinc-950 hover:text-white focus:outline-none focus:ring-4 focus:ring-zinc-950/10"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M13.5 21v-7h2.35l.35-2.74H13.5V9.51c0-.79.22-1.33 1.36-1.33h1.45V5.73c-.25-.03-1.12-.11-2.12-.11-2.1 0-3.53 1.28-3.53 3.64v2h-2.37V14h2.37v7h2.84Z" />
                  </svg>
                </a>
                <a
                  href={businessProfile.instagramUrl || '#'}
                  aria-label="Instagram"
                  target={businessProfile.instagramUrl ? '_blank' : undefined}
                  rel={businessProfile.instagramUrl ? 'noreferrer' : undefined}
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200/80 bg-white/60 text-zinc-500 transition duration-300 hover:border-zinc-300 hover:bg-zinc-950 hover:text-white focus:outline-none focus:ring-4 focus:ring-zinc-950/10"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M7.75 3h8.5A4.75 4.75 0 0 1 21 7.75v8.5A4.75 4.75 0 0 1 16.25 21h-8.5A4.75 4.75 0 0 1 3 16.25v-8.5A4.75 4.75 0 0 1 7.75 3Zm0 1.8A2.95 2.95 0 0 0 4.8 7.75v8.5a2.95 2.95 0 0 0 2.95 2.95h8.5a2.95 2.95 0 0 0 2.95-2.95v-8.5a2.95 2.95 0 0 0-2.95-2.95h-8.5Zm8.95 1.35a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2ZM12 7.6A4.4 4.4 0 1 1 7.6 12 4.4 4.4 0 0 1 12 7.6Zm0 1.8A2.6 2.6 0 1 0 14.6 12 2.6 2.6 0 0 0 12 9.4Z" />
                  </svg>
                </a>
              </div>
            </div>

            <div className="h-px w-full bg-zinc-200/70" />

            <div className="flex flex-wrap items-center justify-between gap-3 text-center">
              <span className="text-xs font-normal text-zinc-500 sm:text-sm">
                (c) {currentYear} {businessProfile.businessName}. All rights reserved.
              </span>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
              <a
                href="https://zafron.me"
                target="_blank"
                rel="noreferrer"
                aria-label="Zafron"
                className="inline-flex transition duration-300 hover:opacity-80 focus:outline-none focus:ring-4 focus:ring-zinc-950/10"
              >
                <div className="relative h-8 w-8 overflow-hidden rounded-full ring-1 ring-zinc-200">
                  <Image
                    src="/zafron.webp"
                    alt="Zafron"
                    fill
                    sizes="40px"
                    className="object-cover"
                  />
                </div>
              </a>
              <span className="text-xs font-normal text-zinc-500 sm:text-sm">
                Designed and developed by
              </span>
              <a
                href="https://zafron.me"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center border-b border-zinc-300 px-0.5 py-0.5 text-xs font-medium text-zinc-600 transition duration-300 hover:border-zinc-950 hover:text-zinc-950 focus:outline-none focus:ring-4 focus:ring-zinc-950/10 sm:text-sm"
              >
                Zafron
              </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

