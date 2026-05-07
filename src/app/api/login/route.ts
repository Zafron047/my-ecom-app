import { NextResponse } from 'next/server';
import { verifyPassword } from '@/lib/password-auth';
import { prisma } from '@/lib/prisma';

type LoginBody = {
  identifier?: string;
  nextPath?: string;
  password?: string;
  rememberMe?: boolean;
};

const CUSTOMER_SESSION_COOKIE = 'customer_id';
const CUSTOMER_AUTH_COOKIE = 'customer_auth';

function normalizePhoneVariants(phone: string) {
  const trimmed = phone.trim();
  if (trimmed.startsWith('+880')) {
    const local = `0${trimmed.slice(4)}`;
    return [local, trimmed];
  }
  if (/^01[3-9]\d{8}$/.test(trimmed)) {
    return [trimmed, `+88${trimmed}`];
  }
  return [trimmed];
}

function sanitizeNextPath(value: unknown): string {
  if (typeof value !== 'string') return '/';

  const trimmed = value.trim();
  if (!trimmed.startsWith('/')) return '/';
  if (trimmed.startsWith('//')) return '/';
  if (trimmed.startsWith('/admin')) return '/';
  return trimmed;
}

function createInvalidCredentialsResponse() {
  return NextResponse.json(
    { error: 'Invalid phone/email or password.' },
    { status: 401 },
  );
}

export async function POST(request: Request) {
  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
  }

  const identifier = body.identifier?.trim();
  const password = body.password?.trim();
  const rememberMe = Boolean(body.rememberMe);

  if (!identifier || !password) {
    return NextResponse.json(
      { error: 'Phone/email and password are required.' },
      { status: 400 },
    );
  }

  const isEmail = identifier.includes('@');
  const phoneCandidates = isEmail ? [] : normalizePhoneVariants(identifier);
  const customer = await prisma.customer.findFirst({
    where: isEmail
      ? { email: identifier.toLowerCase() }
      : { phone: { in: phoneCandidates } },
    select: {
      id: true,
      isBlocked: true,
      passwordHash: true,
    },
  });

  if (!customer || customer.isBlocked || !customer.passwordHash) {
    return createInvalidCredentialsResponse();
  }

  const isValidPassword = await verifyPassword(password, customer.passwordHash);
  if (!isValidPassword) {
    return createInvalidCredentialsResponse();
  }

  const response = NextResponse.json({
    redirectTo: sanitizeNextPath(body.nextPath),
    success: true,
  });

  const expiresAt = new Date(
    Date.now() + (rememberMe ? 1000 * 60 * 60 * 24 * 30 : 1000 * 60 * 60 * 24 * 7),
  );

  response.cookies.set(CUSTOMER_SESSION_COOKIE, customer.id, {
    expires: expiresAt,
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  response.cookies.set(CUSTOMER_AUTH_COOKIE, '1', {
    expires: expiresAt,
    httpOnly: false,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  return response;
}
