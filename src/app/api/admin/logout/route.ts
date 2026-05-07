import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  ADMIN_ROLE_COOKIE,
  ADMIN_SESSION_COOKIE,
  hashSessionToken,
} from '@/lib/admin-auth';
import { getDbBackedAdminActor } from '@/lib/admin-api-auth';
import { logAdminAudit } from '@/lib/admin-audit';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  const actor = await getDbBackedAdminActor();
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (sessionToken) {
    const sessionTokenHash = hashSessionToken(sessionToken);
    await prisma.adminSession.updateMany({
      where: {
        sessionTokenHash,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  cookieStore.delete(ADMIN_SESSION_COOKIE);
  cookieStore.delete(ADMIN_ROLE_COOKIE);

  if (actor) {
    await logAdminAudit({
      action: 'logout',
      actorAdminId: actor.id,
      entityId: actor.id,
      entityType: 'admin_auth',
      message: 'Admin logged out.',
      request,
    });
  }

  return NextResponse.json({ success: true });
}
