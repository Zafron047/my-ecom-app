import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as consumeReset } from '../src/app/api/password-reset/consume/route';
import { POST as requestReset } from '../src/app/api/password-reset/request/route';

const mocks = vi.hoisted(() => ({
  createExpiry: vi.fn(),
  createToken: vi.fn(),
  customerFindFirst: vi.fn(),
  customerSessionUpdateMany: vi.fn(),
  customerUpdate: vi.fn(),
  executeRawUnsafe: vi.fn(),
  hashPassword: vi.fn(),
  hashToken: vi.fn(),
  queryRawUnsafe: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('@/lib/customer-password-reset', () => ({
  createCustomerPasswordResetExpiry: mocks.createExpiry,
  createCustomerPasswordResetToken: mocks.createToken,
  createCustomerPasswordResetUrl: (origin: string, token: string) =>
    `${origin}/reset-password/${token}`,
  hashCustomerPasswordResetToken: mocks.hashToken,
}));

vi.mock('@/lib/password-auth', () => ({
  hashPassword: mocks.hashPassword,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $executeRawUnsafe: mocks.executeRawUnsafe,
    $queryRawUnsafe: mocks.queryRawUnsafe,
    $transaction: mocks.transaction,
    customer: {
      findFirst: mocks.customerFindFirst,
      update: mocks.customerUpdate,
    },
    customerSession: {
      updateMany: mocks.customerSessionUpdateMany,
    },
  },
}));

function postRequest(path: string, body: Record<string, unknown>) {
  return new Request(`https://example.test${path}`, {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
}

describe('customer password reset', () => {
  beforeEach(() => {
    mocks.createExpiry.mockReset();
    mocks.createToken.mockReset();
    mocks.customerFindFirst.mockReset();
    mocks.customerSessionUpdateMany.mockReset();
    mocks.customerUpdate.mockReset();
    mocks.executeRawUnsafe.mockReset();
    mocks.hashPassword.mockReset();
    mocks.hashToken.mockReset();
    mocks.queryRawUnsafe.mockReset();
    mocks.transaction.mockReset();

    mocks.createExpiry.mockReturnValue(new Date('2999-05-18T13:00:00.000Z'));
    mocks.createToken.mockReturnValue('reset-token');
    mocks.customerFindFirst.mockResolvedValue({
      id: 'customer-1',
      passwordHash: 'old-hash',
    });
    mocks.customerSessionUpdateMany.mockResolvedValue({ count: 1 });
    mocks.customerUpdate.mockResolvedValue({});
    mocks.executeRawUnsafe.mockResolvedValue(1);
    mocks.hashPassword.mockResolvedValue('new-hash');
    mocks.hashToken.mockReturnValue('reset-token-hash');
    mocks.queryRawUnsafe.mockResolvedValue([
      {
        customerId: 'customer-1',
        expiresAt: new Date('2999-05-18T13:00:00.000Z'),
        id: 'reset-row-1',
        isBlocked: false,
        usedAt: null,
      },
    ]);
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        $executeRawUnsafe: mocks.executeRawUnsafe,
        customer: { update: mocks.customerUpdate },
        customerSession: { updateMany: mocks.customerSessionUpdateMany },
      }),
    );
  });

  it('creates a hashed reset token for an existing customer account', async () => {
    const response = await requestReset(
      postRequest('/api/password-reset/request', {
        identifier: 'customer@example.test',
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      resetLink: 'https://example.test/reset-password/reset-token',
      success: true,
    });
    expect(mocks.customerFindFirst).toHaveBeenCalledWith({
      select: { id: true, passwordHash: true },
      where: { email: 'customer@example.test', isBlocked: false },
    });
    expect(mocks.executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "CustomerPasswordResetToken"'),
      expect.any(String),
      'customer-1',
      'reset-token-hash',
      expect.any(Date),
      expect.any(Date),
    );
  });

  it('returns a generic success without creating a token for unknown accounts', async () => {
    mocks.customerFindFirst.mockResolvedValue(null);

    const response = await requestReset(
      postRequest('/api/password-reset/request', {
        identifier: 'missing@example.test',
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(mocks.executeRawUnsafe).not.toHaveBeenCalled();
  });

  it('consumes a valid reset token, updates password, and revokes sessions', async () => {
    const response = await consumeReset(
      postRequest('/api/password-reset/consume', {
        newPassword: 'new-password',
        token: 'reset-token',
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(mocks.queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('FROM "CustomerPasswordResetToken"'),
      'reset-token-hash',
    );
    expect(mocks.customerUpdate).toHaveBeenCalledWith({
      data: { passwordHash: 'new-hash' },
      where: { id: 'customer-1' },
    });
    expect(mocks.customerSessionUpdateMany).toHaveBeenCalledWith({
      data: { revokedAt: expect.any(Date) },
      where: {
        customerId: 'customer-1',
        revokedAt: null,
      },
    });
  });

  it('rejects expired reset tokens', async () => {
    mocks.queryRawUnsafe.mockResolvedValue([
      {
        customerId: 'customer-1',
        expiresAt: new Date('2000-01-01T00:00:00.000Z'),
        id: 'reset-row-1',
        isBlocked: false,
        usedAt: null,
      },
    ]);

    const response = await consumeReset(
      postRequest('/api/password-reset/consume', {
        newPassword: 'new-password',
        token: 'reset-token',
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.customerUpdate).not.toHaveBeenCalled();
    expect(mocks.customerSessionUpdateMany).not.toHaveBeenCalled();
  });
});
