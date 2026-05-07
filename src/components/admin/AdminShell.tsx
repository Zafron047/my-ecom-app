'use client';

import { useState } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminTopbar from '@/components/admin/AdminTopbar';
import { type AdminSession } from '@/lib/admin-rbac';

type AdminShellProps = {
  children: React.ReactNode;
  session: AdminSession;
};

export default function AdminShell({ children, session }: AdminShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <AdminTopbar
        session={session}
        onMenuToggle={() => setIsSidebarOpen((open) => !open)}
      />

      <div className="md:flex">
        <AdminSidebar
          role={session.role}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

