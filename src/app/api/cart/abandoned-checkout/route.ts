import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

type AbandonedCheckoutPayload = {
  sessionId?: string;
  items?: Array<{
    id?: string;
    detailId?: string;
    variantId?: string;
    variantLabel?: string;
    name?: string;
    price?: number;
    salePrice?: number;
    image?: string;
    quantity?: number;
    selected?: boolean;
  }>;
  customer?: {
    name?: string;
    phone?: string;
    email?: string;
  };
};

function toMoney(value: number) {
  return Number(value.toFixed(2));
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as AbandonedCheckoutPayload;
    const sessionId = payload.sessionId?.trim();
    if (!sessionId) {
      return Response.json({ error: 'Cart session id is required.' }, { status: 400 });
    }

    const items = (payload.items ?? [])
      .map((item) => {
        const quantity = Math.max(1, Math.floor(item.quantity || 1));
        const price = Number(item.price ?? 0);
        const salePrice =
          typeof item.salePrice === 'number' && Number.isFinite(item.salePrice)
            ? item.salePrice
            : null;
        return {
          id: item.id?.trim() || '',
          productId: item.detailId?.trim() || item.id?.split('::')[0] || item.id || '',
          variantId: item.variantId?.trim() || null,
          variantLabel: item.variantLabel?.trim() || null,
          name: item.name?.trim() || 'Product',
          image: item.image || null,
          quantity,
          selected: item.selected ?? true,
          unitPrice: toMoney(Number.isFinite(price) ? price : 0),
          salePrice: salePrice === null ? null : toMoney(salePrice),
          lineSubtotal: toMoney((salePrice ?? price) * quantity),
        };
      })
      .filter((item) => item.id && item.productId && item.quantity > 0);

    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotalEstimate = toMoney(
      items.reduce((sum, item) => sum + item.lineSubtotal, 0),
    );
    const status = itemCount > 0 ? 'active' : 'cleared';
    const now = new Date();

    await prisma.abandonedCheckout.upsert({
      where: { sessionId },
      update: {
        status,
        items: items as Prisma.InputJsonValue,
        itemCount,
        subtotalEstimate,
        customerName: payload.customer?.name?.trim() || null,
        phone: payload.customer?.phone?.trim() || null,
        email: payload.customer?.email?.trim() || null,
        lastActivityAt: now,
        completedAt: status === 'cleared' ? now : null,
      },
      create: {
        sessionId,
        status,
        items: items as Prisma.InputJsonValue,
        itemCount,
        subtotalEstimate,
        customerName: payload.customer?.name?.trim() || null,
        phone: payload.customer?.phone?.trim() || null,
        email: payload.customer?.email?.trim() || null,
        lastActivityAt: now,
        completedAt: status === 'cleared' ? now : null,
      },
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: 'Failed to save abandoned checkout.' },
      { status: 500 },
    );
  }
}
