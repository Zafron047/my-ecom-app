import { cookies } from 'next/headers';
import {
  CUSTOMER_SESSION_COOKIE,
  hashCustomerSessionToken,
} from '@/lib/customer-auth';
import { prisma } from '@/lib/prisma';

const LAST_SEEN_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export type CustomerSession = {
  customerId: string;
};

async function getSessionFromCookie(sessionToken: string | undefined) {
  if (!sessionToken) return null;

  const tokenHash = hashCustomerSessionToken(sessionToken);
  const now = new Date();
  const sessions = await prisma.$queryRawUnsafe<
    Array<{ id: string; customerId: string; lastSeenAt: Date }>
  >(
    `
      SELECT cs."id", cs."customerId", cs."lastSeenAt"
      FROM "CustomerSession" cs
      INNER JOIN "Customer" c ON c."id" = cs."customerId"
      WHERE cs."sessionTokenHash" = $1
        AND cs."revokedAt" IS NULL
        AND cs."expiresAt" > $2
        AND c."isBlocked" = false
      LIMIT 1
    `,
    tokenHash,
    now,
  );
  const session = sessions[0] ?? null;
  if (!session) return null;

  if (now.getTime() - session.lastSeenAt.getTime() >= LAST_SEEN_REFRESH_INTERVAL_MS) {
    await prisma.$executeRawUnsafe(
      `
        UPDATE "CustomerSession"
        SET "lastSeenAt" = $1, "updatedAt" = $1
        WHERE "id" = $2
      `,
      now,
      session.id,
    );
  }

  return { customerId: session.customerId } as CustomerSession;
}

export async function getCustomerSession(): Promise<CustomerSession | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value;
  return getSessionFromCookie(sessionToken);
}

export async function getCustomerSessionFromToken(
  sessionToken: string | undefined,
): Promise<CustomerSession | null> {
  return getSessionFromCookie(sessionToken);
}
