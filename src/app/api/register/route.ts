import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import {
  CUSTOMER_AUTH_COOKIE,
  CUSTOMER_SESSION_COOKIE,
  createCustomerSessionToken,
  hashCustomerSessionToken,
} from '@/lib/customer-auth';
import { hashPassword } from '@/lib/password-auth';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

type RegisterBody = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  password?: string;
};

function getPhoneVariants(phone: string) {
  const trimmed = phone.trim();
  if (trimmed.startsWith('+880')) {
    const local = `0${trimmed.slice(4)}`;
    return { canonical: local, variants: [local, trimmed] };
  }
  if (/^01[3-9]\d{8}$/.test(trimmed)) {
    const intl = `+88${trimmed}`;
    return { canonical: trimmed, variants: [trimmed, intl] };
  }
  return { canonical: trimmed, variants: [trimmed] };
}

async function createAuthenticatedRegistrationResponse(customerId: string) {
  const response = NextResponse.json({
    redirectTo: '/',
    success: true,
    customerId,
  });
  const sessionToken = createCustomerSessionToken();
  const sessionTokenHash = hashCustomerSessionToken(sessionToken);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
  const now = new Date();

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "CustomerSession"
      ("id", "customerId", "sessionTokenHash", "expiresAt", "lastSeenAt", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $5, $5)
    `,
    randomUUID(),
    customerId,
    sessionTokenHash,
    expiresAt,
    now,
  );

  response.cookies.set(CUSTOMER_SESSION_COOKIE, sessionToken, {
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

export async function POST(request: Request) {
  let body: RegisterBody;
  try {
    body = (await request.json()) as RegisterBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
  }

  const firstName = body.firstName?.trim();
  const lastName = body.lastName?.trim();
  const phone = body.phone?.trim();
  const email = body.email?.trim().toLowerCase() || null;
  const password = body.password?.trim();

  if (!firstName) {
    return NextResponse.json({ error: 'First name is required.' }, { status: 400 });
  }

  if (!phone) {
    return NextResponse.json({ error: 'Phone number is required.' }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json(
      { error: 'Password must be at least 8 characters.' },
      { status: 400 },
    );
  }

  const normalizedRateLimitPhone = phone.toLowerCase();
  const rateLimit = checkRateLimit({
    key: `customer-register:${getClientIp(request)}:${normalizedRateLimitPhone}`,
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many registration attempts. Please try again later.' },
      { status: 429 },
    );
  }

  try {
    const passwordHash = await hashPassword(password);
    const normalizedPhone = getPhoneVariants(phone);

    const existingByPhone = await prisma.customer.findFirst({
      where: {
        phone: {
          in: normalizedPhone.variants,
        },
      },
      select: { id: true, passwordHash: true },
    });
    if (existingByPhone) {
      if (existingByPhone.passwordHash) {
        return NextResponse.json(
          { error: 'A customer with this phone already exists.' },
          { status: 409 },
        );
      }

      await prisma.customer.update({
        where: { id: existingByPhone.id },
        data: {
          firstName,
          lastName: lastName || null,
          email,
          phone: normalizedPhone.canonical,
          passwordHash,
        },
      });

      return createAuthenticatedRegistrationResponse(existingByPhone.id);
    }

    const customer = await prisma.customer.create({
      data: {
        firstName,
        lastName: lastName || null,
        email,
        phone: normalizedPhone.canonical,
        passwordHash,
        customerType: 'retail',
        isBlocked: false,
        identifierTag: 'NEW',
      },
      select: {
        id: true,
      },
    });

    return createAuthenticatedRegistrationResponse(customer.id);
  } catch (error) {
    console.error('register_api_error', error);

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const message = error.message.toLowerCase();
      const duplicateField = message.includes('phone') ? 'phone' : message.includes('email') ? 'email' : 'email or phone';
      return NextResponse.json(
        { error: `A customer with this ${duplicateField} already exists.` },
        { status: 409 },
      );
    }

    if (error instanceof Error && process.env.NODE_ENV !== 'production') {
      return NextResponse.json(
        { error: `Registration failed: ${error.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: 'Could not create customer account. Please try again.' },
      { status: 500 },
    );
  }
}
