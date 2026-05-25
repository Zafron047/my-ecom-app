import { NextResponse } from 'next/server';
import { requireAdminApiPermission } from '@/lib/admin-api-auth';
import { logAdminAudit } from '@/lib/admin-audit';
import {
  type AdminRole,
  adminRoleLabels,
  canAssignAdminRole,
  canManageAdminUser,
  isPrivilegedAdminRole,
  parseAdminRole,
} from '@/lib/admin-rbac';
import { prisma } from '@/lib/prisma';

type UpdateAdminUserBody = {
  isActive?: boolean;
  role?: AdminRole;
};

function isAllowedRole(role: unknown): role is AdminRole {
  return typeof role === 'string' && parseAdminRole(role) === role;
}

export async function PATCH(
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

  let body: UpdateAdminUserBody;
  try {
    body = (await request.json()) as UpdateAdminUserBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
  }

  const nextRole = body.role;
  const nextIsActive = body.isActive;

  if (typeof nextRole === 'undefined' && typeof nextIsActive === 'undefined') {
    return NextResponse.json(
      { error: 'At least one field (role or isActive) is required.' },
      { status: 400 },
    );
  }

  if (typeof nextRole !== 'undefined' && !isAllowedRole(nextRole)) {
    return NextResponse.json({ error: 'Invalid role value.' }, { status: 400 });
  }

  if (typeof nextIsActive !== 'undefined' && typeof nextIsActive !== 'boolean') {
    return NextResponse.json({ error: 'Invalid active status value.' }, { status: 400 });
  }

  const target = await prisma.adminUser.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      role: true,
      isActive: true,
      mustResetPassword: true,
      passwordUpdatedAt: true,
      email: true,
      phone: true,
      name: true,
      createdAt: true,
      sessions: {
        select: {
          lastSeenAt: true,
        },
        orderBy: {
          lastSeenAt: 'desc',
        },
        take: 1,
      },
    },
  });

  if (!target) {
    return NextResponse.json({ error: 'Admin user not found.' }, { status: 404 });
  }

  const finalRole = nextRole ?? target.role;
  const finalIsActive = typeof nextIsActive === 'boolean' ? nextIsActive : target.isActive;
  const demotesLastSupaAdmin =
    target.role === 'supaAdmin' && finalRole !== 'supaAdmin';
  const deactivatesSupaAdmin = target.role === 'supaAdmin' && !finalIsActive;
  const changesOwnPrivilegedAccess =
    actor.id === target.id &&
    (finalRole !== target.role || !finalIsActive) &&
    isPrivilegedAdminRole(target.role);

  if (!canManageAdminUser(actor.role, target.role)) {
    return NextResponse.json(
      { error: `You cannot modify a ${adminRoleLabels[target.role]} user.` },
      { status: 403 },
    );
  }

  if (finalRole !== target.role && !canAssignAdminRole(actor.role, finalRole)) {
    return NextResponse.json(
      { error: `You cannot assign the ${adminRoleLabels[finalRole]} role.` },
      { status: 403 },
    );
  }

  if (changesOwnPrivilegedAccess) {
    return NextResponse.json(
      {
        error:
          'Ask another privileged admin to change your role or deactivate your account.',
      },
      { status: 400 },
    );
  }

  if (demotesLastSupaAdmin || deactivatesSupaAdmin) {
    const otherActiveSupaAdmins = await prisma.adminUser.count({
      where: {
        id: { not: target.id },
        role: 'supaAdmin',
        isActive: true,
      },
    });

    if (otherActiveSupaAdmins === 0) {
      return NextResponse.json(
        {
          error:
            'Cannot remove or deactivate the last active SupaAdmin. Promote another SupaAdmin first.',
        },
        { status: 400 },
      );
    }
  }

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const nextUser = await tx.adminUser.update({
      where: { id: target.id },
      data: {
        role: finalRole,
        isActive: finalIsActive,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        mustResetPassword: true,
        passwordUpdatedAt: true,
        createdAt: true,
        sessions: {
          select: {
            lastSeenAt: true,
          },
          orderBy: {
            lastSeenAt: 'desc',
          },
          take: 1,
        },
      },
    });

    if (target.role !== nextUser.role || !nextUser.isActive) {
      await tx.adminSession.updateMany({
        where: {
          adminUserId: target.id,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
        },
      });
    }

    return nextUser;
  });

  if (target.role !== updated.role) {
    await logAdminAudit({
      action: 'update',
      actorAdminId: actor.id,
      entityId: target.id,
      entityType: 'admin_user_role',
      message: `Role changed from ${target.role} to ${updated.role}.`,
      metadata: {
        fromRole: target.role,
        targetEmail: updated.email,
        toRole: updated.role,
      },
      request,
    });
  }

  if (target.isActive !== updated.isActive) {
    await logAdminAudit({
      action: 'status_change',
      actorAdminId: actor.id,
      entityId: target.id,
      entityType: 'admin_user_status',
      message: `User marked as ${updated.isActive ? 'active' : 'inactive'}.`,
      metadata: {
        fromStatus: target.isActive,
        targetEmail: updated.email,
        toStatus: updated.isActive,
      },
      request,
    });
  }

  return NextResponse.json({
    user: {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      role: updated.role,
      isActive: updated.isActive,
      mustResetPassword: updated.mustResetPassword,
      passwordUpdatedAt: updated.passwordUpdatedAt?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
      lastSeenAt: updated.sessions[0]?.lastSeenAt?.toISOString() ?? null,
    },
  });
}
