import { NextResponse } from 'next/server';
import { getCustomerSession } from '@/lib/customer-session';
import { hashPassword, verifyPassword } from '@/lib/password-auth';
import { prisma } from '@/lib/prisma';

type ChangePasswordBody = {
  currentPassword?: string;
  newPassword?: string;
};

export async function POST(request: Request) {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let body: ChangePasswordBody;
  try {
    body = (await request.json()) as ChangePasswordBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
  }

  const currentPassword = body.currentPassword?.trim() ?? '';
  const newPassword = body.newPassword?.trim() ?? '';

  if (!currentPassword) {
    return NextResponse.json(
      { error: 'Current password is required.' },
      { status: 400 },
    );
  }
  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: 'New password must be at least 8 characters.' },
      { status: 400 },
    );
  }
  if (newPassword === currentPassword) {
    return NextResponse.json(
      { error: 'New password must be different from the current password.' },
      { status: 400 },
    );
  }

  const customer = await prisma.customer.findUnique({
    where: { id: session.customerId },
    select: {
      id: true,
      passwordHash: true,
    },
  });

  if (!customer?.passwordHash) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const isCurrentPasswordValid = await verifyPassword(
    currentPassword,
    customer.passwordHash,
  );
  if (!isCurrentPasswordValid) {
    return NextResponse.json(
      { error: 'Current password is incorrect.' },
      { status: 400 },
    );
  }

  const nextPasswordHash = await hashPassword(newPassword);
  await prisma.customer.update({
    where: { id: customer.id },
    data: { passwordHash: nextPasswordHash },
  });

  return NextResponse.json({ success: true });
}
