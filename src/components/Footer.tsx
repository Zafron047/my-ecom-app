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
    'Fast Dhaka delivery',
    'Secure checkout',
    'Practical home finds',
  ];

  return (
    <footer className="border-t border-zinc-200 bg-[linear-gradient(180deg,#f7f7f8_0%,#fff_100%)] text-zinc-950">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-[0_24px_70px_rgba(24,24,27,0.08)]">
          <div className="flex flex-col gap-6 px-5 py-6 sm:px-7 sm:py-7">
            <div className="grid gap-6 md:grid-cols-[1.2fr_1fr] md:items-start">
              <div className="flex flex-col items-start gap-4 text-left">
                <div className="flex items-center gap-3">
                <Link href="/" className="inline-flex items-center">
                  <div className="relative h-11 w-[5.4rem] overflow-hidden rounded-xl bg-white ring-1 ring-zinc-900/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={businessProfile.logoUrl}
                      alt={businessProfile.logoAlt}
                      className="h-full w-full object-contain"
                    />
                  </div>
                </Link>
                <div>
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                    {businessProfile.businessName}
                  </p>
                  <p className="mt-1 max-w-md text-sm font-medium leading-6 text-zinc-600">
                    Kitchen, decor and daily essentials selected for simpler
                    home routines.
                  </p>
                </div>
              </div>
                <div className="flex flex-wrap gap-2">
                  {footerAssurances.map((assurance) => (
                    <span
                      key={assurance}
                      className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-zinc-600"
                    >
                      {assurance}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-start gap-3 text-sm font-semibold text-zinc-700 md:justify-end">
                <a
                  href="#"
                  className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-zinc-700 transition duration-300 hover:-translate-y-0.5 hover:border-zinc-300 hover:bg-zinc-950 hover:text-white"
                >
                  Support
                </a>
                <a
                  href="#"
                  className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-zinc-700 transition duration-300 hover:-translate-y-0.5 hover:border-zinc-300 hover:bg-zinc-950 hover:text-white"
                >
                  Delivery
                </a>
                <a
                  href={businessProfile.facebookUrl || businessProfile.websiteUrl || '#'}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${businessProfile.businessName} Facebook`}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 transition duration-300 hover:-translate-y-0.5 hover:border-zinc-300 hover:bg-zinc-950 hover:text-white"
                >
                  <svg
                    className="h-4 w-4"
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
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 transition duration-300 hover:-translate-y-0.5 hover:border-zinc-300 hover:bg-zinc-950 hover:text-white"
                >
                  <svg
                    className="h-4 w-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M7.75 3h8.5A4.75 4.75 0 0 1 21 7.75v8.5A4.75 4.75 0 0 1 16.25 21h-8.5A4.75 4.75 0 0 1 3 16.25v-8.5A4.75 4.75 0 0 1 7.75 3Zm0 1.8A2.95 2.95 0 0 0 4.8 7.75v8.5a2.95 2.95 0 0 0 2.95 2.95h8.5a2.95 2.95 0 0 0 2.95-2.95v-8.5a2.95 2.95 0 0 0-2.95-2.95h-8.5Zm8.95 1.35a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2ZM12 7.6A4.4 4.4 0 1 1 7.6 12 4.4 4.4 0 0 1 12 7.6Zm0 1.8A2.6 2.6 0 1 0 14.6 12 2.6 2.6 0 0 0 12 9.4Z" />
                  </svg>
                </a>
              </div>
            </div>

            <div className="h-px w-full bg-gradient-to-r from-transparent via-zinc-200 to-transparent" />

            <div className="flex flex-wrap items-center justify-between gap-3 text-center">
              <span className="text-sm font-medium text-zinc-500">
                (c) {currentYear} {businessProfile.businessName}. All rights reserved.
              </span>
              <div className="flex flex-wrap items-center justify-center gap-3">
              <a
                href="https://zafron.me"
                target="_blank"
                rel="noreferrer"
                aria-label="Zafron"
                className="inline-flex transition duration-300 hover:-translate-y-0.5"
              >
                <div className="relative h-9 w-9 overflow-hidden rounded-full ring-1 ring-zinc-200 shadow-[0_10px_24px_rgba(24,24,27,0.10)]">
                  <Image
                    src="/zafron.webp"
                    alt="Zafron"
                    fill
                    sizes="40px"
                    className="object-cover"
                  />
                </div>
              </a>
              <span className="text-sm font-medium text-zinc-500">
                Designed and developed by
              </span>
              <a
                href="https://zafron.me"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-sm font-semibold text-zinc-700 transition duration-300 hover:-translate-y-0.5 hover:border-zinc-300 hover:bg-zinc-950 hover:text-white"
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

