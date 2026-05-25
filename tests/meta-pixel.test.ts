import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  markMetaPurchaseEventTracked,
  shouldTrackMetaPurchaseEvent,
  trackMetaAddToCart,
  trackMetaInitiateCheckout,
  trackMetaSearch,
  trackMetaViewContent,
} from '@/lib/meta-pixel';
import { isPublicStorefrontMarketingPath } from '@/lib/meta-routes';
import type { CartItem } from '@/store/cartSlice';

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe('Meta Pixel routing and duplicate prevention', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('allows marketing pixels only on public storefront paths', () => {
    expect(isPublicStorefrontMarketingPath('/')).toBe(true);
    expect(isPublicStorefrontMarketingPath('/products/abc')).toBe(true);
    expect(isPublicStorefrontMarketingPath('/collections/sale')).toBe(true);
    expect(isPublicStorefrontMarketingPath('/checkout')).toBe(true);
    expect(isPublicStorefrontMarketingPath('/order-confirmation')).toBe(true);

    expect(isPublicStorefrontMarketingPath('/admin')).toBe(false);
    expect(isPublicStorefrontMarketingPath('/admin/orders')).toBe(false);
    expect(isPublicStorefrontMarketingPath('/api/meta/events')).toBe(false);
    expect(isPublicStorefrontMarketingPath('/_next/static/chunk.js')).toBe(false);
    expect(isPublicStorefrontMarketingPath('/login')).toBe(false);
    expect(isPublicStorefrontMarketingPath('/auth/session')).toBe(false);
    expect(isPublicStorefrontMarketingPath('/register')).toBe(false);
    expect(isPublicStorefrontMarketingPath('/forgot-password')).toBe(false);
    expect(isPublicStorefrontMarketingPath('/reset-password/token')).toBe(false);
    expect(isPublicStorefrontMarketingPath('/account')).toBe(false);
  });

  it('prevents the same browser Purchase event from being tracked twice', () => {
    const storage = createStorage();

    expect(shouldTrackMetaPurchaseEvent(storage, 'ORD-1', 'purchase.1')).toBe(true);

    markMetaPurchaseEventTracked(storage, 'ORD-1', 'purchase.1');

    expect(shouldTrackMetaPurchaseEvent(storage, 'ORD-1', 'purchase.1')).toBe(false);
    expect(shouldTrackMetaPurchaseEvent(storage, 'ORD-1', 'purchase.2')).toBe(true);
  });

  it('sends upper-funnel browser events to the server for CAPI deduplication', () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const item = {
      detailId: 'product-1',
      id: 'line-1',
      name: 'Kitchen Rack',
      price: 1200,
      quantity: 2,
      salePrice: 999,
      selected: true,
      variantId: 'variant-1',
    } as CartItem;

    trackMetaViewContent({
      content_ids: ['variant-1'],
      content_name: 'Kitchen Rack',
      content_type: 'product',
      currency: 'BDT',
      value: 999,
    });
    trackMetaSearch({
      search_string: 'rack',
      content_ids: ['product-1'],
      contents: [{ id: 'product-1' }],
    });
    trackMetaAddToCart(item, 1);
    trackMetaInitiateCheckout([item], 1998);

    expect(fetchMock).toHaveBeenCalledTimes(4);
    const eventNames = fetchMock.mock.calls.map(([, init]) => {
      const body = JSON.parse(String(init?.body));
      return body.eventName;
    });

    expect(eventNames).toEqual([
      'ViewContent',
      'Search',
      'AddToCart',
      'InitiateCheckout',
    ]);
  });
});
