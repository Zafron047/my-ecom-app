import {
  getDeliveryAreas,
  getDeliveryDistricts,
  getDeliveryDivisions,
} from '@/lib/delivery-locations';
import { PUBLIC_STOREFRONT_CACHE_HEADERS } from '@/lib/http-cache';

const DELIVERY_CACHE_TTL_MS = 5 * 60_000;
const deliveryCache = new Map<string, { expiresAt: number; items: string[] }>();

async function getCachedItems(key: string, load: () => Promise<string[]>) {
  const now = Date.now();
  const cached = deliveryCache.get(key);
  if (cached && cached.expiresAt > now) return cached.items;

  const items = await load();
  deliveryCache.set(key, {
    expiresAt: now + DELIVERY_CACHE_TTL_MS,
    items,
  });
  return items;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get('type');
  const division = url.searchParams.get('division') ?? '';
  const district = url.searchParams.get('district') ?? '';

  if (type === 'districts') {
    return Response.json(
      {
        items: await getCachedItems(`districts:${division}`, () =>
          getDeliveryDistricts(division),
        ),
      },
      { headers: PUBLIC_STOREFRONT_CACHE_HEADERS },
    );
  }

  if (type === 'areas') {
    return Response.json(
      {
        items: await getCachedItems(`areas:${division}:${district}`, () =>
          getDeliveryAreas(division, district),
        ),
      },
      { headers: PUBLIC_STOREFRONT_CACHE_HEADERS },
    );
  }

  return Response.json(
    {
      items: await getCachedItems('divisions', getDeliveryDivisions),
    },
    { headers: PUBLIC_STOREFRONT_CACHE_HEADERS },
  );
}
