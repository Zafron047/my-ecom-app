import { NextResponse } from 'next/server';
import { requireAdminApiRole } from '@/lib/admin-api-auth';
import { logAdminAudit } from '@/lib/admin-audit';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApiRole(['admin']);
  if (auth.response) return auth.response;
  const { actor } = auth;

  const { id: targetUserId } = await context.params;
  if (!targetUserId) {
    return NextResponse.json({ error: 'Invalid admin user id.' }, { status: 400 });
  }

  const target = await prisma.adminUser.findUnique({
    where: { id: targetUserId },
    select: {
      email: true,
      id: true,
    },
  });

  if (!target) {
    return NextResponse.json({ error: 'Admin user not found.' }, { status: 404 });
  }

  const now = new Date();
  const revoked = await prisma.adminSession.updateMany({
    where: {
      adminUserId: target.id,
      revokedAt: null,
    },
    data: {
      revokedAt: now,
    },
  });

  await logAdminAudit({
    action: 'logout',
    actorAdminId: actor.id,
    entityId: target.id,
    entityType: 'admin_user_sessions',
    message: `All sessions revoked for ${target.email}.`,
    metadata: {
      revokedCount: revoked.count,
      targetEmail: target.email,
    },
    request,
  });

  return NextResponse.json({ revokedCount: revoked.count, success: true });
}
