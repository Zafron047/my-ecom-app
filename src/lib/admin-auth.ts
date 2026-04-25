import { createHash, randomBytes } from 'node:crypto';

export const ADMIN_SESSION_COOKIE = 'admin_session';

export function createSessionToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createSessionExpiry(rememberMe: boolean): Date {
  const now = Date.now();
  const millis = rememberMe
    ? 1000 * 60 * 60 * 24 * 30
    : 1000 * 60 * 60 * 24 * 7;
  return new Date(now + millis);
}

export function sanitizeNextPath(value: unknown): string {
  if (typeof value !== 'string') return '/admin';

  const trimmed = value.trim();
  if (!trimmed.startsWith('/')) return '/admin';
  if (trimmed.startsWith('//')) return '/admin';
  return trimmed;
}
