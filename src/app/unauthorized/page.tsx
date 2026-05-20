import Link from 'next/link';

export default function UnauthorizedPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6 lg:px-8">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-rose-600">
        Account blocked
      </p>
      <h1 className="mt-3 text-3xl font-semibold text-slate-950">
        You are not authorized
      </h1>
      <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600">
        This customer account cannot place new orders. Please contact support if
        you think this is a mistake.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Back to home
        </Link>
        <Link
          href="/products"
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Browse products
        </Link>
      </div>
    </main>
  );
}
