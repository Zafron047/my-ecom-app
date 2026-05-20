import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../src/app/api/account/sessions/revoke-all/route';

const mocks = vi.hoisted(() => ({
  cookieDelete: vi.fn(),
  getCustomerSession: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    delete: mocks.cookieDelete,
  })),
}));

vi.mock('@/lib/customer-session', () => ({
  getCustomerSession: mocks.getCustomerSession,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    customerSession: {
      updateMany: mocks.updateMany,
    },
  },
}));

describe('customer session management', () => {
  beforeEach(() => {
    mocks.cookieDelete.mockReset();
    mocks.getCustomerSession.mockReset();
    mocks.updateMany.mockReset();

    mocks.getCustomerSession.mockResolvedValue({ customerId: 'customer-1' });
    mocks.updateMany.mockResolvedValue({ count: 2 });
  });

  it('requires a logged-in customer', async () => {
    mocks.getCustomerSession.mockResolvedValue(null);

    const response = await POST();

    expect(response.status).toBe(401);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it('revokes all active sessions and clears customer cookies', async () => {
    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(mocks.updateMany).toHaveBeenCalledWith({
      data: { revokedAt: expect.any(Date) },
      where: {
        customerId: 'customer-1',
        revokedAt: null,
      },
    });
    expect(mocks.cookieDelete).toHaveBeenCalledWith('customer_session');
    expect(mocks.cookieDelete).toHaveBeenCalledWith('customer_auth');
    expect(mocks.cookieDelete).toHaveBeenCalledWith('recent_order_token');
  });
});
