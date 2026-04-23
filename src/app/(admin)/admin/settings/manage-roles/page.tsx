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
      role: true,
      isActive: true,
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

  return (
    <ManageRolesPanel
      currentAdminId={session.id}
      users={users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt.toISOString(),
        lastSeenAt: user.sessions[0]?.lastSeenAt?.toISOString() ?? null,
      }))}
    />
  );
}
