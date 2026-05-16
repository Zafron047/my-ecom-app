'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

type GuardResult = {
  error?: string;
  ok: boolean;
};

type NavigationGuard = {
  message?: string;
  onSave: () => Promise<GuardResult>;
  saveLabel?: string;
  shouldBlock: () => boolean;
  stayLabel?: string;
  title?: string;
};

type PendingNavigation = {
  guard: NavigationGuard;
  proceed: () => void;
};

type AdminNavigationGuardContextValue = {
  registerNavigationGuard: (guard: NavigationGuard) => () => void;
  requestNavigation: (proceed: () => void) => boolean;
};

const AdminNavigationGuardContext =
  createContext<AdminNavigationGuardContextValue | null>(null);

export function AdminNavigationGuardProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const guardRef = useRef<NavigationGuard | null>(null);
  const [pendingNavigation, setPendingNavigation] =
    useState<PendingNavigation | null>(null);
  const [action, setAction] = useState<'save' | null>(null);
  const [actionError, setActionError] = useState('');

  const registerNavigationGuard = useCallback((guard: NavigationGuard) => {
    guardRef.current = guard;

    return () => {
      if (guardRef.current === guard) {
        guardRef.current = null;
      }
    };
  }, []);

  const requestNavigation = useCallback((proceed: () => void) => {
    const guard = guardRef.current;
    if (!guard?.shouldBlock()) {
      proceed();
      return true;
    }

    setAction(null);
    setActionError('');
    setPendingNavigation({ guard, proceed });
    return false;
  }, []);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!guardRef.current?.shouldBlock()) return;

      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      ) {
        return;
      }

      if (!(event.target instanceof Element)) return;

      const anchor = event.target.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.hasAttribute('download')) return;
      if (anchor.target && anchor.target !== '_self') return;

      const nextUrl = new URL(anchor.href, window.location.href);
      if (nextUrl.origin !== window.location.origin) return;

      const currentUrl = new URL(window.location.href);
      if (
        nextUrl.pathname === currentUrl.pathname &&
        nextUrl.search === currentUrl.search
      ) {
        return;
      }

      if (!guardRef.current?.shouldBlock()) return;

      event.preventDefault();
      event.stopPropagation();
      requestNavigation(() => {
        router.push(`${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
      });
    }

    document.addEventListener('click', handleDocumentClick, true);
    return () => document.removeEventListener('click', handleDocumentClick, true);
  }, [requestNavigation, router]);

  const value = useMemo(
    () => ({
      registerNavigationGuard,
      requestNavigation,
    }),
    [registerNavigationGuard, requestNavigation],
  );

  async function completePendingNavigation() {
    if (!pendingNavigation || action) return;

    setAction('save');
    setActionError('');

    const result = await pendingNavigation.guard.onSave();

    if (!result?.ok) {
      setActionError(result?.error ?? 'Unable to continue. Please try again.');
      setAction(null);
      return;
    }

    const proceed = pendingNavigation.proceed;
    setPendingNavigation(null);
    setAction(null);
    setActionError('');
    proceed();
  }

  return (
    <AdminNavigationGuardContext.Provider value={value}>
      {children}

      {pendingNavigation ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-navigation-guard-title"
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
          >
            <h2
              id="admin-navigation-guard-title"
              className="text-lg font-semibold text-slate-900"
            >
              {pendingNavigation.guard.title ?? 'Leave this form?'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {pendingNavigation.guard.message ??
                'You have unsaved changes. Save them as a draft or discard them before leaving.'}
            </p>
            {actionError ? (
              <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                {actionError}
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={Boolean(action)}
                onClick={() => {
                  setPendingNavigation(null);
                  setActionError('');
                }}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pendingNavigation.guard.stayLabel ?? 'Stay'}
              </button>
              <button
                type="button"
                disabled={Boolean(action)}
                onClick={() => {
                  void completePendingNavigation();
                }}
                className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {action === 'save'
                  ? 'Saving...'
                  : pendingNavigation.guard.saveLabel ?? 'Save as Draft'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AdminNavigationGuardContext.Provider>
  );
}

export function useAdminNavigationGuard() {
  const context = useContext(AdminNavigationGuardContext);
  if (!context) {
    throw new Error(
      'useAdminNavigationGuard must be used within AdminNavigationGuardProvider.',
    );
  }

  return context;
}
