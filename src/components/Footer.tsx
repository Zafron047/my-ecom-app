import Image from 'next/image';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-[#0f2448] bg-[radial-gradient(circle_at_top,_rgba(71,121,255,0.18),_transparent_34%),linear-gradient(180deg,#07111f_0%,#09172a_52%,#0b1930_100%)] text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[30px] border border-white/10 bg-white/5 shadow-[0_28px_70px_rgba(2,8,23,0.45)] backdrop-blur-sm">
          <div className="flex flex-col gap-6 px-5 py-6 sm:px-7 sm:py-7">
            <div className="flex flex-col items-center gap-5 text-center md:flex-row md:items-center md:justify-between md:text-left">
              <div className="flex flex-col items-center gap-3 md:flex-row md:items-center">
                <Link href="/" className="inline-flex items-center">
                  <div className="relative h-12 w-[4.5rem] overflow-hidden rounded-xl border border-blue-200/60 bg-[#2d5db3] shadow-[0_10px_24px_rgba(45,93,179,0.35)]">
                    <Image
                      src="/multi-shop.webp"
                      alt="Multi Shop BD logo"
                      fill
                      sizes="72px"
                      className="object-cover"
                    />
                  </div>
                </Link>
                <div>
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-blue-200/90">
                    Multi Shop BD
                  </p>
                  <p className="mt-1 text-sm text-white" style={{ color: '#fff' }}>
                    © 2026 Multi Shop BD. All rights reserved.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 text-sm font-medium text-white md:justify-end">
                <a
                  href="#"
                  style={{ color: '#fff' }}
                  className="rounded-full border border-white/30 bg-white/10 px-4 py-2 text-white transition hover:border-white hover:bg-white/16 hover:text-white"
                >
                  Contact Us
                </a>
                <a
                  href="#"
                  style={{ color: '#fff' }}
                  className="rounded-full border border-white/30 bg-white/10 px-4 py-2 text-white transition hover:border-white hover:bg-white/16 hover:text-white"
                >
                  Terms of Service
                </a>
                <a
                  href="https://www.facebook.com/multishop.com.bd"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Facebook"
                  style={{ color: '#fff' }}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white transition hover:-translate-y-0.5 hover:border-white hover:bg-white/16 hover:text-white"
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
                  href="#"
                  aria-label="Instagram"
                  style={{ color: '#fff' }}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white transition hover:-translate-y-0.5 hover:border-white hover:bg-white/16 hover:text-white"
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

            <div className="h-px w-full bg-gradient-to-r from-transparent via-white/12 to-transparent" />

            <div className="flex flex-wrap items-center justify-center gap-3 text-center">
              <a
                href="https://zafron.me"
                target="_blank"
                rel="noreferrer"
                aria-label="Zafron"
                className="inline-flex transition hover:-translate-y-0.5"
              >
                <div className="relative h-10 w-10 overflow-hidden rounded-full ring-1 ring-white/15 shadow-[0_10px_24px_rgba(2,8,23,0.35)]">
                  <Image
                    src="/zafron.webp"
                    alt="Zafron"
                    fill
                    sizes="40px"
                    className="object-cover"
                  />
                </div>
              </a>
              <span className="text-sm text-white" style={{ color: '#fff' }}>
                Designed and developed by
              </span>
              <a
                href="https://zafron.me"
                target="_blank"
                rel="noreferrer"
                style={{
                  color: '#fff',
                  textDecoration: 'none',
                }}
                className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-2.5 py-0.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-white hover:bg-white/18 hover:text-white"
              >
                Zafron
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
