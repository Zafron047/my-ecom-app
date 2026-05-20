import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../src/app/api/logout/route';

const mocks = vi.hoisted(() => ({
  cookieDelete: vi.fn(),
  cookieGet: vi.fn(),
  executeRawUnsafe: vi.fn(),
  hashCustomerSessionToken: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    delete: mocks.cookieDelete,
    get: mocks.cookieGet,
  })),
}));

vi.mock('@/lib/customer-auth', () => ({
  CUSTOMER_AUTH_COOKIE: 'customer_auth',
  CUSTOMER_RECENT_ORDER_COOKIE: 'recent_order_token',
  CUSTOMER_SESSION_COOKIE: 'customer_session',
  hashCustomerSessionToken: mocks.hashCustomerSessionToken,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $executeRawUnsafe: mocks.executeRawUnsafe,
  },
}));

describe('customer logout', () => {
  beforeEach(() => {
    mocks.cookieDelete.mockReset();
    mocks.cookieGet.mockReset();
    mocks.executeRawUnsafe.mockReset();
    mocks.hashCustomerSessionToken.mockReset();

    mocks.cookieGet.mockReturnValue({ value: 'session-token' });
    mocks.executeRawUnsafe.mockResolvedValue(1);
    mocks.hashCustomerSessionToken.mockReturnValue('session-token-hash');
  });

  it('revokes the active session and clears cookies', async () => {
    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(mocks.executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE "CustomerSession"'),
      expect.any(Date),
      'session-token-hash',
    );
    expect(mocks.cookieDelete).toHaveBeenCalledWith('customer_session');
    expect(mocks.cookieDelete).toHaveBeenCalledWith('customer_auth');
    expect(mocks.cookieDelete).toHaveBeenCalledWith('recent_order_token');
  });

  it('clears cookies even without an active session cookie', async () => {
    mocks.cookieGet.mockReturnValue(undefined);

    const response = await POST();

    expect(response.status).toBe(200);
    expect(mocks.executeRawUnsafe).not.toHaveBeenCalled();
    expect(mocks.cookieDelete).toHaveBeenCalledWith('customer_session');
  });
});
