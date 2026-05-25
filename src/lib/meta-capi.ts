import { createHash, randomUUID } from 'crypto';

export type MetaServerEventName =
  | 'PageView'
  | 'ViewContent'
  | 'Search'
  | 'AddToCart'
  | 'InitiateCheckout'
  | 'Purchase'
  | 'CompleteRegistration'
  | 'CancelOrder'
  | 'ReturnOrder';

export type MetaServerUserInput = {
  city?: string | null;
  country?: string | null;
  email?: string | null;
  externalId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
};

export type MetaServerCustomData = {
  content_ids?: string[];
  content_name?: string;
  content_type?: 'product' | string;
  contents?: { id: string; quantity: number; item_price?: number }[];
  currency?: string;
  num_items?: number;
  order_id?: string;
  search_string?: string;
  status?: boolean;
  value?: number;
};

type MetaUserData = {
  client_ip_address?: string;
  client_user_agent?: string;
  ct?: string[];
  country?: string[];
  em?: string[];
  external_id?: string[];
  fbc?: string;
  fbp?: string;
  fn?: string[];
  ln?: string[];
  ph?: string[];
};

type MetaServerEvent = {
  action_source: 'website';
  custom_data?: MetaServerCustomData;
  event_id: string;
  event_name: MetaServerEventName;
  event_source_url?: string;
  event_time: number;
  user_data: MetaUserData;
};

export type SendMetaEventArgs = {
  customData?: MetaServerCustomData;
  eventId: string;
  eventName: MetaServerEventName;
  eventSourceUrl?: string;
  request: Request;
  user?: MetaServerUserInput;
};

type SendPurchaseArgs = {
  eventId: string;
  eventSourceUrl?: string;
  order: {
    customerId: string;
    district: string;
    email: string | null;
    firstName: string;
    id: string;
    lastName: string | null;
    orderNumber: string;
    phone: string;
    products: {
      productId: string;
      quantity: number;
      unitPrice: unknown;
      variantId: string;
    }[];
    totalAmount: unknown;
  };
  request: Request;
};

const META_CAPI_TIMEOUT_MS = 2500;

function getMetaPixelId() {
  return process.env.META_PIXEL_ID || process.env.NEXT_PUBLIC_META_PIXEL_ID || '';
}

export function isMetaCapiConfigured() {
  return Boolean(getMetaPixelId() && process.env.META_CAPI_ACCESS_TOKEN);
}

function getMetaApiVersion() {
  return process.env.META_CAPI_API_VERSION || process.env.FACEBOOK_API_VERSION || 'v25.0';
}

function normalizeForHash(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

export function sha256MetaValue(value: string | null | undefined) {
  const normalized = normalizeForHash(value);
  if (!normalized) return undefined;
  return createHash('sha256').update(normalized).digest('hex');
}

function normalizePhoneForHash(value: string | null | undefined) {
  const digits = value?.replace(/\D/g, '') ?? '';
  if (!digits) return '';
  if (digits.startsWith('880')) return digits;
  if (digits.startsWith('0')) return `88${digits}`;
  return digits;
}

function getCookieValue(request: Request, name: string) {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return undefined;

  return cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function getClientIpForMeta(request: Request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    undefined
  );
}

function toNumber(value: unknown) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  if (value && typeof value === 'object' && 'toNumber' in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value);
}

function compactArray(value: Array<string | undefined>) {
  return value.filter((entry): entry is string => Boolean(entry));
}

export function createMetaCapiEventId(prefix: string, stableId?: string) {
  // Stable prefix + random suffix makes events unique while staying debuggable.
  return [prefix, stableId, randomUUID()].filter(Boolean).join('.');
}

export function buildMetaUserData(
  request: Request,
  user: MetaServerUserInput = {},
): MetaUserData {
  const userData: MetaUserData = {
    client_ip_address: getClientIpForMeta(request),
    client_user_agent: request.headers.get('user-agent') ?? undefined,
    fbc: getCookieValue(request, '_fbc'),
    fbp: getCookieValue(request, '_fbp'),
  };

  const emailHashes = compactArray([sha256MetaValue(user.email)]);
  if (emailHashes.length > 0) userData.em = emailHashes;
  const phoneHashes = compactArray([sha256MetaValue(normalizePhoneForHash(user.phone))]);
  if (phoneHashes.length > 0) userData.ph = phoneHashes;
  const firstNameHashes = compactArray([sha256MetaValue(user.firstName)]);
  if (firstNameHashes.length > 0) userData.fn = firstNameHashes;
  const lastNameHashes = compactArray([sha256MetaValue(user.lastName)]);
  if (lastNameHashes.length > 0) userData.ln = lastNameHashes;
  const cityHashes = compactArray([sha256MetaValue(user.city)]);
  if (cityHashes.length > 0) userData.ct = cityHashes;
  const countryHashes = compactArray([sha256MetaValue(user.country ?? 'bd')]);
  if (countryHashes.length > 0) userData.country = countryHashes;
  const externalIdHashes = compactArray([sha256MetaValue(user.externalId)]);
  if (externalIdHashes.length > 0) userData.external_id = externalIdHashes;

  return userData;
}

export async function sendMetaServerEvent({
  customData,
  eventId,
  eventName,
  eventSourceUrl,
  request,
  user,
}: SendMetaEventArgs) {
  const pixelId = getMetaPixelId();
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN;
  if (!pixelId || !accessToken) {
    return { skipped: true as const, reason: 'missing_config' };
  }

  const event: MetaServerEvent = {
    action_source: 'website',
    custom_data: customData,
    event_id: eventId,
    event_name: eventName,
    event_source_url: eventSourceUrl,
    event_time: Math.floor(Date.now() / 1000),
    user_data: buildMetaUserData(request, user),
  };

  const url = new URL(
    `https://graph.facebook.com/${getMetaApiVersion()}/${pixelId}/events`,
  );
  url.searchParams.set('access_token', accessToken);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), META_CAPI_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        data: [event],
        // Meta Events Manager test events use this code to show server events in real time.
        ...(process.env.META_TEST_EVENT_CODE
          ? { test_event_code: process.env.META_TEST_EVENT_CODE }
          : {}),
      }),
    });
  } catch (error) {
    console.error('Meta CAPI event failed', eventName, error);
    return { skipped: false as const, ok: false as const };
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    console.error('Meta CAPI event failed', eventName, response.status, message);
    return { skipped: false as const, ok: false as const };
  }

  return { skipped: false as const, ok: true as const };
}

export async function sendMetaPurchaseEvent({
  eventId,
  eventSourceUrl,
  order,
  request,
}: SendPurchaseArgs) {
  return sendMetaServerEvent({
    eventId,
    eventName: 'Purchase',
    eventSourceUrl,
    request,
    user: {
      city: order.district,
      email: order.email,
      externalId: order.customerId,
      firstName: order.firstName,
      lastName: order.lastName,
      phone: order.phone,
    },
    customData: {
      content_ids: order.products.map((product) => product.variantId || product.productId),
      content_type: 'product',
      contents: order.products.map((product) => ({
        id: product.variantId || product.productId,
        item_price: toNumber(product.unitPrice),
        quantity: product.quantity,
      })),
      currency: 'BDT',
      num_items: order.products.reduce((sum, product) => sum + product.quantity, 0),
      order_id: order.orderNumber,
      value: toNumber(order.totalAmount),
    },
  });
}
