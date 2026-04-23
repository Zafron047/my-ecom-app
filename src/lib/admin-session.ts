import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  type AdminRole,
  type AdminSession,
  canAccessAdminPath,
  parseAdminRole,
} from '@/lib/admin-rbac';

function getDevFallbackRole() {
  if (process.env.NODE_ENV === 'production') return null;
  return parseAdminRole(process.env.ADMIN_DEV_ROLE);
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const cookieRole = parseAdminRole(cookieStore.get('admin_role')?.value);
  const role = cookieRole ?? getDevFallbackRole();

  if (!role) return null;

  return {
    id: cookieStore.get('admin_id')?.value ?? 'dev-admin',
    name: cookieStore.get('admin_name')?.value ?? 'John Doe',
    email: cookieStore.get('admin_email')?.value ?? 'dev-admin@shopeasy.com.bd',
    role,
  };
}

export async function requireAdminSession(pathname: string) {
  const session = await getAdminSession();

  if (!session) {
    const encodedPath = encodeURIComponent(pathname);
    redirect(`/login?next=${encodedPath}`);
  }

  if (!canAccessAdminPath(pathname, session.role)) {
    redirect('/admin');
  }

  return session;
}

export async function requireAdminRole(
  pathname: string,
  allowedRoles: AdminRole[],
) {
  const session = await requireAdminSession(pathname);

  if (!allowedRoles.includes(session.role)) {
    redirect('/admin');
  }

  return session;
}
