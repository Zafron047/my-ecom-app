import type { OrderStatus, Prisma } from '@prisma/client';
import type { AdminSession } from '@/lib/admin-rbac';
import { prisma } from '@/lib/prisma';
import { formatSalesOrderStatusLabel } from '@/lib/sales-order-status';

export type OrderTimelineEntry = {
  createdAt: string;
  createdByName: string;
  id: string;
  kind: 'event' | 'note';
  note: string;
};

function getEventActor(session: AdminSession) {
  return {
    createdByAdminId: session.id === 'dev-admin' ? null : session.id,
    createdByName: session.name,
  };
}

function isMissingOrderEventTableError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2010' &&
    'meta' in error &&
    typeof error.meta === 'object' &&
    error.meta !== null &&
    'code' in error.meta &&
    error.meta.code === '42P01'
  );
}

async function getSalesOrderNotesTimeline(orderId: string) {
  const notes = await prisma.$queryRaw<
    Array<{
      id: string;
      note: string;
      createdByName: string;
      createdAt: Date;
    }>
  >`
    SELECT id, note, "createdByName", "createdAt"
    FROM "OrderNote"
    WHERE "orderId" = ${orderId}
    ORDER BY "createdAt" DESC
  `;

  return notes.map((entry) => ({
    createdAt: entry.createdAt.toISOString(),
    createdByName: entry.createdByName,
    id: entry.id,
    kind: 'note' as const,
    note: entry.note,
  }));
}

export function getSalesOrderEventMessages(input: {
  currentPaymentMethod: string;
  currentPaymentStatus: string;
  currentStatus: OrderStatus;
  nextPaymentMethod: string;
  nextPaymentStatus: string;
  nextStatus: OrderStatus;
}) {
  const messages: Array<{ eventType: string; message: string }> = [];

  if (input.currentStatus !== input.nextStatus) {
    messages.push({
      eventType: 'order_status_updated',
      message: `updated order status from ${formatSalesOrderStatusLabel(
        input.currentStatus,
      )} to ${formatSalesOrderStatusLabel(input.nextStatus)}`,
    });
  }

  if (
    input.currentPaymentMethod !== input.nextPaymentMethod ||
    input.currentPaymentStatus !== input.nextPaymentStatus
  ) {
    messages.push({
      eventType: 'payment_updated',
      message: 'updated order payment',
    });
  }

  return messages;
}

export async function createSalesOrderEvent(
  tx: Prisma.TransactionClient,
  input: {
    eventType: string;
    message: string;
    orderId: string;
    session: AdminSession;
  },
) {
  const actor = getEventActor(input.session);
  try {
    await tx.$executeRaw`
      INSERT INTO "OrderEvent" ("id", "orderId", "eventType", "message", "createdByAdminId", "createdByName", "createdAt")
      VALUES (md5(random()::text || clock_timestamp()::text), ${input.orderId}, ${input.eventType}, ${input.message}, ${actor.createdByAdminId}, ${actor.createdByName}, clock_timestamp())
    `;
  } catch (error) {
    if (!isMissingOrderEventTableError(error)) throw error;
  }
}

export async function getSalesOrderTimeline(orderId: string) {
  let timeline: Array<{
    id: string;
    note: string;
    createdByName: string;
    createdAt: Date;
    kind: 'event' | 'note';
  }>;

  try {
    timeline = await prisma.$queryRaw`
      SELECT id, message AS note, "createdByName", "createdAt", 'event' AS kind
      FROM "OrderEvent"
      WHERE "orderId" = ${orderId}
      UNION ALL
      SELECT id, note, "createdByName", "createdAt", 'note' AS kind
      FROM "OrderNote"
      WHERE "orderId" = ${orderId}
      ORDER BY "createdAt" DESC
    `;
  } catch (error) {
    if (isMissingOrderEventTableError(error)) {
      return getSalesOrderNotesTimeline(orderId);
    }
    throw error;
  }

  return timeline.map((entry) => ({
    createdAt: entry.createdAt.toISOString(),
    createdByName: entry.createdByName,
    id: entry.id,
    kind: entry.kind,
    note: entry.note,
  }));
}
