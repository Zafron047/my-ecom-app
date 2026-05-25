import { NextResponse } from 'next/server';
import {
  createAdminPasswordResetUrl,
  createPasswordResetExpiry,
  createPasswordResetToken,
  hashPasswordResetToken,
} from '@/lib/admin-password-reset';
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
      isActive: true,
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

  if (!target.isActive) {
    return NextResponse.json(
      { error: 'Activate this admin account before issuing a reset link.' },
      { status: 400 },
    );
  }

  const now = new Date();
  const resetToken = createPasswordResetToken();
  const resetExpiresAt = createPasswordResetExpiry(now);

  await prisma.$transaction(async (tx) => {
    await tx.adminPasswordResetToken.updateMany({
      where: {
        adminUserId: target.id,
        expiresAt: { gt: now },
        usedAt: null,
      },
      data: {
        usedAt: now,
      },
    });

    await tx.adminPasswordResetToken.create({
      data: {
        adminUserId: target.id,
        createdByAdminId: actor.id,
        expiresAt: resetExpiresAt,
        tokenHash: hashPasswordResetToken(resetToken),
      },
    });

    await tx.adminUser.update({
      where: { id: target.id },
      data: {
        mustResetPassword: true,
      },
    });

    await tx.adminSession.updateMany({
      where: {
        adminUserId: target.id,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
      },
    });
  });

  await logAdminAudit({
    action: 'update',
    actorAdminId: actor.id,
    entityId: target.id,
    entityType: 'admin_user_password_reset',
    message: `Password reset link created for ${target.email}.`,
    metadata: {
      expiresAt: resetExpiresAt.toISOString(),
      targetEmail: target.email,
    },
    request,
  });

  return NextResponse.json({
    resetExpiresAt: resetExpiresAt.toISOString(),
    resetLink: createAdminPasswordResetUrl(request.url, resetToken),
  });
}
