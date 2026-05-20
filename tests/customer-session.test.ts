import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCustomerSession } from '@/lib/customer-session';

const mocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  executeRawUnsafe: vi.fn(),
  hashCustomerSessionToken: vi.fn(),
  queryRawUnsafe: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: mocks.cookieGet,
  })),
}));

vi.mock('@/lib/customer-auth', () => ({
  CUSTOMER_SESSION_COOKIE: 'customer_session',
  hashCustomerSessionToken: mocks.hashCustomerSessionToken,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $executeRawUnsafe: mocks.executeRawUnsafe,
    $queryRawUnsafe: mocks.queryRawUnsafe,
  },
}));

describe('customer session lookup', () => {
  beforeEach(() => {
    mocks.cookieGet.mockReset();
    mocks.executeRawUnsafe.mockReset();
    mocks.hashCustomerSessionToken.mockReset();
    mocks.queryRawUnsafe.mockReset();

    mocks.cookieGet.mockReturnValue({ value: 'session-token' });
    mocks.executeRawUnsafe.mockResolvedValue(1);
    mocks.hashCustomerSessionToken.mockReturnValue('session-token-hash');
  });

  it('returns null without a customer session cookie', async () => {
    mocks.cookieGet.mockReturnValue(undefined);

    await expect(getCustomerSession()).resolves.toBeNull();
    expect(mocks.queryRawUnsafe).not.toHaveBeenCalled();
  });

  it('returns null when the database finds no active unexpired session', async () => {
    mocks.queryRawUnsafe.mockResolvedValue([]);

    await expect(getCustomerSession()).resolves.toBeNull();
    expect(mocks.queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('cs."expiresAt" > $2'),
      'session-token-hash',
      expect.any(Date),
    );
  });

  it('returns the customer id and refreshes stale lastSeenAt', async () => {
    mocks.queryRawUnsafe.mockResolvedValue([
      {
        customerId: 'customer-1',
        id: 'session-1',
        lastSeenAt: new Date('2000-01-01T00:00:00.000Z'),
      },
    ]);

    await expect(getCustomerSession()).resolves.toEqual({
      customerId: 'customer-1',
    });
    expect(mocks.executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE "CustomerSession"'),
      expect.any(Date),
      'session-1',
    );
  });
});
