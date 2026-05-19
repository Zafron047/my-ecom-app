import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  CUSTOMER_AUTH_COOKIE,
  CUSTOMER_RECENT_ORDER_COOKIE,
  CUSTOMER_SESSION_COOKIE,
} from '@/lib/customer-auth';
import { getCustomerSession } from '@/lib/customer-session';
import { prisma } from '@/lib/prisma';

export async function POST() {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const cookieStore = await cookies();
  const now = new Date();

  await prisma.customerSession.updateMany({
    where: {
      customerId: session.customerId,
      revokedAt: null,
    },
    data: { revokedAt: now },
  });

  cookieStore.delete(CUSTOMER_SESSION_COOKIE);
  cookieStore.delete(CUSTOMER_AUTH_COOKIE);
  cookieStore.delete(CUSTOMER_RECENT_ORDER_COOKIE);

  return NextResponse.json({ success: true });
}
