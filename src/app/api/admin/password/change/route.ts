import { NextResponse } from 'next/server';
import { validateAdminPassword } from '@/lib/admin-auth';
import { requireAdminApiRole } from '@/lib/admin-api-auth';
import { logAdminAudit } from '@/lib/admin-audit';
import { hashPassword, verifyPassword } from '@/lib/password-auth';
import { prisma } from '@/lib/prisma';

type ChangePasswordBody = {
  currentPassword?: string;
  newPassword?: string;
};

export async function POST(request: Request) {
  const auth = await requireAdminApiRole(['admin', 'manager', 'support'], {
    allowPasswordResetRequired: true,
  });
  if (auth.response) return auth.response;
  const { actor } = auth;

  let body: ChangePasswordBody;
  try {
    body = (await request.json()) as ChangePasswordBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
  }

  const currentPassword =
    typeof body.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
  const passwordError = validateAdminPassword(newPassword);

  if (!currentPassword) {
    return NextResponse.json({ error: 'Current password is required.' }, { status: 400 });
  }

  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  if (currentPassword === newPassword) {
    return NextResponse.json(
      { error: 'New password must be different from the current password.' },
      { status: 400 },
    );
  }

  const adminUser = await prisma.adminUser.findUnique({
    where: { id: actor.id },
    select: {
      email: true,
      id: true,
      passwordHash: true,
    },
  });

  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const currentPasswordIsValid = await verifyPassword(
    currentPassword,
    adminUser.passwordHash,
  );

  if (!currentPasswordIsValid) {
    await logAdminAudit({
      action: 'update',
      actorAdminId: actor.id,
      entityId: actor.id,
      entityType: 'admin_user_password',
      message: 'Admin password change failed.',
      metadata: { reason: 'invalid_current_password' },
      request,
    });

    return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 });
  }

  const now = new Date();
  const nextPasswordHash = await hashPassword(newPassword);

  await prisma.$transaction(async (tx) => {
    await tx.adminUser.update({
      where: { id: actor.id },
      data: {
        mustResetPassword: false,
        passwordHash: nextPasswordHash,
        passwordUpdatedAt: now,
      },
    });

    await tx.adminPasswordResetToken.updateMany({
      where: {
        adminUserId: actor.id,
        expiresAt: { gt: now },
        usedAt: null,
      },
      data: {
        usedAt: now,
      },
    });

    await tx.adminSession.updateMany({
      where: {
        adminUserId: actor.id,
        id: { not: actor.sessionId },
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
    entityId: actor.id,
    entityType: 'admin_user_password',
    message: 'Admin password changed.',
    request,
  });

  return NextResponse.json({ success: true });
}
