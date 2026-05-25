import { createHash, randomBytes } from 'node:crypto';

export const ADMIN_SESSION_COOKIE = 'admin_session';
export const ADMIN_ROLE_COOKIE = 'admin_role';
export const ADMIN_PASSWORD_MIN_LENGTH = 8;

export function createSessionToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function normalizeAdminEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const email = value.trim().toLowerCase();
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function normalizeAdminPhone(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const compact = value.trim().replace(/[\s().-]/g, '');
  if (!compact) return null;

  let phone = compact;
  if (phone.startsWith('+880')) {
    phone = `0${phone.slice(4)}`;
  } else if (phone.startsWith('00880')) {
    phone = `0${phone.slice(5)}`;
  } else if (phone.startsWith('880')) {
    phone = `0${phone.slice(3)}`;
  }

  return /^01\d{9}$/.test(phone) ? phone : null;
}

export function normalizeAdminLoginIdentifier(value: unknown):
  | { kind: 'email'; value: string }
  | { kind: 'phone'; value: string }
  | null {
  const email = normalizeAdminEmail(value);
  if (email) return { kind: 'email', value: email };

  const phone = normalizeAdminPhone(value);
  if (phone) return { kind: 'phone', value: phone };

  return null;
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

export function validateAdminPassword(password: unknown): string | null {
  if (typeof password !== 'string') return 'Password is required.';
  if (password.length < ADMIN_PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${ADMIN_PASSWORD_MIN_LENGTH} characters.`;
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must include at least one letter and one number.';
  }
  return null;
}
