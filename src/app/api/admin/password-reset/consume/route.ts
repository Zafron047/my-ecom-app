import { NextResponse } from 'next/server';
import {
  hashPasswordResetToken,
} from '@/lib/admin-password-reset';
import { validateAdminPassword } from '@/lib/admin-auth';
import { logAdminAudit } from '@/lib/admin-audit';
import { hashPassword } from '@/lib/password-auth';
import { prisma } from '@/lib/prisma';

type ConsumePasswordResetBody = {
  newPassword?: string;
  token?: string;
};

function invalidResetResponse() {
  return NextResponse.json(
    { error: 'This reset link is invalid or expired.' },
    { status: 400 },
  );
}

export async function POST(request: Request) {
  let body: ConsumePasswordResetBody;
  try {
    body = (await request.json()) as ConsumePasswordResetBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
  }

  const token = typeof body.token === 'string' ? body.token.trim() : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
  const passwordError = validateAdminPassword(newPassword);

  if (!token) {
    return invalidResetResponse();
  }

  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  const tokenHash = hashPasswordResetToken(token);
  const now = new Date();
  const resetToken = await prisma.adminPasswordResetToken.findUnique({
    where: { tokenHash },
    include: {
      adminUser: {
        select: {
          email: true,
          id: true,
          isActive: true,
        },
      },
    },
  });

  if (
    !resetToken ||
    resetToken.usedAt ||
    resetToken.expiresAt <= now ||
    !resetToken.adminUser.isActive
  ) {
    await logAdminAudit({
      action: 'update',
      entityId: 'unknown',
      entityType: 'admin_user_password_reset',
      message: 'Admin password reset failed.',
      metadata: { reason: 'invalid_or_expired_token' },
      request,
    });

    return invalidResetResponse();
  }

  const nextPasswordHash = await hashPassword(newPassword);
  const updated = await prisma.$transaction(async (tx) => {
    const consumed = await tx.adminPasswordResetToken.updateMany({
      where: {
        id: resetToken.id,
        usedAt: null,
      },
      data: {
        usedAt: now,
      },
    });

    if (consumed.count !== 1) return null;

    await tx.adminUser.update({
      where: { id: resetToken.adminUserId },
      data: {
        mustResetPassword: false,
        passwordHash: nextPasswordHash,
        passwordUpdatedAt: now,
      },
    });

    await tx.adminPasswordResetToken.updateMany({
      where: {
        adminUserId: resetToken.adminUserId,
        expiresAt: { gt: now },
        usedAt: null,
      },
      data: {
        usedAt: now,
      },
    });

    await tx.adminSession.updateMany({
      where: {
        adminUserId: resetToken.adminUserId,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
      },
    });

    return resetToken.adminUser;
  });

  if (!updated) {
    return invalidResetResponse();
  }

  await logAdminAudit({
    action: 'update',
    actorAdminId: updated.id,
    entityId: updated.id,
    entityType: 'admin_user_password_reset',
    message: 'Admin password reset token consumed.',
    metadata: { targetEmail: updated.email },
    request,
  });

  return NextResponse.json({ success: true });
}
