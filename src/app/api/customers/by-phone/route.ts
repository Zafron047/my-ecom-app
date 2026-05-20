import { getAdminSession } from '@/lib/admin-session';
import { getCustomerSession } from '@/lib/customer-session';
import { prisma } from '@/lib/prisma';

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('8801') && digits.length === 13) {
    const local = `0${digits.slice(3)}`;
    return { local, intl: `+${digits}` };
  }
  if (digits.startsWith('01') && digits.length === 11) {
    return { local: digits, intl: `+88${digits}` };
  }
  const trimmed = phone.trim();
  return { local: trimmed, intl: trimmed };
}

export async function GET(request: Request) {
  const adminSession = await getAdminSession();
  const customerSession = await getCustomerSession();
  const customerSessionId = customerSession?.customerId ?? null;

  const { searchParams } = new URL(request.url);
  const phone = searchParams.get('phone') ?? '';
  if (!phone.trim()) {
    return Response.json({ customer: null });
  }

  const normalized = normalizePhone(phone);
  const phoneWhere = {
    OR: [{ phone: normalized.local }, { phone: normalized.intl }],
  };
  const where = adminSession
    ? phoneWhere
    : customerSessionId
      ? { id: customerSessionId, ...phoneWhere }
      : { isBlocked: false, ...phoneWhere };
  const customer = await prisma.customer.findFirst({
    where,
    select: {
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      division: true,
      district: true,
      thana: true,
      address: true,
    },
  });

  return Response.json({ customer });
}
