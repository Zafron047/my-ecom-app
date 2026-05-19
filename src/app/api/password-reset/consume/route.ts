import { NextResponse } from 'next/server';
import { hashCustomerPasswordResetToken } from '@/lib/customer-password-reset';
import { hashPassword } from '@/lib/password-auth';
import { prisma } from '@/lib/prisma';

type ConsumePasswordResetBody = {
  newPassword?: string;
  token?: string;
};

type ResetTokenRow = {
  customerId: string;
  expiresAt: Date;
  id: string;
  isBlocked: boolean;
  usedAt: Date | null;
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

  const token = body.token?.trim() ?? '';
  const newPassword = body.newPassword?.trim() ?? '';

  if (!token) {
    return invalidResetResponse();
  }
  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: 'New password must be at least 8 characters.' },
      { status: 400 },
    );
  }

  const tokenHash = hashCustomerPasswordResetToken(token);
  const now = new Date();
  const rows = await prisma.$queryRawUnsafe<ResetTokenRow[]>(
    `
      SELECT prt."id", prt."customerId", prt."expiresAt", prt."usedAt", c."isBlocked"
      FROM "CustomerPasswordResetToken" prt
      INNER JOIN "Customer" c ON c."id" = prt."customerId"
      WHERE prt."tokenHash" = $1
      LIMIT 1
    `,
    tokenHash,
  );
  const resetToken = rows[0] ?? null;

  if (
    !resetToken ||
    resetToken.usedAt ||
    resetToken.expiresAt <= now ||
    resetToken.isBlocked
  ) {
    return invalidResetResponse();
  }

  const nextPasswordHash = await hashPassword(newPassword);
  const updated = await prisma.$transaction(async (tx) => {
    const consumed = await tx.$executeRawUnsafe(
      `
        UPDATE "CustomerPasswordResetToken"
        SET "usedAt" = $1
        WHERE "id" = $2
          AND "usedAt" IS NULL
      `,
      now,
      resetToken.id,
    );

    if (consumed !== 1) return false;

    await tx.customer.update({
      where: { id: resetToken.customerId },
      data: { passwordHash: nextPasswordHash },
    });

    await tx.$executeRawUnsafe(
      `
        UPDATE "CustomerPasswordResetToken"
        SET "usedAt" = $1
        WHERE "customerId" = $2
          AND "expiresAt" > $1
          AND "usedAt" IS NULL
      `,
      now,
      resetToken.customerId,
    );

    await tx.customerSession.updateMany({
      where: {
        customerId: resetToken.customerId,
        revokedAt: null,
      },
      data: { revokedAt: now },
    });

    return true;
  });

  if (!updated) {
    return invalidResetResponse();
  }

  return NextResponse.json({ success: true });
}
