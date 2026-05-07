import { createHash, createHmac, randomBytes } from 'crypto';

export const CUSTOMER_SESSION_COOKIE = 'customer_session';
export const CUSTOMER_AUTH_COOKIE = 'customer_auth';
export const CUSTOMER_RECENT_ORDER_COOKIE = 'recent_order_token';

const RECENT_ORDER_TOKEN_TTL_SECONDS = 60 * 60 * 24;

function getOrderTokenSecret() {
  return process.env.CUSTOMER_ORDER_TOKEN_SECRET || process.env.ADMIN_AUTH_SECRET || '';
}

export function createCustomerSessionToken() {
  return randomBytes(32).toString('hex');
}

export function hashCustomerSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function createRecentOrderAccessToken(orderNumber: string, nowMs = Date.now()) {
  const secret = getOrderTokenSecret();
  if (!secret) return null;

  const exp = Math.floor(nowMs / 1000) + RECENT_ORDER_TOKEN_TTL_SECONDS;
  const payload = `${orderNumber}.${exp}`;
  const signature = createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${signature}`;
}

export function verifyRecentOrderAccessToken(token: string, nowMs = Date.now()) {
  const secret = getOrderTokenSecret();
  if (!secret) return null;

  const parts = token.split('.');
  if (parts.length < 3) return null;
  const orderNumber = parts.slice(0, parts.length - 2).join('.');
  const expRaw = parts[parts.length - 2] ?? '';
  const signature = parts[parts.length - 1] ?? '';
  const exp = Number(expRaw);
  if (!orderNumber || !Number.isFinite(exp) || exp <= 0 || !signature) {
    return null;
  }
  if (Math.floor(nowMs / 1000) > exp) {
    return null;
  }

  const payload = `${orderNumber}.${exp}`;
  const expected = createHmac('sha256', secret).update(payload).digest('hex');
  if (signature !== expected) return null;
  return orderNumber;
}

