import { prisma } from '@/lib/prisma';

function normalizePhone(phone: string) {
  const trimmed = phone.trim();
  if (trimmed.startsWith('+880')) {
    const local = `0${trimmed.slice(4)}`;
    return { local, intl: trimmed };
  }
  if (/^01[3-9]\d{8}$/.test(trimmed)) {
    return { local: trimmed, intl: `+88${trimmed}` };
  }
  return { local: trimmed, intl: trimmed };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get('phone') ?? '';
  if (!phone.trim()) {
    return Response.json({ customer: null });
  }

  const normalized = normalizePhone(phone);
  const customer = await prisma.customer.findFirst({
    where: {
      OR: [{ phone: normalized.local }, { phone: normalized.intl }],
    },
    select: {
      id: true,
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

