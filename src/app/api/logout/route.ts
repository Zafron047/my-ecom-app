import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  CUSTOMER_AUTH_COOKIE,
  CUSTOMER_RECENT_ORDER_COOKIE,
  CUSTOMER_SESSION_COOKIE,
  hashCustomerSessionToken,
} from '@/lib/customer-auth';
import { prisma } from '@/lib/prisma';

export async function POST() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value;
  if (sessionToken) {
    const now = new Date();
    await prisma.$executeRawUnsafe(
      `
        UPDATE "CustomerSession"
        SET "revokedAt" = $1, "updatedAt" = $1
        WHERE "sessionTokenHash" = $2
          AND "revokedAt" IS NULL
      `,
      now,
      hashCustomerSessionToken(sessionToken),
    );
  }
  cookieStore.delete(CUSTOMER_SESSION_COOKIE);
  cookieStore.delete(CUSTOMER_AUTH_COOKIE);
  cookieStore.delete(CUSTOMER_RECENT_ORDER_COOKIE);

  return NextResponse.json({ success: true });
}
