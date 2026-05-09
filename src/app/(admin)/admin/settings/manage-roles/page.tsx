import { prisma } from '@/lib/prisma';
import { requireAdminRole } from '@/lib/admin-session';
import ManageRolesPanel from '@/components/admin/ManageRolesPanel';

export default async function ManageRolesPage() {
  const session = await requireAdminRole('/admin/settings/manage-roles', ['admin']);

  const users = await prisma.adminUser.findMany({
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
    orderBy: {
      createdAt: 'asc',
    },
  });

  const auditLogs = await prisma.auditLog.findMany({
    where: {
      entityType: {
        in: [
          'admin_auth',
          'admin_user',
          'admin_user_password',
          'admin_user_password_reset',
          'admin_user_role',
          'admin_user_sessions',
          'admin_user_status',
        ],
      },
    },
    include: {
      actorAdmin: {
        select: {
          email: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 25,
  });

  return (
    <ManageRolesPanel
      auditLogs={auditLogs.map((entry) => ({
        action: entry.action,
        actorLabel: entry.actorAdmin
          ? `${entry.actorAdmin.name} (${entry.actorAdmin.email})`
          : null,
        createdAt: entry.createdAt.toISOString(),
        entityType: entry.entityType,
        id: entry.id,
        ipAddress: entry.ipAddress,
        message: entry.message,
      }))}
      currentAdminId={session.id}
      users={users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
        mustResetPassword: user.mustResetPassword,
        passwordUpdatedAt: user.passwordUpdatedAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
        lastSeenAt: user.sessions[0]?.lastSeenAt?.toISOString() ?? null,
      }))}
    />
  );
}
