import { beforeEach, describe, expect, it } from 'vitest';
import {
  checkRateLimit,
  clearRateLimitBucketsForTests,
  getClientIp,
} from '@/lib/rate-limit';

describe('rate limit helper', () => {
  beforeEach(() => {
    clearRateLimitBucketsForTests();
  });

  it('allows requests until the limit is reached', () => {
    expect(
      checkRateLimit({ key: 'login:a', limit: 2, windowMs: 1000 }, 100),
    ).toMatchObject({ allowed: true, remaining: 1 });
    expect(
      checkRateLimit({ key: 'login:a', limit: 2, windowMs: 1000 }, 200),
    ).toMatchObject({ allowed: true, remaining: 0 });
    expect(
      checkRateLimit({ key: 'login:a', limit: 2, windowMs: 1000 }, 300),
    ).toMatchObject({ allowed: false, remaining: 0 });
  });

  it('resets the bucket after the window', () => {
    expect(
      checkRateLimit({ key: 'register:a', limit: 1, windowMs: 1000 }, 100),
    ).toMatchObject({ allowed: true });
    expect(
      checkRateLimit({ key: 'register:a', limit: 1, windowMs: 1000 }, 200),
    ).toMatchObject({ allowed: false });
    expect(
      checkRateLimit({ key: 'register:a', limit: 1, windowMs: 1000 }, 1200),
    ).toMatchObject({ allowed: true });
  });

  it('uses the first forwarded IP address', () => {
    const request = new Request('https://example.test', {
      headers: {
        'x-forwarded-for': '203.0.113.10, 198.51.100.20',
      },
    });

    expect(getClientIp(request)).toBe('203.0.113.10');
  });
});
