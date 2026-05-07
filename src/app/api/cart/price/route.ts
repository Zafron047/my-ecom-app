import { prisma } from '@/lib/prisma';
import { computeCartPricing } from '@/lib/cart-bundle-pricing';

type CartPricePayload = {
  items: Array<{
    id: string;
    detailId?: string;
    variantId?: string;
    quantity: number;
  }>;
};

function toMoney(value: number) {
  return Number(value.toFixed(2));
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as CartPricePayload;
    if (!Array.isArray(payload?.items) || payload.items.length === 0) {
      return Response.json(
        {
          linePricingById: {},
          subtotalBeforeDiscount: 0,
          discountTotal: 0,
          subtotal: 0,
        },
        { status: 200 },
      );
    }

    const seenLineIds = new Set<string>();
    for (const item of payload.items) {
      const lineId = typeof item?.id === 'string' ? item.id.trim() : '';
      if (!lineId) {
        return Response.json({ error: 'Invalid cart line id.' }, { status: 400 });
      }
      if (seenLineIds.has(lineId)) {
        return Response.json(
          { error: `Duplicate cart line id detected: ${lineId}` },
          { status: 400 },
        );
      }
      seenLineIds.add(lineId);
    }

    const productIds = [...new Set(payload.items.map((item) => item.detailId ?? item.id).filter(Boolean))];
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        status: 'active',
      },
      include: {
        variants: {
          where: { isActive: true },
        },
        bundleOffers: {
          where: { isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            variants: {
              select: { variantId: true },
            },
          },
        },
      },
    });

    const productById = new Map(products.map((product) => [product.id, product]));
    const offersByProductId = new Map(
      products.map((product) => [
        product.id,
        product.bundleOffers.map((offer) => ({
          id: offer.id,
          title: offer.title?.trim() || 'Bundle Offer',
          minTotalQty: offer.minTotalQty,
          discountPercent: offer.discountPercent.toNumber(),
          variantIds: offer.variants.map((item) => item.variantId),
          isActive: offer.isActive,
        })),
      ]),
    );

    const pricingLines: Array<{
      id: string;
      productId: string;
      variantId?: string;
      quantity: number;
      unitPrice: number;
    }> = [];

    for (const item of payload.items) {
      const productId = item.detailId ?? item.id;
      const product = productById.get(productId);
      if (!product) continue;
      const variant =
        product.variants.find((candidate) => candidate.id === item.variantId) ??
        (product.variants.length === 1 ? product.variants[0] : undefined);
      if (!variant) continue;

      pricingLines.push({
        id: item.id,
        productId,
        variantId: variant.id,
        quantity: Math.max(1, Math.floor(item.quantity || 1)),
        unitPrice: toMoney(variant.price.toNumber()),
      });
    }

    const pricing = computeCartPricing(
      pricingLines,
      (productId) => offersByProductId.get(productId) ?? [],
    );

    const normalizedLinePricingById = Object.fromEntries(
      Object.entries(pricing.linePricingById).map(([lineId, line]) => [
        lineId,
        {
          ...line,
          lineSubtotal: toMoney(line.lineSubtotal),
          lineDiscount: toMoney(line.lineDiscount),
          lineTotal: toMoney(line.lineTotal),
        },
      ]),
    );

    return Response.json({
      linePricingById: normalizedLinePricingById,
      subtotalBeforeDiscount: toMoney(pricing.subtotalBeforeDiscount),
      discountTotal: toMoney(pricing.discountTotal),
      subtotal: toMoney(pricing.subtotal),
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: 'Failed to price cart.' },
      { status: 500 },
    );
  }
}
