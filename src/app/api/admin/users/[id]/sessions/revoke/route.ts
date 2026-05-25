import { NextResponse } from 'next/server';
import { requireAdminApiPermission } from '@/lib/admin-api-auth';
import { logAdminAudit } from '@/lib/admin-audit';
import { adminRoleLabels, canManageAdminUser } from '@/lib/admin-rbac';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApiPermission('adminUsers.manage');
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
      role: true,
    },
  });

  if (!target) {
    return NextResponse.json({ error: 'Admin user not found.' }, { status: 404 });
  }

  if (!canManageAdminUser(actor.role, target.role)) {
    return NextResponse.json(
      { error: `You cannot modify a ${adminRoleLabels[target.role]} user.` },
      { status: 403 },
    );
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
