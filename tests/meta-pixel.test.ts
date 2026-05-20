import { describe, expect, it } from 'vitest';
import {
  markMetaPurchaseEventTracked,
  shouldTrackMetaPurchaseEvent,
} from '@/lib/meta-pixel';
import { isPublicStorefrontMarketingPath } from '@/lib/meta-routes';

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
});
