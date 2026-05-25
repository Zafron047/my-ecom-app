import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  createCustomerPasswordResetExpiry,
  createCustomerPasswordResetToken,
  createCustomerPasswordResetUrl,
  hashCustomerPasswordResetToken,
} from '@/lib/customer-password-reset';
import { getPublicAppOrigin } from '@/lib/app-url';
import { sendCustomerPasswordResetEmail } from '@/lib/password-reset-email';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

type RequestPasswordResetBody = {
  identifier?: string;
};

function normalizePhoneVariants(phone: string) {
  const trimmed = phone.trim();
  if (trimmed.startsWith('+880')) {
    return [`0${trimmed.slice(4)}`, trimmed];
  }
  if (/^01[3-9]\d{8}$/.test(trimmed)) {
    return [trimmed, `+88${trimmed}`];
  }
  return [trimmed];
}

function genericResponse() {
  return NextResponse.json({ success: true });
}

export async function POST(request: Request) {
  let body: RequestPasswordResetBody;
  try {
    body = (await request.json()) as RequestPasswordResetBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
  }

  const identifier = body.identifier?.trim() ?? '';
  if (!identifier) {
    return NextResponse.json(
      { error: 'Phone or email is required.' },
      { status: 400 },
    );
  }

  const rateLimit = checkRateLimit({
    key: `customer-password-reset:${getClientIp(request)}:${identifier.toLowerCase()}`,
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many password reset requests. Please try again later.' },
      { status: 429 },
    );
  }

  const isEmail = identifier.includes('@');
  const customer = await prisma.customer.findFirst({
    where: isEmail
      ? { email: identifier.toLowerCase(), isBlocked: false }
      : { phone: { in: normalizePhoneVariants(identifier) }, isBlocked: false },
    select: {
      email: true,
      id: true,
      passwordHash: true,
    },
  });

  if (!customer?.passwordHash) {
    return genericResponse();
  }

  const token = createCustomerPasswordResetToken();
  const tokenHash = hashCustomerPasswordResetToken(token);
  const expiresAt = createCustomerPasswordResetExpiry();
  const now = new Date();

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "CustomerPasswordResetToken"
      ("id", "customerId", "tokenHash", "expiresAt", "createdAt")
      VALUES ($1, $2, $3, $4, $5)
    `,
    randomUUID(),
    customer.id,
    tokenHash,
    expiresAt,
    now,
  );

  const resetLink = createCustomerPasswordResetUrl(
    getPublicAppOrigin(request.url),
    token,
  );
  if (customer.email) {
    await sendCustomerPasswordResetEmail({
      expiresAt,
      resetLink,
      to: customer.email,
    });
  }

  return genericResponse();
}
