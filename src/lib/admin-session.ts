import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminRole as PrismaAdminRole } from '@prisma/client';
import { ADMIN_SESSION_COOKIE, hashSessionToken } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import {
  type AdminRole,
  type AdminPermission,
  type AdminSession,
  canAccessPermission,
  canAccessAdminPath,
  parseAdminRole,
} from '@/lib/admin-rbac';

type DbAdminSession = {
  adminUser: {
    email: string;
      id: string;
      mustResetPassword: boolean;
      name: string;
      role: PrismaAdminRole;
  };
  id: string;
  lastSeenAt: Date;
};

const LAST_SEEN_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

function parseDbRole(role: PrismaAdminRole): ReturnType<typeof parseAdminRole> {
  return parseAdminRole(role);
}

function getDevFallbackRole(): ReturnType<typeof parseAdminRole> {
  if (process.env.NODE_ENV === 'production') return null;
  return parseAdminRole(process.env.ADMIN_DEV_ROLE);
}

function toSession(record: DbAdminSession): AdminSession | null {
  const role = parseDbRole(record.adminUser.role);
  if (!role) return null;
  return {
    id: record.adminUser.id,
    name: record.adminUser.name,
    email: record.adminUser.email,
    mustResetPassword: record.adminUser.mustResetPassword,
    role,
  };
}

async function getSessionFromCookie(
  sessionToken: string | undefined,
): Promise<AdminSession | null> {
  if (!sessionToken) return null;

  const tokenHash = hashSessionToken(sessionToken);
  const now = new Date();

  const session = await prisma.adminSession.findFirst({
    where: {
      sessionTokenHash: tokenHash,
      revokedAt: null,
      expiresAt: { gt: now },
      adminUser: { isActive: true },
    },
    include: {
      adminUser: {
        select: {
          id: true,
          name: true,
          email: true,
          mustResetPassword: true,
          role: true,
        },
      },
    },
  });

  if (!session) return null;

  const shouldRefreshLastSeen =
    now.getTime() - session.lastSeenAt.getTime() >= LAST_SEEN_REFRESH_INTERVAL_MS;

  if (shouldRefreshLastSeen) {
    await prisma.adminSession.update({
      where: { id: session.id },
      data: { lastSeenAt: now },
    });
  }

  return toSession(session);
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  const dbSession = await getSessionFromCookie(sessionToken);
  if (dbSession) return dbSession;

  const role = getDevFallbackRole();
  if (!role) return null;

  return {
    id: 'dev-admin',
    name: 'Development Admin',
    email: 'dev-admin@bdbuyeasy.com.bd',
    mustResetPassword: false,
    role,
  };
}

type RequireAdminSessionOptions = {
  allowPasswordResetRequired?: boolean;
};

export async function requireAdminSession(
  pathname: string,
  options: RequireAdminSessionOptions = {},
) {
  const session = await getAdminSession();

  if (!session) {
    const encodedPath = encodeURIComponent(pathname);
    redirect(`/login?next=${encodedPath}`);
  }

  if (!canAccessAdminPath(pathname, session.role)) {
    redirect('/admin');
  }

  if (session.mustResetPassword && !options.allowPasswordResetRequired) {
    redirect('/admin/profile?forcePasswordReset=1');
  }

  return session;
}

export async function requireAdminPermission(
  pathname: string,
  permission: AdminPermission,
) {
  const session = await requireAdminSession(pathname);
  if (!canAccessPermission(session.role, permission)) {
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
