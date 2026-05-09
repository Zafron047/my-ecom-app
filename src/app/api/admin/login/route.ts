import { NextResponse } from 'next/server';
import {
  ADMIN_ROLE_COOKIE,
  ADMIN_SESSION_COOKIE,
  createSessionExpiry,
  createSessionToken,
  hashSessionToken,
  normalizeAdminLoginIdentifier,
  sanitizeNextPath,
} from '@/lib/admin-auth';
import { logAdminAudit } from '@/lib/admin-audit';
import { verifyPassword } from '@/lib/password-auth';
import { prisma } from '@/lib/prisma';

type LoginBody = {
  email?: string;
  identifier?: string;
  nextPath?: string;
  password?: string;
  rememberMe?: boolean;
};

function createInvalidCredentialsResponse() {
  return NextResponse.json(
    { error: 'Invalid email/mobile or password.' },
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
  const login = normalizeAdminLoginIdentifier(body.identifier ?? body.email);
  const password = typeof body.password === 'string' ? body.password : '';

  if (!login || !password) {
    return NextResponse.json(
      { error: 'Email/mobile and password are required.' },
      { status: 400 },
    );
  }

  const adminUser = await prisma.adminUser.findFirst({
    where:
      login.kind === 'email'
        ? { email: login.value }
        : { phone: login.value },
  });

  if (!adminUser || !adminUser.isActive) {
    await logAdminAudit({
      action: 'login',
      entityId: login.value,
      entityType: 'admin_auth',
      message: 'Admin login failed.',
      metadata: {
        loginIdentifier: login.value,
        loginType: login.kind,
        reason: 'invalid_credentials_or_inactive',
      },
      request,
    });
    return createInvalidCredentialsResponse();
  }

  const isValidPassword = await verifyPassword(password, adminUser.passwordHash);
  if (!isValidPassword) {
    await logAdminAudit({
      action: 'login',
      entityId: adminUser.id,
      entityType: 'admin_auth',
      message: 'Admin login failed.',
      metadata: {
        email: adminUser.email,
        loginIdentifier: login.value,
        loginType: login.kind,
        reason: 'invalid_password',
      },
      request,
    });
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

  const redirectTo = adminUser.mustResetPassword
    ? '/admin/profile?forcePasswordReset=1'
    : sanitizeNextPath(body.nextPath);

  await logAdminAudit({
    action: 'login',
    actorAdminId: adminUser.id,
    entityId: adminUser.id,
    entityType: 'admin_auth',
    message: 'Admin login succeeded.',
    metadata: {
      email: adminUser.email,
      loginIdentifier: login.value,
      loginType: login.kind,
      rememberMe,
    },
    request,
  });

  const response = NextResponse.json({
    redirectTo,
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
  response.cookies.set(ADMIN_ROLE_COOKIE, adminUser.role, {
    expires: expiresAt,
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  return response;
}
