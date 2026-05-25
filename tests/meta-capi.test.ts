import { createHash } from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  sendMetaPurchaseEvent,
  sendMetaServerEvent,
  sha256MetaValue,
} from '@/lib/meta-capi';

function setEnv(values: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe('Meta CAPI', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setEnv({
      FACEBOOK_API_VERSION: undefined,
      META_CAPI_ACCESS_TOKEN: undefined,
      META_CAPI_API_VERSION: undefined,
      META_PIXEL_ID: undefined,
      META_TEST_EVENT_CODE: undefined,
      NEXT_PUBLIC_META_PIXEL_ID: undefined,
    });
  });

  it('skips without env vars and does not call Meta', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendMetaServerEvent({
      eventId: 'purchase.1',
      eventName: 'Purchase',
      request: new Request('https://shop.test/checkout'),
    });

    expect(result).toEqual({ skipped: true, reason: 'missing_config' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('defaults to Graph API v25.0 and hashes normalized user_data', async () => {
    setEnv({
      META_CAPI_ACCESS_TOKEN: 'token',
      META_PIXEL_ID: 'pixel-123',
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await sendMetaServerEvent({
      eventId: 'purchase.1',
      eventName: 'Purchase',
      request: new Request('https://shop.test/checkout', {
        headers: {
          cookie: '_fbp=fbp-cookie; _fbc=fbc-cookie',
          'user-agent': 'vitest-agent',
          'x-forwarded-for': '203.0.113.10, 198.51.100.20',
        },
      }),
      user: {
        email: ' ADA@Example.COM ',
        externalId: ' Customer-1 ',
        firstName: ' Ada ',
        lastName: ' Lovelace ',
        phone: '01711-111111',
      },
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('https://graph.facebook.com/v25.0/pixel-123/events');

    const body = JSON.parse(String(init.body));
    const userData = body.data[0].user_data;
    expect(userData.em).toEqual([sha256MetaValue('ada@example.com')]);
    expect(userData.ph).toEqual([
      createHash('sha256').update('8801711111111').digest('hex'),
    ]);
    expect(userData.fn).toEqual([sha256MetaValue('ada')]);
    expect(userData.ln).toEqual([sha256MetaValue('lovelace')]);
    expect(userData.external_id).toEqual([sha256MetaValue('customer-1')]);

    const serializedBody = JSON.stringify(body);
    expect(serializedBody).not.toContain('ADA@Example.COM');
    expect(serializedBody).not.toContain('01711-111111');
    expect(serializedBody).not.toContain('Ada');
    expect(serializedBody).not.toContain('Lovelace');
  });

  it('reports failed Purchase CAPI responses without throwing', async () => {
    setEnv({
      META_CAPI_ACCESS_TOKEN: 'token',
      META_PIXEL_ID: 'pixel-123',
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('bad gateway', { status: 502 })),
    );

    await expect(
      sendMetaPurchaseEvent({
        eventId: 'purchase.1',
        request: new Request('https://shop.test/checkout'),
        order: {
          customerId: 'customer-1',
          district: 'Dhaka',
          email: 'ada@example.com',
          firstName: 'Ada',
          id: 'order-id',
          lastName: 'Lovelace',
          orderNumber: 'ORD-1',
          phone: '01711111111',
          products: [
            {
              productId: 'product-1',
              quantity: 1,
              unitPrice: 100,
              variantId: 'variant-1',
            },
          ],
          totalAmount: 100,
        },
      }),
    ).resolves.toEqual({ skipped: false, ok: false });
  });
});
