import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../src/app/api/account/password/route';

const mocks = vi.hoisted(() => ({
  customerFindUnique: vi.fn(),
  customerUpdate: vi.fn(),
  getCustomerSession: vi.fn(),
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock('@/lib/customer-session', () => ({
  getCustomerSession: mocks.getCustomerSession,
}));

vi.mock('@/lib/password-auth', () => ({
  hashPassword: mocks.hashPassword,
  verifyPassword: mocks.verifyPassword,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    customer: {
      findUnique: mocks.customerFindUnique,
      update: mocks.customerUpdate,
    },
  },
}));

function changePasswordRequest(body: Record<string, unknown>) {
  return new Request('https://example.test/api/account/password', {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
}

describe('customer password change', () => {
  beforeEach(() => {
    mocks.customerFindUnique.mockReset();
    mocks.customerUpdate.mockReset();
    mocks.getCustomerSession.mockReset();
    mocks.hashPassword.mockReset();
    mocks.verifyPassword.mockReset();

    mocks.customerFindUnique.mockResolvedValue({
      id: 'customer-1',
      passwordHash: 'old-hash',
    });
    mocks.customerUpdate.mockResolvedValue({});
    mocks.getCustomerSession.mockResolvedValue({ customerId: 'customer-1' });
    mocks.hashPassword.mockResolvedValue('new-hash');
    mocks.verifyPassword.mockResolvedValue(true);
  });

  it('requires a logged-in customer', async () => {
    mocks.getCustomerSession.mockResolvedValue(null);

    const response = await POST(
      changePasswordRequest({
        currentPassword: 'old-password',
        newPassword: 'new-password',
      }),
    );

    expect(response.status).toBe(401);
    expect(mocks.customerUpdate).not.toHaveBeenCalled();
  });

  it('rejects an incorrect current password', async () => {
    mocks.verifyPassword.mockResolvedValue(false);

    const response = await POST(
      changePasswordRequest({
        currentPassword: 'old-password',
        newPassword: 'new-password',
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Current password is incorrect.',
    });
    expect(mocks.customerUpdate).not.toHaveBeenCalled();
  });

  it('updates the password hash when the current password is valid', async () => {
    const response = await POST(
      changePasswordRequest({
        currentPassword: 'old-password',
        newPassword: 'new-password',
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(mocks.customerFindUnique).toHaveBeenCalledWith({
      select: { id: true, passwordHash: true },
      where: { id: 'customer-1' },
    });
    expect(mocks.verifyPassword).toHaveBeenCalledWith('old-password', 'old-hash');
    expect(mocks.hashPassword).toHaveBeenCalledWith('new-password');
    expect(mocks.customerUpdate).toHaveBeenCalledWith({
      data: { passwordHash: 'new-hash' },
      where: { id: 'customer-1' },
    });
  });
});
