import { createHash, randomBytes } from 'node:crypto';

const DEFAULT_RESET_TOKEN_TTL_MINUTES = 60;

export function createPasswordResetToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashPasswordResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createPasswordResetExpiry(now = new Date()): Date {
  const rawMinutes = process.env.ADMIN_PASSWORD_RESET_TTL_MINUTES;
  const parsedMinutes = rawMinutes ? Number(rawMinutes) : NaN;
  const ttlMinutes =
    Number.isFinite(parsedMinutes) && parsedMinutes > 0
      ? Math.floor(parsedMinutes)
      : DEFAULT_RESET_TOKEN_TTL_MINUTES;

  return new Date(now.getTime() + ttlMinutes * 60 * 1000);
}

export function createAdminPasswordResetUrl(origin: string, token: string): string {
  const url = new URL(`/admin-access/reset-password/${token}`, origin);
  return url.toString();
}
