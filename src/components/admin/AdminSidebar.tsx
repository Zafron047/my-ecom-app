'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { type AdminRole } from '@/lib/admin-rbac';

type AdminNavItem = {
  exactMatch?: boolean;
  href: string;
  label: string;
  allowedRoles: AdminRole[];
};

type AdminNavGroup = {
  children?: AdminNavItem[];
  parent: AdminNavItem;
};

const adminNavGroups: AdminNavGroup[] = [
  {
    parent: {
      exactMatch: true,
      href: '/admin',
      label: 'Dashboard',
      allowedRoles: ['support', 'manager', 'admin'],
    },
  },
  {
    parent: {
      exactMatch: true,
      href: '/admin/orders',
      label: 'Orders',
      allowedRoles: ['support', 'manager', 'admin'],
    },
    children: [
      {
        href: '/admin/orders/pos',
        label: 'POS',
        allowedRoles: ['support', 'manager', 'admin'],
      },
      {
        href: '/admin/orders/drafts',
        label: 'Drafts',
        allowedRoles: ['support', 'manager', 'admin'],
      },
      {
        href: '/admin/orders/abandoned-checkouts',
        label: 'Abandoned Checkouts',
        allowedRoles: ['support', 'manager', 'admin'],
      },
      {
        href: '/admin/orders/delivery-options',
        label: 'Delivery Options',
        allowedRoles: ['support', 'manager', 'admin'],
      },
    ],
  },
  {
    parent: {
      exactMatch: true,
      href: '/admin/products',
      label: 'Products',
      allowedRoles: ['manager', 'admin'],
    },
    children: [
      {
        href: '/admin/products/categories',
        label: 'Categories',
        allowedRoles: ['manager', 'admin'],
      },
      {
        href: '/admin/products/stock',
        label: 'Stock',
        allowedRoles: ['manager', 'admin'],
      },
      {
        href: '/admin/products/po',
        label: 'Purchase Order',
        allowedRoles: ['manager', 'admin'],
      },
      {
        href: '/admin/products/stock-transfer',
        label: 'Stock Transfers',
        allowedRoles: ['manager', 'admin'],
      },
    ],
  },
  {
    parent: {
      exactMatch: true,
      href: '/admin/customers',
      label: 'Customers',
      allowedRoles: ['support', 'manager', 'admin'],
    },
  },
  {
    parent: {
      exactMatch: true,
      href: '/admin/accounting',
      label: 'Accounting',
      allowedRoles: ['manager', 'admin'],
    },
    children: [
      {
        href: '/admin/accounting/expenses',
        label: 'Expenses',
        allowedRoles: ['manager', 'admin'],
      },
      {
        href: '/admin/accounting/pl',
        label: 'Profit / Loss',
        allowedRoles: ['manager', 'admin'],
      },
    ],
  },
  {
    parent: {
      exactMatch: true,
      href: '/admin/settings',
      label: 'Settings',
      allowedRoles: ['admin'],
    },
    children: [
      {
        href: '/admin/settings/manage-roles',
        label: 'Admin Access',
        allowedRoles: ['admin'],
      },
      {
        href: '/admin/settings/homepage-sections',
        label: 'Homepage Sections',
        allowedRoles: ['admin'],
      },
      {
        href: '/admin/settings/backup',
        label: 'Backup',
        allowedRoles: ['admin'],
      },
    ],
  },
];

type AdminSidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  role: AdminRole;
};

export default function AdminSidebar({ isOpen, onClose, role }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);

    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
      });
    } finally {
      onClose();
      router.push('/login');
      router.refresh();
      setIsLoggingOut(false);
    }
  };

  const sidebarNavigation = (
    <nav className="flex flex-col gap-1">
      {adminNavGroups
        .filter((group) => group.parent.allowedRoles.includes(role))
        .map((group) => {
          const childActive = Boolean(
            group.children?.some(
              (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
            ),
          );

          const parentPathActive = group.parent.exactMatch
            ? pathname === group.parent.href
            : pathname === group.parent.href ||
              pathname.startsWith(`${group.parent.href}/`);

          const parentActive = parentPathActive || childActive;
          const hasChildren = Boolean(group.children?.length);
          const isExpanded = parentActive;

          return (
            <div key={group.parent.href} className="space-y-0.5">
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => {
                    router.push(group.parent.href);
                  }}
                  className={`inline-flex w-full items-center justify-between rounded-xl border px-3 py-1.5 text-left text-[12px] font-semibold transition sm:text-[13px] ${
                    parentActive || isExpanded
                      ? 'border-blue-200 bg-blue-50 text-blue-800'
                      : 'border-transparent text-gray-700 hover:border-gray-200 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  aria-expanded={isExpanded}
                >
                  <span>{group.parent.label}</span>
                  <span className="text-xs">{isExpanded ? '-' : '+'}</span>
                </button>
              ) : (
                <Link
                  href={group.parent.href}
                  onClick={onClose}
                  className={`inline-flex w-full items-center rounded-xl border px-3 py-1.5 text-[12px] font-semibold transition sm:text-[13px] ${
                    parentActive
                      ? 'border-blue-200 bg-blue-50 !text-blue-800'
                      : 'border-transparent !text-gray-700 hover:border-gray-200 hover:bg-gray-50 hover:!text-gray-900'
                  }`}
                >
                  {group.parent.label}
                </Link>
              )}

              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-0.5 pt-0.5">
                      {group.children?.map((item) => {
                        if (!item.allowedRoles.includes(role)) return null;

                        const isActive =
                          pathname === item.href ||
                          (!item.exactMatch &&
                            pathname.startsWith(`${item.href}/`));

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={onClose}
                            className={`ml-3 inline-flex w-[calc(100%-0.75rem)] items-center rounded-lg border px-3 py-1.5 text-[12px] font-medium transition sm:text-[13px] ${
                              isActive
                                ? 'border-blue-200 bg-blue-50 !text-blue-700'
                                : 'border-transparent !text-gray-700 hover:border-gray-200 hover:bg-gray-50 hover:!text-gray-900'
                            }`}
                          >
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

      <div className="mt-3 border-t border-slate-200 pt-3">
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="inline-flex w-full items-center justify-center rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-70 sm:text-[13px]"
        >
          {isLoggingOut ? 'Logging out...' : 'Log Out'}
        </button>
      </div>
    </nav>
  );

  return (
    <>
      <aside className="sticky top-[56px] z-20 hidden h-[calc(100vh-56px)] w-80 max-w-none overflow-y-hidden border-r border-slate-200 bg-white px-4 py-4 shadow-none md:block">
        {sidebarNavigation}
      </aside>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Close sidebar"
              onClick={onClose}
              className="fixed inset-0 z-30 bg-slate-900/35 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            />

            <motion.aside
              className="fixed left-0 top-0 z-40 h-full w-80 max-w-[86vw] overflow-y-hidden border-r border-slate-200 bg-white px-4 py-4 shadow-2xl md:hidden"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
            >
              {sidebarNavigation}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
