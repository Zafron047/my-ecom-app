import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../src/app/api/orders/[orderNumber]/route';

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  getAdminSession: vi.fn(),
  getCustomerSession: vi.fn(),
  getCookie: vi.fn(),
  verifyRecentOrderAccessToken: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: mocks.getCookie,
  })),
}));

vi.mock('@/lib/admin-session', () => ({
  getAdminSession: mocks.getAdminSession,
}));

vi.mock('@/lib/customer-session', () => ({
  getCustomerSession: mocks.getCustomerSession,
}));

vi.mock('@/lib/customer-auth', () => ({
  CUSTOMER_RECENT_ORDER_COOKIE: 'recent_order_token',
  verifyRecentOrderAccessToken: mocks.verifyRecentOrderAccessToken,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: {
      findFirst: mocks.findFirst,
    },
  },
}));

function getOrder(orderNumber: string) {
  return GET(new Request(`https://example.test/api/orders/${orderNumber}`), {
    params: Promise.resolve({ orderNumber }),
  });
}

describe('order details route authorization', () => {
  beforeEach(() => {
    mocks.findFirst.mockReset();
    mocks.getAdminSession.mockReset();
    mocks.getCustomerSession.mockReset();
    mocks.getCookie.mockReset();
    mocks.verifyRecentOrderAccessToken.mockReset();

    mocks.getAdminSession.mockResolvedValue(null);
    mocks.getCustomerSession.mockResolvedValue(null);
    mocks.getCookie.mockReturnValue(undefined);
    mocks.verifyRecentOrderAccessToken.mockReturnValue(null);
  });

  it('rejects anonymous requests before looking up the order', async () => {
    const response = await getOrder('ORD-1001');

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized.' });
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it('scopes customer requests to their customer id', async () => {
    mocks.getCustomerSession.mockResolvedValue({ customerId: 'customer-1' });
    mocks.findFirst.mockResolvedValue(null);

    const response = await getOrder('ORD-1001');

    expect(response.status).toBe(404);
    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          orderNumber: 'ORD-1001',
          customerId: 'customer-1',
        },
      }),
    );
  });

  it('allows admins to look up any order number', async () => {
    mocks.getAdminSession.mockResolvedValue({
      id: 'admin-1',
      name: 'Admin',
      email: 'admin@example.test',
      role: 'admin',
    });
    mocks.findFirst.mockResolvedValue(null);

    const response = await getOrder('ORD-1001');

    expect(response.status).toBe(404);
    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderNumber: 'ORD-1001' },
      }),
    );
  });

  it('rejects recent-order tokens that do not match the requested order before lookup', async () => {
    mocks.getCookie.mockReturnValue({ value: 'recent-token' });
    mocks.verifyRecentOrderAccessToken.mockReturnValue('ORD-OTHER');

    const response = await getOrder('ORD-1001');

    expect(response.status).toBe(401);
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });
});
