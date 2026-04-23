import {
  createHash,
  randomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(nodeScrypt);

export const ADMIN_SESSION_COOKIE = 'admin_session';
const SALT_BYTES = 16;
const KEY_LEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES).toString('hex');
  const derived = (await scrypt(password, salt, KEY_LEN)) as Buffer;
  return `scrypt:${salt}:${derived.toString('hex')}`;
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  const parts = passwordHash.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;

  const [, salt, expectedHex] = parts;
  const derived = (await scrypt(password, salt, KEY_LEN)) as Buffer;
  const expected = Buffer.from(expectedHex, 'hex');
  if (expected.length !== derived.length) return false;

  return timingSafeEqual(expected, derived);
}

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
