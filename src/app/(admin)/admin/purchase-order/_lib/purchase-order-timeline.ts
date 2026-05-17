import { revalidatePath } from 'next/cache';
import type { Prisma } from '@prisma/client';
import type { AdminSession } from '@/lib/admin-rbac';
import { prisma } from '@/lib/prisma';
import { isPurchaseOrderDraft } from '@/lib/purchase-order-status';

export type PurchaseOrderTimelineEntry = {
  createdAt: string;
  createdByName: string;
  id: string;
  kind: 'event' | 'note';
  note: string;
};

export type PurchaseOrderTimelineState = {
  error?: string;
  message?: string;
  notes?: string;
  timeline?: PurchaseOrderTimelineEntry[];
};

type PurchaseOrderNoteMode = 'draft' | 'submitted';

type PurchaseOrderNoteOptions = {
  failureMessage: string;
  mode: PurchaseOrderNoteMode;
  revalidatePaths: string[];
  revalidateRecordPath?: (purchaseOrderId: string) => string;
  session: AdminSession;
  successMessage: string;
};

function getEventActor(session: AdminSession) {
  return {
    createdByAdminId: session.id === 'dev-admin' ? null : session.id,
    createdByName: session.name,
  };
}

function isAllowedPurchaseOrderNoteStatus(status: string, mode: PurchaseOrderNoteMode) {
  return mode === 'draft'
    ? isPurchaseOrderDraft(status)
    : !isPurchaseOrderDraft(status);
}

function getMissingRecordMessage(mode: PurchaseOrderNoteMode) {
  return mode === 'draft'
    ? 'This PO Draft is no longer available.'
    : 'PO not found.';
}

function getMissingNoteMessage(mode: PurchaseOrderNoteMode) {
  return mode === 'draft'
    ? 'This PO Draft note is no longer available.'
    : 'PO note not found.';
}

export async function createPurchaseOrderEvent(
  tx: Prisma.TransactionClient,
  input: {
    eventType: string;
    message: string;
    purchaseOrderId: string;
    session: AdminSession;
  },
) {
  const actor = getEventActor(input.session);
  await tx.$executeRaw`
    INSERT INTO "PurchaseOrderEvent" ("id", "purchaseOrderId", "eventType", "message", "createdByAdminId", "createdByName", "createdAt")
    VALUES (md5(random()::text || clock_timestamp()::text), ${input.purchaseOrderId}, ${input.eventType}, ${input.message}, ${actor.createdByAdminId}, ${actor.createdByName}, clock_timestamp())
  `;
}

export async function getPurchaseOrderTimeline(recordId: string) {
  const timeline = await prisma.$queryRaw<
    Array<{
      id: string;
      note: string;
      createdByName: string;
      createdAt: Date;
      kind: 'event' | 'note';
    }>
  >`
    SELECT id, message AS note, "createdByName", "createdAt", 'event' AS kind
    FROM "PurchaseOrderEvent"
    WHERE "purchaseOrderId" = ${recordId}
    UNION ALL
    SELECT id, note, "createdByName", "createdAt", 'note' AS kind
    FROM "PurchaseOrderNote"
    WHERE "purchaseOrderId" = ${recordId}
    ORDER BY "createdAt" DESC
  `;

  return timeline.map((entry) => ({
    createdAt: entry.createdAt.toISOString(),
    createdByName: entry.createdByName,
    id: entry.id,
    kind: entry.kind,
    note: entry.note,
  }));
}

export async function addPurchaseOrderNote(
  formData: FormData,
  options: PurchaseOrderNoteOptions,
): Promise<PurchaseOrderTimelineState> {
  try {
    const purchaseOrderId = String(formData.get('recordId') ?? '').trim();
    const note = String(formData.get('note') ?? '').trim();

    if (!purchaseOrderId) throw new Error('Purchase Order is required.');
    if (!note) throw new Error('Enter a note before saving.');

    const record = await prisma.purchaseOrder.findUnique({
      select: { id: true, status: true },
      where: { id: purchaseOrderId },
    });

    if (!record || !isAllowedPurchaseOrderNoteStatus(record.status, options.mode)) {
      throw new Error(getMissingRecordMessage(options.mode));
    }

    const actor = getEventActor(options.session);
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO "PurchaseOrderNote" ("id", "purchaseOrderId", "note", "createdByAdminId", "createdByName", "createdAt")
        VALUES (md5(random()::text || clock_timestamp()::text), ${record.id}, ${note}, ${actor.createdByAdminId}, ${actor.createdByName}, clock_timestamp())
      `;
      await tx.purchaseOrder.update({
        data: { notes: note },
        where: { id: record.id },
      });
    });

    for (const path of options.revalidatePaths) {
      revalidatePath(path);
    }
    if (options.revalidateRecordPath) {
      revalidatePath(options.revalidateRecordPath(record.id));
    }

    return {
      message: options.successMessage,
      notes: '',
      timeline: await getPurchaseOrderTimeline(record.id),
    };
  } catch (error) {
    return {
      error:
        error instanceof Error && error.message
          ? error.message
          : options.failureMessage,
    };
  }
}

export async function updatePurchaseOrderNote(
  formData: FormData,
  options: PurchaseOrderNoteOptions,
): Promise<PurchaseOrderTimelineState> {
  try {
    const noteId = String(formData.get('noteId') ?? '').trim();
    const note = String(formData.get('note') ?? '').trim();

    if (!noteId) throw new Error('PO note is required.');
    if (!note) throw new Error('Enter a note before saving.');

    const existingNotes = await prisma.$queryRaw<
      Array<{
        id: string;
        purchaseOrderId: string;
        status: string;
      }>
    >`
      SELECT n.id, n."purchaseOrderId", po.status
      FROM "PurchaseOrderNote" n
      INNER JOIN "PurchaseOrder" po ON po.id = n."purchaseOrderId"
      WHERE n.id = ${noteId}
      LIMIT 1
    `;
    const existingNote = existingNotes[0];

    if (
      !existingNote ||
      !isAllowedPurchaseOrderNoteStatus(existingNote.status, options.mode)
    ) {
      throw new Error(getMissingNoteMessage(options.mode));
    }

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE "PurchaseOrderNote"
        SET note = ${note},
            "createdByAdminId" = ${options.session.id === 'dev-admin' ? null : options.session.id},
            "createdByName" = ${options.session.name}
        WHERE id = ${existingNote.id}
      `;
      await tx.purchaseOrder.update({
        data: { notes: note },
        where: { id: existingNote.purchaseOrderId },
      });
    });

    for (const path of options.revalidatePaths) {
      revalidatePath(path);
    }
    if (options.revalidateRecordPath) {
      revalidatePath(options.revalidateRecordPath(existingNote.purchaseOrderId));
    }

    return {
      message: options.successMessage,
      notes: '',
      timeline: await getPurchaseOrderTimeline(existingNote.purchaseOrderId),
    };
  } catch (error) {
    return {
      error:
        error instanceof Error && error.message
          ? error.message
          : options.failureMessage,
    };
  }
}

export async function deletePurchaseOrderNote(
  formData: FormData,
  options: PurchaseOrderNoteOptions,
): Promise<PurchaseOrderTimelineState> {
  try {
    const noteId = String(formData.get('noteId') ?? '').trim();

    if (!noteId) throw new Error('PO note is required.');

    const existingNotes = await prisma.$queryRaw<
      Array<{
        id: string;
        purchaseOrderId: string;
        status: string;
      }>
    >`
      SELECT n.id, n."purchaseOrderId", po.status
      FROM "PurchaseOrderNote" n
      INNER JOIN "PurchaseOrder" po ON po.id = n."purchaseOrderId"
      WHERE n.id = ${noteId}
      LIMIT 1
    `;
    const existingNote = existingNotes[0];

    if (
      !existingNote ||
      !isAllowedPurchaseOrderNoteStatus(existingNote.status, options.mode)
    ) {
      throw new Error(getMissingNoteMessage(options.mode));
    }

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        DELETE FROM "PurchaseOrderNote"
        WHERE id = ${existingNote.id}
      `;

      const latestNotes = await tx.$queryRaw<Array<{ note: string }>>`
        SELECT note
        FROM "PurchaseOrderNote"
        WHERE "purchaseOrderId" = ${existingNote.purchaseOrderId}
        ORDER BY "createdAt" DESC
        LIMIT 1
      `;

      await tx.purchaseOrder.update({
        data: { notes: latestNotes[0]?.note ?? null },
        where: { id: existingNote.purchaseOrderId },
      });
    });

    for (const path of options.revalidatePaths) {
      revalidatePath(path);
    }
    if (options.revalidateRecordPath) {
      revalidatePath(options.revalidateRecordPath(existingNote.purchaseOrderId));
    }

    return {
      message: options.successMessage,
      notes: '',
      timeline: await getPurchaseOrderTimeline(existingNote.purchaseOrderId),
    };
  } catch (error) {
    return {
      error:
        error instanceof Error && error.message
          ? error.message
          : options.failureMessage,
    };
  }
}
