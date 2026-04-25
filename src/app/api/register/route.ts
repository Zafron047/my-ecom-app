import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { hashPassword } from '@/lib/password-auth';
import { prisma } from '@/lib/prisma';

type RegisterBody = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  password?: string;
};

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

  try {
    const passwordHash = await hashPassword(password);

    const customer = await prisma.customer.create({
      data: {
        firstName,
        lastName: lastName || null,
        email,
        phone,
        passwordHash,
        customerType: 'retail',
        isBlocked: false,
        identifierTag: 'NEW',
      },
      select: {
        id: true,
      },
    });

    return NextResponse.json({ success: true, customerId: customer.id });
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
