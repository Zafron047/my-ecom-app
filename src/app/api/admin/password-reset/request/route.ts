import { NextResponse } from 'next/server';
import {
  createAdminPasswordResetUrl,
  createPasswordResetExpiry,
  createPasswordResetToken,
  hashPasswordResetToken,
} from '@/lib/admin-password-reset';
import { normalizeAdminEmail } from '@/lib/admin-auth';
import { logAdminAudit } from '@/lib/admin-audit';
import { getPublicAppOrigin } from '@/lib/app-url';
import { sendAdminPasswordResetEmail } from '@/lib/password-reset-email';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

type RequestAdminPasswordResetBody = {
  email?: string;
};

function genericResponse() {
  return NextResponse.json({ success: true });
}

export async function POST(request: Request) {
  let body: RequestAdminPasswordResetBody;
  try {
    body = (await request.json()) as RequestAdminPasswordResetBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
  }

  const email = normalizeAdminEmail(body.email);
  if (!email) {
    return NextResponse.json({ error: 'A valid admin email is required.' }, { status: 400 });
  }

  const rateLimit = checkRateLimit({
    key: `admin-password-reset:${getClientIp(request)}:${email}`,
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many password reset requests. Please try again later.' },
      { status: 429 },
    );
  }

  const adminUser = await prisma.adminUser.findFirst({
    where: { email, isActive: true },
    select: {
      email: true,
      id: true,
    },
  });

  if (!adminUser) {
    await logAdminAudit({
      action: 'update',
      entityId: email,
      entityType: 'admin_user_password_reset',
      message: 'Admin password reset requested for unknown or inactive account.',
      metadata: { targetEmail: email },
      request,
    });
    return genericResponse();
  }

  const now = new Date();
  const resetToken = createPasswordResetToken();
  const resetExpiresAt = createPasswordResetExpiry(now);
  const resetLink = createAdminPasswordResetUrl(
    getPublicAppOrigin(request.url),
    resetToken,
  );

  await prisma.$transaction(async (tx) => {
    await tx.adminPasswordResetToken.updateMany({
      where: {
        adminUserId: adminUser.id,
        expiresAt: { gt: now },
        usedAt: null,
      },
      data: { usedAt: now },
    });

    await tx.adminPasswordResetToken.create({
      data: {
        adminUserId: adminUser.id,
        expiresAt: resetExpiresAt,
        tokenHash: hashPasswordResetToken(resetToken),
      },
    });

    await tx.adminUser.update({
      where: { id: adminUser.id },
      data: { mustResetPassword: true },
    });

    await tx.adminSession.updateMany({
      where: {
        adminUserId: adminUser.id,
        revokedAt: null,
      },
      data: { revokedAt: now },
    });
  });

  const mailResult = await sendAdminPasswordResetEmail({
    expiresAt: resetExpiresAt,
    resetLink,
    to: adminUser.email,
  });

  await logAdminAudit({
    action: 'update',
    entityId: adminUser.id,
    entityType: 'admin_user_password_reset',
    message: 'Admin password reset email requested.',
    metadata: {
      emailSent: mailResult.sent,
      expiresAt: resetExpiresAt.toISOString(),
      selfService: true,
      targetEmail: adminUser.email,
    },
    request,
  });

  return genericResponse();
}
