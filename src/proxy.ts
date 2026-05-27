import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ADMIN_ROLE_COOKIE, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';
import { canAccessAdminPath, parseAdminRole } from '@/lib/admin-rbac';
import { updateSession } from '@/utils/supabase/middleware';

function getEffectiveRole(request: NextRequest) {
  const cookieRole = parseAdminRole(request.cookies.get(ADMIN_ROLE_COOKIE)?.value);
  if (cookieRole) return cookieRole;

  if (process.env.NODE_ENV !== 'production') {
    return parseAdminRole(process.env.ADMIN_DEV_ROLE);
  }

  return null;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const supabaseResponse = await updateSession(request);

  if (!pathname.startsWith('/admin')) {
    return supabaseResponse;
  }

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

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
