import Image from 'next/image';
import Link from 'next/link';
import { type AdminSession } from '@/lib/admin-rbac';

type AdminTopbarProps = {
  onMenuToggle: () => void;
  session: AdminSession;
};

function formatRoleLabel(role: AdminSession['role']) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export default function AdminTopbar({ onMenuToggle, session }: AdminTopbarProps) {
  const textColor = 'aliceblue';

  return (
    <header className="sticky top-0 z-40 bg-black px-4 py-3 text-white md:px-6">
      <div className="md:hidden">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onMenuToggle}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/20 transition hover:bg-white/10"
            aria-label="Open admin menu"
            style={{ color: textColor }}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>

          <p
            className="truncate text-center text-base font-semibold tracking-wide"
            style={{ color: textColor }}
          >
            Admin Workspace
          </p>

          <Link
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            prefetch={false}
            aria-label="Open storefront homepage in a new window"
            className="relative h-8 w-12 shrink-0 overflow-hidden rounded-md border border-blue-200/40 bg-[#2d5db3] transition hover:border-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
          >
            <Image
              src="/business-logo.png"
              alt="BDBuyEasy logo"
              fill
              sizes="48px"
              className="object-contain p-0.5"
              loading="eager"
              fetchPriority="high"
            />
          </Link>
        </div>

        <div
          className="mt-2 flex min-w-0 items-center justify-end gap-2 text-xs font-semibold"
          style={{ color: textColor }}
        >
          <span className="shrink-0 whitespace-nowrap">Hello,</span>
          <Link
            href="/admin/profile"
            className="min-w-0 max-w-[220px] truncate whitespace-nowrap underline underline-offset-2 hover:opacity-90"
            style={{
              color: textColor,
              textDecorationLine: 'underline',
              textDecorationColor: textColor,
              textDecorationThickness: '1px',
            }}
          >
            {session.name} ({formatRoleLabel(session.role)})
          </Link>
          <svg
            className="h-4 w-4 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.42V11a6 6 0 1 0-12 0v3.18a2 2 0 0 1-.6 1.41L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9"
            />
          </svg>
        </div>
      </div>

      <div className="relative hidden items-center justify-between gap-3 md:flex">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            prefetch={false}
            aria-label="Open storefront homepage in a new window"
            className="relative h-8 w-12 overflow-hidden rounded-md border border-blue-200/40 bg-[#2d5db3] transition hover:border-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
          >
            <Image
              src="/business-logo.png"
              alt="BDBuyEasy logo"
              fill
              sizes="48px"
              className="object-contain p-0.5"
              loading="eager"
              fetchPriority="high"
            />
          </Link>
        </div>

        <p
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 truncate text-center text-xl font-semibold tracking-wide"
          style={{ color: textColor }}
        >
          Admin Workspace
        </p>

        <div
          className="flex items-center justify-end gap-2 text-right text-sm font-semibold"
          style={{ color: textColor }}
        >
          <span className="whitespace-nowrap">Hello,</span>
          <Link
            href="/admin/profile"
            className="whitespace-nowrap underline underline-offset-2 hover:opacity-90"
            style={{
              color: textColor,
              textDecorationLine: 'underline',
              textDecorationColor: textColor,
              textDecorationThickness: '1px',
            }}
          >
            {session.name} ({formatRoleLabel(session.role)})
          </Link>
          <svg
            className="h-4 w-4 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.42V11a6 6 0 1 0-12 0v3.18a2 2 0 0 1-.6 1.41L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9"
            />
          </svg>
        </div>
      </div>
    </header>
  );
}
