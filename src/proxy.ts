import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';
import { canAccessAdminPath, parseAdminRole } from '@/lib/admin-rbac';

function getEffectiveRole(request: NextRequest) {
  const cookieRole = parseAdminRole(request.cookies.get('admin_role')?.value);
  if (cookieRole) return cookieRole;

  if (process.env.NODE_ENV !== 'production') {
    return parseAdminRole(process.env.ADMIN_DEV_ROLE);
  }

  return null;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = Boolean(
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
  );
  const role = getEffectiveRole(request);

  if (!hasSessionCookie || !role) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!canAccessAdminPath(pathname, role)) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
