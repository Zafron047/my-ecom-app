import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { allocateInventoryForOrderProduct } from '@/lib/inventory-allocation';

export const WOWMALL_ORDER_PREFIX = 'WM-';
export const WOWMALL_ORDER_DEFAULT_LIMIT = 25;
export const WOWMALL_ORDER_MAX_LIMIT = 50;

type WowMallOrderItemInput = {
  variantId?: string;
  sku?: string;
  productId?: string;
  name?: string;
  productName?: string;
  variantLabel?: string;
  imagePath?: string;
  quantity: number;
  unitPrice?: number;
  price?: number;
  discountAmount?: number;
  lineTotal?: number;
};

export type WowMallOrderPayload = {
  orderNumber?: string | number;
  orderId?: string | number;
  reference?: string | number;
  placedAt?: string;
  customer: {
    firstName: string;
    lastName?: string;
    email?: string;
    phone?: string;
    customerMobile?: string;
    receiverPhone?: string;
    receiverMobile?: string;
  };
  shipping: {
    division?: string;
    district: string;
    thana: string;
    address: string;
  };
  payment?: {
    method?: string;
    paidAmount?: number;
  };
  items: WowMallOrderItemInput[];
  totals?: {
    subtotal?: number;
    discount?: number;
    discountAmount?: number;
    shipping?: number;
    deliveryCharge?: number;
    total?: number;
  };
  notes?: string;
};

export class WowMallOrderValidationError extends Error {
  readonly code = 'VALIDATION_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'WowMallOrderValidationError';
  }
}

function trimText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePhone(phone: string) {
  const trimmed = phone.trim();
  if (trimmed.startsWith('+880')) return `0${trimmed.slice(4)}`;
  return trimmed;
}

function parseMoney(value: unknown, field: string, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new WowMallOrderValidationError(`${field} must be a non-negative number.`);
  }
  return Math.round(parsed * 100) / 100;
}

function parseQuantity(value: unknown, field: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new WowMallOrderValidationError(`${field} must be a positive integer.`);
  }
  return parsed;
}

function parsePlacedAt(value: unknown) {
  if (!value) return new Date();
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new WowMallOrderValidationError('placedAt must be a valid date.');
  }
  return date;
}

function normalizePaymentMethod(value: unknown) {
  const method = trimText(value).toLowerCase();
  if (!method || method === 'cod' || method === 'cash_on_delivery') return 'COD';
  if (method === 'bkash' || method === 'bikash') return 'BKASH';
  throw new WowMallOrderValidationError('payment.method must be cod or bkash.');
}

export function normalizeWowMallOrderNumber(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!raw) {
    throw new WowMallOrderValidationError('WoWMall order number is required.');
  }

  const orderSegment = raw.match(/WM[-_/ ]?([A-Za-z0-9-]+)/i)?.[1] ?? raw;
  const cleaned = orderSegment
    .replace(/^order[/-]/i, '')
    .replace(/^WM[-_/ ]?/i, '')
    .replace(/[^A-Za-z0-9-]/g, '')
    .toUpperCase();

  if (!cleaned || cleaned.length > 80) {
    throw new WowMallOrderValidationError('WoWMall order number is invalid.');
  }

  return `${WOWMALL_ORDER_PREFIX}${cleaned}`;
}

function resolvePayloadOrderNumber(payload: WowMallOrderPayload) {
  return normalizeWowMallOrderNumber(
    payload.orderNumber ?? payload.orderId ?? payload.reference,
  );
}

type VariantRow = Prisma.ProductVariantGetPayload<{
  include: {
    product: {
      select: {
        id: true;
        name: true;
      };
    };
  };
}>;

function variantLabel(variant: VariantRow) {
  return [variant.color, variant.size].filter(Boolean).join(' / ') || 'Standard';
}

function toNumber(value: { toNumber: () => number } | number | null | undefined) {
  if (typeof value === 'number') return value;
  return value?.toNumber() ?? 0;
}

function buildItemLookup(inputs: WowMallOrderItemInput[]) {
  const variantIds = [
    ...new Set(inputs.map((item) => trimText(item.variantId)).filter(Boolean)),
  ];
  const skus = [...new Set(inputs.map((item) => trimText(item.sku)).filter(Boolean))];

  return { variantIds, skus };
}

function findVariantForItem(
  item: WowMallOrderItemInput,
  variantsById: Map<string, VariantRow>,
  variantsBySku: Map<string, VariantRow>,
) {
  const variantId = trimText(item.variantId);
  const sku = trimText(item.sku);
  if (variantId && variantsById.has(variantId)) return variantsById.get(variantId)!;
  if (sku && variantsBySku.has(sku)) return variantsBySku.get(sku)!;
  return null;
}

function serializeOrder(order: Prisma.OrderGetPayload<{ include: { products: true } }>) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    reference: `order/${order.orderNumber}`,
    status: order.status,
    paymentMethod: order.paymentMethod,
    customer: {
      firstName: order.firstName,
      lastName: order.lastName ?? '',
      email: order.email ?? '',
      phone: order.phone,
      receiverPhone: order.receiverPhone,
    },
    shipping: {
      division: order.division,
      district: order.district,
      thana: order.thana,
      address: order.address,
    },
    items: order.products.map((item) => ({
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      sku: item.sku,
      productName: item.productName,
      variantLabel: item.variantLabel ?? 'Standard',
      quantity: item.quantity,
      unitPrice: toNumber(item.unitPrice),
      discountAmount: toNumber(item.discountAmount),
      lineTotal: toNumber(item.lineTotal),
    })),
    totals: {
      subtotal: toNumber(order.subtotalAmount),
      discount: toNumber(order.discountAmount),
      shipping: toNumber(order.deliveryCharge),
      total: toNumber(order.totalAmount),
      paid: toNumber(order.paidAmount),
    },
    placedAt: order.placedAt.toISOString(),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

export function parseWowMallOrderListQuery(searchParams: URLSearchParams) {
  const page = parseQuantity(searchParams.get('page') ?? '1', 'page');
  const requestedLimit = parseQuantity(
    searchParams.get('limit') ?? String(WOWMALL_ORDER_DEFAULT_LIMIT),
    'limit',
  );
  const orderNumber = searchParams.get('orderNumber');

  return {
    page,
    limit: Math.min(requestedLimit, WOWMALL_ORDER_MAX_LIMIT),
    orderNumber: orderNumber ? normalizeWowMallOrderNumber(orderNumber) : undefined,
  };
}

export async function listWowMallOrders(query: ReturnType<typeof parseWowMallOrderListQuery>) {
  const where: Prisma.OrderWhereInput = query.orderNumber
    ? { orderNumber: query.orderNumber }
    : { orderNumber: { startsWith: WOWMALL_ORDER_PREFIX } };
  const skip = (query.page - 1) * query.limit;
  const [orders, total] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      include: { products: true },
      orderBy: { placedAt: 'desc' },
      skip,
      take: query.limit,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    orders: orders.map(serializeOrder),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function createWowMallOrder(payload: WowMallOrderPayload) {
  const orderNumber = resolvePayloadOrderNumber(payload);
  const firstName = trimText(payload.customer?.firstName);
  const phone = normalizePhone(
    trimText(payload.customer?.phone) || trimText(payload.customer?.customerMobile),
  );
  const district = trimText(payload.shipping?.district);
  const thana = trimText(payload.shipping?.thana);
  const address = trimText(payload.shipping?.address);

  if (!firstName) throw new WowMallOrderValidationError('customer.firstName is required.');
  if (!phone) throw new WowMallOrderValidationError('customer phone is required.');
  if (!district || !thana || !address) {
    throw new WowMallOrderValidationError('shipping district, thana, and address are required.');
  }
  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw new WowMallOrderValidationError('At least one order item is required.');
  }

  const existingOrder = await prisma.order.findUnique({
    where: { orderNumber },
    include: { products: true },
  });
  if (existingOrder) {
    return { created: false, order: serializeOrder(existingOrder) };
  }

  const itemLookup = buildItemLookup(payload.items);
  if (itemLookup.variantIds.length === 0 && itemLookup.skus.length === 0) {
    throw new WowMallOrderValidationError('Each order item needs a variantId or sku.');
  }

  const variants = await prisma.productVariant.findMany({
    where: {
      isActive: true,
      OR: [
        ...(itemLookup.variantIds.length > 0 ? [{ id: { in: itemLookup.variantIds } }] : []),
        ...(itemLookup.skus.length > 0 ? [{ sku: { in: itemLookup.skus } }] : []),
      ],
      product: { status: 'active' },
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
  const variantsById = new Map(variants.map((variant) => [variant.id, variant]));
  const variantsBySku = new Map(variants.map((variant) => [variant.sku, variant]));

  const lines = payload.items.map((item, index) => {
    const variant = findVariantForItem(item, variantsById, variantsBySku);
    if (!variant) {
      throw new WowMallOrderValidationError(
        `Item ${index + 1} does not match an active product variant.`,
      );
    }

    const quantity = parseQuantity(item.quantity, `items[${index}].quantity`);
    if (variant.stockQuantity < quantity) {
      throw new WowMallOrderValidationError(
        `${variant.product.name} has only ${variant.stockQuantity} available.`,
      );
    }

    const unitPrice = parseMoney(item.unitPrice ?? item.price, `items[${index}].unitPrice`, toNumber(variant.price));
    const requestedLineTotal = parseMoney(
      item.lineTotal,
      `items[${index}].lineTotal`,
      unitPrice * quantity,
    );
    const derivedDiscount = Math.max(0, unitPrice * quantity - requestedLineTotal) / quantity;
    const discountAmount = parseMoney(
      item.discountAmount,
      `items[${index}].discountAmount`,
      derivedDiscount,
    );
    const lineTotal = Math.max(0, unitPrice * quantity - discountAmount * quantity);

    return {
      variant,
      quantity,
      unitPrice,
      discountAmount,
      lineTotal,
      productName: trimText(item.productName) || trimText(item.name) || variant.product.name,
      variantLabel: trimText(item.variantLabel) || variantLabel(variant),
      imagePath: trimText(item.imagePath) || variant.imagePath || null,
    };
  });

  const lineSubtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const lineDiscount = lines.reduce(
    (sum, line) => sum + line.discountAmount * line.quantity,
    0,
  );
  const lineTotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const subtotalAmount = parseMoney(payload.totals?.subtotal, 'totals.subtotal', lineSubtotal);
  const deliveryCharge = parseMoney(
    payload.totals?.shipping ?? payload.totals?.deliveryCharge,
    'totals.shipping',
    0,
  );
  const discountAmount = parseMoney(
    payload.totals?.discount ?? payload.totals?.discountAmount,
    'totals.discount',
    lineDiscount,
  );
  const totalAmount = parseMoney(
    payload.totals?.total,
    'totals.total',
    Math.max(0, lineTotal + deliveryCharge),
  );
  const paidAmount = parseMoney(payload.payment?.paidAmount, 'payment.paidAmount', 0);
  const paymentMethod = normalizePaymentMethod(payload.payment?.method);
  const placedAt = parsePlacedAt(payload.placedAt);
  const division = trimText(payload.shipping.division) || 'Dhaka';
  const lastName = trimText(payload.customer.lastName) || null;
  const email = trimText(payload.customer.email) || null;
  const receiverPhone = normalizePhone(
    trimText(payload.customer.receiverPhone) ||
      trimText(payload.customer.receiverMobile) ||
      phone,
  );

  const customer =
    (await prisma.customer.findFirst({
      where: { OR: [{ phone }, { phone: trimText(payload.customer.customerMobile) }] },
    })) ??
    (await prisma.customer.create({
      data: {
        firstName,
        lastName,
        email,
        phone,
        division,
        district,
        thana,
        address,
        customerType: 'retail',
        isBlocked: false,
        identifierTag: 'NEW',
      },
    }));

  const order = await prisma.$transaction(async (tx) => {
    const createdOrder = await tx.order.create({
      data: {
        orderNumber,
        customerId: customer.id,
        status: 'pending',
        paymentMethod,
        tags: paidAmount > 0 ? ['PREPAID_ORDER'] : [],
        firstName,
        lastName,
        phone,
        receiverPhone,
        email,
        division,
        district,
        thana,
        address,
        notes: trimText(payload.notes) || `WoWMall order/${orderNumber}`,
        subtotalAmount,
        discountAmount,
        deliveryCharge,
        totalAmount,
        paidAmount,
        placedAt,
        products: {
          create: lines.map((line) => ({
            productId: line.variant.productId,
            variantId: line.variant.id,
            productName: line.productName,
            variantLabel: line.variantLabel,
            imagePath: line.imagePath,
            sku: line.variant.sku,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            discountAmount: line.discountAmount,
            lineTotal: line.lineTotal,
          })),
        },
      },
      include: { products: true },
    });

    for (const line of createdOrder.products) {
      await allocateInventoryForOrderProduct(tx, {
        orderProductId: line.id,
        quantity: line.quantity,
        variantId: line.variantId,
      });
    }

    return createdOrder;
  });

  return { created: true, order: serializeOrder(order) };
}
