import 'server-only';

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { type AdminRole } from '@prisma/client';
import { ADMIN_SESSION_COOKIE, hashSessionToken } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

export type DbBackedAdminActor = {
  email: string;
  id: string;
  mustResetPassword: boolean;
  name: string;
  role: AdminRole;
  sessionId: string;
  sessionTokenHash: string;
};

type RequireAdminApiRoleOptions = {
  allowPasswordResetRequired?: boolean;
};

export async function getDbBackedAdminActor(): Promise<DbBackedAdminActor | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!sessionToken) return null;

  const sessionTokenHash = hashSessionToken(sessionToken);
  const now = new Date();

  const session = await prisma.adminSession.findFirst({
    where: {
      adminUser: { isActive: true },
      expiresAt: { gt: now },
      revokedAt: null,
      sessionTokenHash,
    },
    include: {
      adminUser: {
        select: {
          email: true,
          id: true,
          mustResetPassword: true,
          name: true,
          role: true,
        },
      },
    },
  });

  if (!session) return null;

  return {
    email: session.adminUser.email,
    id: session.adminUser.id,
    mustResetPassword: session.adminUser.mustResetPassword,
    name: session.adminUser.name,
    role: session.adminUser.role,
    sessionId: session.id,
    sessionTokenHash,
  };
}

export async function requireAdminApiRole(
  allowedRoles: AdminRole[],
  options: RequireAdminApiRoleOptions = {},
): Promise<
  | { actor: DbBackedAdminActor; response?: never }
  | { actor?: never; response: NextResponse }
> {
  const actor = await getDbBackedAdminActor();

  if (!actor) {
    return {
      response: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }),
    };
  }

  if (!allowedRoles.includes(actor.role)) {
    return {
      response: NextResponse.json({ error: 'Forbidden.' }, { status: 403 }),
    };
  }

  if (actor.mustResetPassword && !options.allowPasswordResetRequired) {
    return {
      response: NextResponse.json(
        { error: 'Password reset is required before this action.' },
        { status: 403 },
      ),
    };
  }

  return { actor };
}
