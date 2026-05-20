'use client';

import type { CartItem } from '@/store/cartSlice';

export type MetaStandardEventName =
  | 'PageView'
  | 'ViewContent'
  | 'Search'
  | 'AddToCart'
  | 'InitiateCheckout'
  | 'Purchase'
  | 'CompleteRegistration';

export type MetaCustomEventName = 'CancelOrder' | 'ReturnOrder';
export type MetaEventName = MetaStandardEventName | MetaCustomEventName;

export type MetaEventPayload = Record<
  string,
  string | number | boolean | null | undefined | string[] | object[]
>;

export type MetaContentItem = {
  id: string;
  item_price?: number;
  quantity: number;
};

declare global {
  interface Window {
    fbq?: (
      command: 'init' | 'track' | 'trackCustom',
      eventNameOrPixelId: string,
      parameters?: MetaEventPayload,
      options?: { eventID?: string },
    ) => void;
    _fbq?: unknown;
  }
}

export const META_EVENT_STORAGE_PREFIX = 'meta_event_id_';
export const META_PURCHASE_EVENT_STORAGE_PREFIX = `${META_EVENT_STORAGE_PREFIX}purchase_`;

const CUSTOM_META_EVENTS = new Set<MetaEventName>(['CancelOrder', 'ReturnOrder']);

export function isMetaPixelEnabled() {
  // Only NEXT_PUBLIC_* values are exposed to browser bundles.
  return Boolean(process.env.NEXT_PUBLIC_META_PIXEL_ID);
}

export function createMetaEventId(prefix: string) {
  // Event IDs connect browser Pixel and server CAPI copies of the same event.
  const randomPart =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}.${randomPart}`;
}

export function readStoredMetaEventId(storageKey: string) {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(storageKey);
}

export function rememberMetaEventId(storageKey: string, eventId: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey, eventId);
}

export function hasTrackedMetaEvent(storageKey: string, eventId: string) {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(`${storageKey}_tracked`) === eventId;
}

export function markMetaEventTracked(storageKey: string, eventId: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(`${storageKey}_tracked`, eventId);
}

export function shouldTrackMetaPurchaseEvent(
  storage: Pick<Storage, 'getItem'>,
  orderId: string,
  eventId: string,
) {
  const trackedKey = `${META_PURCHASE_EVENT_STORAGE_PREFIX}${orderId}_tracked`;
  return storage.getItem(trackedKey) !== eventId;
}

export function markMetaPurchaseEventTracked(
  storage: Pick<Storage, 'setItem'>,
  orderId: string,
  eventId: string,
) {
  const trackedKey = `${META_PURCHASE_EVENT_STORAGE_PREFIX}${orderId}_tracked`;
  storage.setItem(trackedKey, eventId);
}

export function trackMetaEvent(
  eventName: MetaEventName,
  parameters: MetaEventPayload = {},
  eventId = createMetaEventId(eventName.toLowerCase()),
) {
  if (!isMetaPixelEnabled()) return eventId;
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') {
    return eventId;
  }

  const command = CUSTOM_META_EVENTS.has(eventName) ? 'trackCustom' : 'track';
  window.fbq(command, eventName, parameters, { eventID: eventId });
  return eventId;
}

export async function sendMetaEventToServer(args: {
  eventId: string;
  eventName: MetaEventName;
  eventSourceUrl?: string;
  parameters?: MetaEventPayload;
  user?: {
    email?: string | null;
    externalId?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
  };
}) {
  try {
    await fetch('/api/meta/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify(args),
    });
  } catch {
    // Marketing tracking must never block storefront UX.
  }
}

export function trackMetaBrowserAndServerEvent(args: {
  eventId?: string;
  eventName: MetaEventName;
  parameters?: MetaEventPayload;
  sendServer?: boolean;
  user?: Parameters<typeof sendMetaEventToServer>[0]['user'];
}) {
  const eventId = trackMetaEvent(args.eventName, args.parameters, args.eventId);
  if (args.sendServer) {
    void sendMetaEventToServer({
      eventId,
      eventName: args.eventName,
      eventSourceUrl: typeof window !== 'undefined' ? window.location.href : undefined,
      parameters: args.parameters,
      user: args.user,
    });
  }
  return eventId;
}

export function buildMetaContents(
  items: Array<
    Pick<CartItem, 'detailId' | 'id' | 'variantId' | 'quantity' | 'price' | 'salePrice' | 'name'>
  >,
): MetaContentItem[] {
  return items.map((item) => ({
    id: item.variantId ?? item.detailId ?? item.id,
    item_price: item.salePrice ?? item.price,
    quantity: item.quantity,
  }));
}

export function buildMetaCartPayload(items: CartItem[], value: number): MetaEventPayload {
  return {
    content_ids: items.map((item) => item.variantId ?? item.detailId ?? item.id),
    content_type: 'product',
    contents: buildMetaContents(items),
    currency: 'BDT',
    num_items: items.reduce((sum, item) => sum + item.quantity, 0),
    value,
  };
}

export function trackMetaAddToCart(item: CartItem, quantity: number) {
  return trackMetaEvent('AddToCart', {
    content_ids: [item.variantId ?? item.detailId ?? item.id],
    content_name: item.name,
    content_type: 'product',
    contents: buildMetaContents([{ ...item, quantity }]),
    currency: 'BDT',
    value: (item.salePrice ?? item.price) * quantity,
  });
}

export function trackMetaInitiateCheckout(items: CartItem[], value: number) {
  return trackMetaEvent('InitiateCheckout', buildMetaCartPayload(items, value));
}

export function trackMetaPurchase(args: {
  eventId: string;
  items: CartItem[];
  orderId: string;
  value: number;
}) {
  return trackMetaEvent(
    'Purchase',
    {
      ...buildMetaCartPayload(args.items, args.value),
      order_id: args.orderId,
    },
    args.eventId,
  );
}

export function trackMetaCompleteRegistration(eventId?: string) {
  return trackMetaBrowserAndServerEvent({
    eventId,
    eventName: 'CompleteRegistration',
    parameters: { status: true },
    sendServer: true,
  });
}

export function trackMetaCancelOrder(args: {
  eventId?: string;
  orderId: string;
  value?: number;
}) {
  return trackMetaBrowserAndServerEvent({
    eventId: args.eventId,
    eventName: 'CancelOrder',
    parameters: {
      currency: 'BDT',
      order_id: args.orderId,
      value: args.value,
    },
    sendServer: true,
  });
}

export function trackMetaReturnOrder(args: {
  eventId?: string;
  orderId: string;
  value?: number;
}) {
  return trackMetaBrowserAndServerEvent({
    eventId: args.eventId,
    eventName: 'ReturnOrder',
    parameters: {
      currency: 'BDT',
      order_id: args.orderId,
      value: args.value,
    },
    sendServer: true,
  });
}
