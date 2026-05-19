import { createHash, randomBytes } from 'node:crypto';

const DEFAULT_RESET_TOKEN_TTL_MINUTES = 60;

export function createCustomerPasswordResetToken() {
  return randomBytes(32).toString('hex');
}

export function hashCustomerPasswordResetToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function createCustomerPasswordResetExpiry(now = new Date()) {
  const rawMinutes = process.env.CUSTOMER_PASSWORD_RESET_TTL_MINUTES;
  const parsedMinutes = rawMinutes ? Number(rawMinutes) : NaN;
  const ttlMinutes =
    Number.isFinite(parsedMinutes) && parsedMinutes > 0
      ? Math.floor(parsedMinutes)
      : DEFAULT_RESET_TOKEN_TTL_MINUTES;

  return new Date(now.getTime() + ttlMinutes * 60 * 1000);
}

export function createCustomerPasswordResetUrl(origin: string, token: string) {
  const url = new URL(`/reset-password/${token}`, origin);
  return url.toString();
}
