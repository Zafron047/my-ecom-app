import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../src/app/api/register/route';

const mocks = vi.hoisted(() => ({
  createCustomerSessionToken: vi.fn(),
  customerCreate: vi.fn(),
  customerFindFirst: vi.fn(),
  customerUpdate: vi.fn(),
  executeRawUnsafe: vi.fn(),
  hashCustomerSessionToken: vi.fn(),
  hashPassword: vi.fn(),
}));

vi.mock('@/lib/customer-auth', () => ({
  CUSTOMER_AUTH_COOKIE: 'customer_auth',
  CUSTOMER_SESSION_COOKIE: 'customer_session',
  createCustomerSessionToken: mocks.createCustomerSessionToken,
  hashCustomerSessionToken: mocks.hashCustomerSessionToken,
}));

vi.mock('@/lib/password-auth', () => ({
  hashPassword: mocks.hashPassword,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $executeRawUnsafe: mocks.executeRawUnsafe,
    customer: {
      create: mocks.customerCreate,
      findFirst: mocks.customerFindFirst,
      update: mocks.customerUpdate,
    },
  },
}));

function registerRequest(body: Record<string, unknown>) {
  return new Request('https://example.test/api/register', {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
}

describe('customer registration auth session', () => {
  beforeEach(() => {
    mocks.createCustomerSessionToken.mockReset();
    mocks.customerCreate.mockReset();
    mocks.customerFindFirst.mockReset();
    mocks.customerUpdate.mockReset();
    mocks.executeRawUnsafe.mockReset();
    mocks.hashCustomerSessionToken.mockReset();
    mocks.hashPassword.mockReset();

    mocks.createCustomerSessionToken.mockReturnValue('session-token');
    mocks.customerCreate.mockResolvedValue({ id: 'customer-1' });
    mocks.customerFindFirst.mockResolvedValue(null);
    mocks.customerUpdate.mockResolvedValue({ id: 'customer-existing' });
    mocks.executeRawUnsafe.mockResolvedValue(undefined);
    mocks.hashCustomerSessionToken.mockReturnValue('session-token-hash');
    mocks.hashPassword.mockResolvedValue('password-hash');
  });

  it('creates a customer session and sets auth cookies after registration', async () => {
    const response = await POST(
      registerRequest({
        email: 'NINA@EXAMPLE.TEST',
        firstName: 'Nina',
        lastName: 'Rahman',
        password: 'password123',
        phone: '+8801712345678',
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      customerId: 'customer-1',
      redirectTo: '/',
      success: true,
    });
    expect(mocks.customerFindFirst).toHaveBeenCalledWith({
      select: { id: true, passwordHash: true },
      where: {
        phone: {
          in: ['01712345678', '+8801712345678'],
        },
      },
    });
    expect(mocks.customerCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'nina@example.test',
          phone: '01712345678',
          passwordHash: 'password-hash',
        }),
      }),
    );
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

  it('claims an existing guest checkout customer that has no password', async () => {
    mocks.customerFindFirst.mockResolvedValue({
      id: 'customer-existing',
      passwordHash: null,
    });

    const response = await POST(
      registerRequest({
        email: 'nina@example.test',
        firstName: 'Nina',
        password: 'password123',
        phone: '01712345678',
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      customerId: 'customer-existing',
      redirectTo: '/',
      success: true,
    });
    expect(mocks.customerCreate).not.toHaveBeenCalled();
    expect(mocks.customerUpdate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'nina@example.test',
        firstName: 'Nina',
        passwordHash: 'password-hash',
        phone: '01712345678',
      }),
      where: { id: 'customer-existing' },
    });
    expect(mocks.executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "CustomerSession"'),
      expect.any(String),
      'customer-existing',
      'session-token-hash',
      expect.any(Date),
      expect.any(Date),
    );
  });

  it('does not create a session when the phone already has an account password', async () => {
    mocks.customerFindFirst.mockResolvedValue({
      id: 'customer-existing',
      passwordHash: 'existing-password-hash',
    });

    const response = await POST(
      registerRequest({
        firstName: 'Nina',
        password: 'password123',
        phone: '01712345678',
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'A customer with this phone already exists.',
    });
    expect(mocks.customerCreate).not.toHaveBeenCalled();
    expect(mocks.customerUpdate).not.toHaveBeenCalled();
    expect(mocks.executeRawUnsafe).not.toHaveBeenCalled();
  });
});
