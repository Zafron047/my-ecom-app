import 'server-only';

import { type AuditAction, type Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

type AuditRequestMetadata = {
  ipAddress?: string;
  userAgent?: string;
};

type LogAdminAuditInput = {
  action: AuditAction;
  actorAdminId?: string | null;
  entityId: string;
  entityType: string;
  message?: string;
  metadata?: Prisma.InputJsonValue;
  request?: Request;
};

export function getAuditRequestMetadata(request: Request): AuditRequestMetadata {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ipAddress = forwardedFor?.split(',')[0]?.trim() || realIp?.trim();
  const userAgent = request.headers.get('user-agent')?.trim();

  return {
    ipAddress: ipAddress || undefined,
    userAgent: userAgent || undefined,
  };
}

export async function logAdminAudit(input: LogAdminAuditInput) {
  const requestMetadata = input.request
    ? getAuditRequestMetadata(input.request)
    : {};

  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        actorAdminId: input.actorAdminId ?? null,
        entityId: input.entityId,
        entityType: input.entityType,
        ipAddress: requestMetadata.ipAddress,
        message: input.message,
        metadata: input.metadata,
        userAgent: requestMetadata.userAgent,
      },
    });
  } catch (error) {
    console.error('Failed to write admin audit log.', error);
  }
}
