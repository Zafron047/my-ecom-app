import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../src/app/api/login/route';

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  createCustomerSessionToken: vi.fn(),
  customerFindFirst: vi.fn(),
  executeRawUnsafe: vi.fn(),
  hashCustomerSessionToken: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock('@/lib/customer-auth', () => ({
  CUSTOMER_AUTH_COOKIE: 'customer_auth',
  CUSTOMER_SESSION_COOKIE: 'customer_session',
  createCustomerSessionToken: mocks.createCustomerSessionToken,
  hashCustomerSessionToken: mocks.hashCustomerSessionToken,
}));

vi.mock('@/lib/password-auth', () => ({
  verifyPassword: mocks.verifyPassword,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $executeRawUnsafe: mocks.executeRawUnsafe,
    customer: {
      findFirst: mocks.customerFindFirst,
    },
  },
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: mocks.checkRateLimit,
  getClientIp: vi.fn(() => '127.0.0.1'),
}));

function loginRequest(body: Record<string, unknown>) {
  return new Request('https://example.test/api/login', {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
}

describe('customer login', () => {
  beforeEach(() => {
    mocks.checkRateLimit.mockReset();
    mocks.createCustomerSessionToken.mockReset();
    mocks.customerFindFirst.mockReset();
    mocks.executeRawUnsafe.mockReset();
    mocks.hashCustomerSessionToken.mockReset();
    mocks.verifyPassword.mockReset();

    mocks.checkRateLimit.mockReturnValue({ allowed: true });
    mocks.createCustomerSessionToken.mockReturnValue('session-token');
    mocks.customerFindFirst.mockResolvedValue({
      id: 'customer-1',
      isBlocked: false,
      passwordHash: 'password-hash',
    });
    mocks.executeRawUnsafe.mockResolvedValue(undefined);
    mocks.hashCustomerSessionToken.mockReturnValue('session-token-hash');
    mocks.verifyPassword.mockResolvedValue(true);
  });

  it('creates a customer session after valid credentials', async () => {
    const response = await POST(
      loginRequest({
        identifier: '01712345678',
        nextPath: '/account',
        password: 'password123',
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      redirectTo: '/account',
      success: true,
    });
    expect(mocks.executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "CustomerSession"'),
      expect.any(String),
      'customer-1',
      'session-token-hash',
      expect.any(Date),
      expect.any(Date),
    );
    const setCookie = response.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('customer_session=session-token');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('customer_auth=1');
  });

  it('rejects blocked customers', async () => {
    mocks.customerFindFirst.mockResolvedValue({
      id: 'customer-1',
      isBlocked: true,
      passwordHash: 'password-hash',
    });

    const response = await POST(
      loginRequest({ identifier: '01712345678', password: 'password123' }),
    );

    expect(response.status).toBe(401);
    expect(mocks.executeRawUnsafe).not.toHaveBeenCalled();
  });

  it('rejects too many attempts before lookup', async () => {
    mocks.checkRateLimit.mockReturnValue({ allowed: false });

    const response = await POST(
      loginRequest({ identifier: '01712345678', password: 'password123' }),
    );

    expect(response.status).toBe(429);
    expect(mocks.customerFindFirst).not.toHaveBeenCalled();
  });
});
