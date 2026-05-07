import { describe, expect, it, vi } from 'vitest';
import {
  normalizeAdminEmail,
  sanitizeNextPath,
  validateAdminPassword,
} from '../src/lib/admin-auth';
import {
  createPasswordResetExpiry,
  hashPasswordResetToken,
} from '../src/lib/admin-password-reset';

describe('admin auth hardening helpers', () => {
  it('normalizes valid admin email and rejects invalid values', () => {
    expect(normalizeAdminEmail(' Owner@Example.COM ')).toBe('owner@example.com');
    expect(normalizeAdminEmail('not-an-email')).toBeNull();
    expect(normalizeAdminEmail(undefined)).toBeNull();
  });

  it('keeps next redirects on relative paths', () => {
    expect(sanitizeNextPath('/admin/settings')).toBe('/admin/settings');
    expect(sanitizeNextPath('https://evil.example')).toBe('/admin');
    expect(sanitizeNextPath('//evil.example/admin')).toBe('/admin');
  });

  it('enforces the admin password floor', () => {
    expect(validateAdminPassword('short1')).toMatch(/at least/);
    expect(validateAdminPassword('longbutwithoutnumber')).toMatch(/letter and one number/);
    expect(validateAdminPassword('strong-password-123')).toBeNull();
  });

  it('hashes reset tokens deterministically without returning the raw token', () => {
    const token = 'reset-token';
    const hash = hashPasswordResetToken(token);

    expect(hash).toBe(hashPasswordResetToken(token));
    expect(hash).not.toBe(token);
  });

  it('uses the configured reset token ttl when present', () => {
    vi.stubEnv('ADMIN_PASSWORD_RESET_TTL_MINUTES', '15');
    const now = new Date('2026-05-07T12:00:00.000Z');

    expect(createPasswordResetExpiry(now).toISOString()).toBe(
      '2026-05-07T12:15:00.000Z',
    );

    vi.unstubAllEnvs();
  });
});
