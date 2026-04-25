import { NextResponse } from 'next/server';
import {
  ADMIN_SESSION_COOKIE,
  createSessionExpiry,
  createSessionToken,
  hashSessionToken,
  sanitizeNextPath,
} from '@/lib/admin-auth';
import { verifyPassword } from '@/lib/password-auth';
import { prisma } from '@/lib/prisma';

type LoginBody = {
  email?: string;
  nextPath?: string;
  password?: string;
  rememberMe?: boolean;
};

function createInvalidCredentialsResponse() {
  return NextResponse.json(
    { error: 'Invalid email or password.' },
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
  const email = body.email?.trim().toLowerCase();
  const password = body.password?.trim();

  if (!email || !password) {
    return NextResponse.json(
      { error: 'Email and password are required.' },
      { status: 400 },
    );
  }

  const adminUser = await prisma.adminUser.findUnique({
    where: { email },
  });

  if (!adminUser || !adminUser.isActive) {
    return createInvalidCredentialsResponse();
  }

  const isValidPassword = await verifyPassword(password, adminUser.passwordHash);
  if (!isValidPassword) {
    return createInvalidCredentialsResponse();
  }

  const rememberMe = Boolean(body.rememberMe);
  const expiresAt = createSessionExpiry(rememberMe);
  const sessionToken = createSessionToken();
  const sessionTokenHash = hashSessionToken(sessionToken);

  await prisma.adminSession.create({
    data: {
      adminUserId: adminUser.id,
      sessionTokenHash,
      expiresAt,
    },
  });

  const response = NextResponse.json({
    redirectTo: sanitizeNextPath(body.nextPath),
    success: true,
  });

  response.cookies.set(ADMIN_SESSION_COOKIE, sessionToken, {
    expires: expiresAt,
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  // Role hint helps proxy do optimistic redirects; server-side guards still enforce DB-backed auth.
  response.cookies.set('admin_role', adminUser.role, {
    expires: expiresAt,
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  return response;
}
