import { NextResponse } from 'next/server';
import {
  createMetaCapiEventId,
  sendMetaServerEvent,
  type MetaServerEventName,
} from '@/lib/meta-capi';
import { withPrivateNoStoreHeaders } from '@/lib/http-cache';
import {
  checkDistributedRateLimit,
  getClientIp,
  rateLimitHeaders,
} from '@/lib/rate-limit';

const ALLOWED_META_EVENTS = new Set<MetaServerEventName>([
  'PageView',
  'ViewContent',
  'Search',
  'AddToCart',
  'InitiateCheckout',
  'CompleteRegistration',
  'CancelOrder',
  'ReturnOrder',
]);

const META_EVENTS_RATE_LIMIT = {
  limit: 120,
  windowMs: 60_000,
};

type MetaEventsRequestBody = {
  eventId?: string;
  eventName?: string;
  eventSourceUrl?: string;
  parameters?: Record<string, unknown>;
  user?: {
    email?: string | null;
    externalId?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
  };
};

function getOptionalString(value: unknown, maxLength: number) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  return trimmed;
}

function sanitizeCustomData(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

  const input = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(input).filter(([, entry]) => {
      if (entry === null || entry === undefined) return true;
      if (['string', 'number', 'boolean'].includes(typeof entry)) return true;
      if (Array.isArray(entry)) return true;
      return false;
    }),
  );
}

export async function POST(request: Request) {
  const rateLimit = await checkDistributedRateLimit({
    key: `meta:events:${getClientIp(request)}`,
    ...META_EVENTS_RATE_LIMIT,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many tracking requests.' },
      withPrivateNoStoreHeaders({
        status: 429,
        headers: rateLimitHeaders(rateLimit, META_EVENTS_RATE_LIMIT.limit),
      }),
    );
  }

  let body: MetaEventsRequestBody;
  try {
    body = (await request.json()) as MetaEventsRequestBody;
  } catch {
    return NextResponse.json(
      { error: 'Invalid request payload.' },
      withPrivateNoStoreHeaders({ status: 400 }),
    );
  }

  if (!body.eventName || !ALLOWED_META_EVENTS.has(body.eventName as MetaServerEventName)) {
    return NextResponse.json(
      { error: 'Unsupported Meta event.' },
      withPrivateNoStoreHeaders({ status: 400 }),
    );
  }

  const eventName = body.eventName as MetaServerEventName;
  const requestedEventId = getOptionalString(body.eventId, 160);
  if (requestedEventId === null) {
    return NextResponse.json(
      { error: 'Invalid Meta event id.' },
      withPrivateNoStoreHeaders({ status: 400 }),
    );
  }

  const requestedEventSourceUrl = getOptionalString(body.eventSourceUrl, 2048);
  if (requestedEventSourceUrl === null) {
    return NextResponse.json(
      { error: 'Invalid Meta event source URL.' },
      withPrivateNoStoreHeaders({ status: 400 }),
    );
  }

  const eventId = requestedEventId || createMetaCapiEventId(eventName.toLowerCase());
  const result = await sendMetaServerEvent({
    customData: sanitizeCustomData(body.parameters),
    eventId,
    eventName,
    eventSourceUrl: requestedEventSourceUrl,
    request,
    user: body.user,
  }).catch((error) => {
    console.error('Meta CAPI event failed', eventName, error);
    return { skipped: false as const, ok: false as const };
  });

  return NextResponse.json(
    {
      eventId,
      success: !('ok' in result) || result.ok !== false,
      ...result,
    },
    withPrivateNoStoreHeaders(),
  );
}
