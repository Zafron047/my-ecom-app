import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE, hashSessionToken } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

export async function POST() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (sessionToken) {
    const sessionTokenHash = hashSessionToken(sessionToken);
    await prisma.adminSession.updateMany({
      where: {
        sessionTokenHash,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  cookieStore.delete(ADMIN_SESSION_COOKIE);
  cookieStore.delete('admin_role');

  return NextResponse.json({ success: true });
}
