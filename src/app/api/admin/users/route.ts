import { NextResponse } from 'next/server';
import {
  createAdminPasswordResetUrl,
  createPasswordResetExpiry,
  createPasswordResetToken,
  hashPasswordResetToken,
} from '@/lib/admin-password-reset';
import { normalizeAdminEmail, normalizeAdminPhone } from '@/lib/admin-auth';
import { requireAdminApiPermission } from '@/lib/admin-api-auth';
import { logAdminAudit } from '@/lib/admin-audit';
import {
  type AdminRole,
  adminRoleLabels,
  canAssignAdminRole,
  parseAdminRole,
} from '@/lib/admin-rbac';
import { hashPassword } from '@/lib/password-auth';
import { prisma } from '@/lib/prisma';

type CreateAdminUserBody = {
  email?: string;
  name?: string;
  phone?: string;
  role?: AdminRole;
};

function isAllowedRole(role: unknown): role is AdminRole {
  return typeof role === 'string' && parseAdminRole(role) === role;
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
  const auth = await requireAdminApiPermission('adminUsers.manage');
  if (auth.response) return auth.response;
  const { actor } = auth;

  let body: CreateAdminUserBody;
  try {
    body = (await request.json()) as CreateAdminUserBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
  }

  const email = normalizeAdminEmail(body.email);
  const rawPhone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const phone = rawPhone ? normalizeAdminPhone(rawPhone) : null;
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const role = body.role;

  if (!email) {
    return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });
  }

  if (rawPhone && !phone) {
    return NextResponse.json(
      { error: 'Use a valid Bangladesh mobile number.' },
      { status: 400 },
    );
  }

  if (name.length < 2) {
    return NextResponse.json({ error: 'Name must be at least 2 characters.' }, { status: 400 });
  }

  if (!isAllowedRole(role)) {
    return NextResponse.json({ error: 'Invalid role value.' }, { status: 400 });
  }

  if (!canAssignAdminRole(actor.role, role)) {
    return NextResponse.json(
      { error: `You cannot assign the ${adminRoleLabels[role]} role.` },
      { status: 403 },
    );
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
          phone,
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
          phone: true,
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
        targetPhone: created.phone,
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
        targetPhone: created.phone,
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
          phone: created.phone,
          role: created.role,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      return NextResponse.json(
        { error: 'An admin user with this email or mobile number already exists.' },
        { status: 409 },
      );
    }

    throw error;
  }
}
