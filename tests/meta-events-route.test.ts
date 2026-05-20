import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  checkDistributedRateLimit: vi.fn(),
  createMetaCapiEventId: vi.fn(),
  getClientIp: vi.fn(),
  rateLimitHeaders: vi.fn(),
  sendMetaServerEvent: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkDistributedRateLimit: mocks.checkDistributedRateLimit,
  getClientIp: mocks.getClientIp,
  rateLimitHeaders: mocks.rateLimitHeaders,
}));

vi.mock('@/lib/meta-capi', () => ({
  createMetaCapiEventId: mocks.createMetaCapiEventId,
  sendMetaServerEvent: mocks.sendMetaServerEvent,
}));

describe('/api/meta/events', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.checkDistributedRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 119,
      resetAt: Date.now() + 60_000,
    });
    mocks.createMetaCapiEventId.mockReturnValue('generated-event-id');
    mocks.getClientIp.mockReturnValue('203.0.113.10');
    mocks.rateLimitHeaders.mockReturnValue({ 'Retry-After': '60' });
    mocks.sendMetaServerEvent.mockResolvedValue({ skipped: false, ok: true });
  });

  it('rate limits tracking requests with no-store headers', async () => {
    mocks.checkDistributedRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
    });
    const { POST } = await import('@/app/api/meta/events/route');

    const response = await POST(
      new Request('https://shop.test/api/meta/events', { method: 'POST' }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(mocks.sendMetaServerEvent).not.toHaveBeenCalled();
  });

  it('validates event names and event ids before sending to Meta', async () => {
    const { POST } = await import('@/app/api/meta/events/route');

    const invalidEvent = await POST(
      new Request('https://shop.test/api/meta/events', {
        method: 'POST',
        body: JSON.stringify({ eventName: 'Lead' }),
      }),
    );
    expect(invalidEvent.status).toBe(400);

    const invalidEventId = await POST(
      new Request('https://shop.test/api/meta/events', {
        method: 'POST',
        body: JSON.stringify({ eventName: 'CompleteRegistration', eventId: 123 }),
      }),
    );
    expect(invalidEventId.status).toBe(400);
    expect(mocks.sendMetaServerEvent).not.toHaveBeenCalled();
  });

  it('rejects client-relayed Purchase events because checkout owns CAPI Purchase', async () => {
    const { POST } = await import('@/app/api/meta/events/route');

    const response = await POST(
      new Request('https://shop.test/api/meta/events', {
        method: 'POST',
        body: JSON.stringify({
          eventId: 'purchase.1',
          eventName: 'Purchase',
          eventSourceUrl: 'https://shop.test/order-confirmation',
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.sendMetaServerEvent).not.toHaveBeenCalled();
  });

  it('returns a safe response when CAPI throws', async () => {
    mocks.sendMetaServerEvent.mockRejectedValue(new Error('network down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { POST } = await import('@/app/api/meta/events/route');

    const response = await POST(
      new Request('https://shop.test/api/meta/events', {
        method: 'POST',
        body: JSON.stringify({
          eventId: 'registration.1',
          eventName: 'CompleteRegistration',
          eventSourceUrl: 'https://shop.test/register',
        }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(payload).toMatchObject({
      eventId: 'registration.1',
      ok: false,
      skipped: false,
      success: false,
    });
  });
});
