import { NextResponse } from 'next/server';
import { type AdminRole } from '@prisma/client';
import {
  createAdminPasswordResetUrl,
  createPasswordResetExpiry,
  createPasswordResetToken,
  hashPasswordResetToken,
} from '@/lib/admin-password-reset';
import { normalizeAdminEmail } from '@/lib/admin-auth';
import { requireAdminApiRole } from '@/lib/admin-api-auth';
import { logAdminAudit } from '@/lib/admin-audit';
import { hashPassword } from '@/lib/password-auth';
import { prisma } from '@/lib/prisma';

type CreateAdminUserBody = {
  email?: string;
  name?: string;
  role?: AdminRole;
};

const allowedRoles: AdminRole[] = ['admin', 'manager', 'support'];

function isAllowedRole(role: unknown): role is AdminRole {
  return typeof role === 'string' && allowedRoles.includes(role as AdminRole);
}

function isPrismaUniqueConstraintError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

export async function POST(request: Request) {
  const auth = await requireAdminApiRole(['admin']);
  if (auth.response) return auth.response;
  const { actor } = auth;

  let body: CreateAdminUserBody;
  try {
    body = (await request.json()) as CreateAdminUserBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
  }

  const email = normalizeAdminEmail(body.email);
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const role = body.role;

  if (!email) {
    return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });
  }

  if (name.length < 2) {
    return NextResponse.json({ error: 'Name must be at least 2 characters.' }, { status: 400 });
  }

  if (!isAllowedRole(role)) {
    return NextResponse.json({ error: 'Invalid role value.' }, { status: 400 });
  }

  const now = new Date();
  const resetToken = createPasswordResetToken();
  const resetExpiresAt = createPasswordResetExpiry(now);
  const temporaryPassword = createPasswordResetToken();
  const passwordHash = await hashPassword(temporaryPassword);

  try {
    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.adminUser.create({
        data: {
          email,
          isActive: true,
          mustResetPassword: true,
          name,
          passwordHash,
          role,
        },
        select: {
          createdAt: true,
          email: true,
          id: true,
          isActive: true,
          mustResetPassword: true,
          name: true,
          passwordUpdatedAt: true,
          role: true,
        },
      });

      await tx.adminPasswordResetToken.create({
        data: {
          adminUserId: user.id,
          createdByAdminId: actor.id,
          expiresAt: resetExpiresAt,
          tokenHash: hashPasswordResetToken(resetToken),
        },
      });

      return user;
    });

    await logAdminAudit({
      action: 'create',
      actorAdminId: actor.id,
      entityId: created.id,
      entityType: 'admin_user',
      message: `Admin user ${created.email} was created.`,
      metadata: {
        role: created.role,
        targetEmail: created.email,
      },
      request,
    });

    await logAdminAudit({
      action: 'update',
      actorAdminId: actor.id,
      entityId: created.id,
      entityType: 'admin_user_password_reset',
      message: `Password setup link created for ${created.email}.`,
      metadata: {
        expiresAt: resetExpiresAt.toISOString(),
        reason: 'new_admin_user',
        targetEmail: created.email,
      },
      request,
    });

    return NextResponse.json(
      {
        resetExpiresAt: resetExpiresAt.toISOString(),
        resetLink: createAdminPasswordResetUrl(request.url, resetToken),
        user: {
          createdAt: created.createdAt.toISOString(),
          email: created.email,
          id: created.id,
          isActive: created.isActive,
          lastSeenAt: null,
          mustResetPassword: created.mustResetPassword,
          name: created.name,
          passwordUpdatedAt: created.passwordUpdatedAt?.toISOString() ?? null,
          role: created.role,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      return NextResponse.json(
        { error: 'An admin user with this email already exists.' },
        { status: 409 },
      );
    }

    throw error;
  }
}
