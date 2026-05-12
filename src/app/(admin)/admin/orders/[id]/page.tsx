import { notFound } from 'next/navigation';
import { requireAdminPermission } from '@/lib/admin-session';
import OrderDetailsEditor from '@/components/admin/OrderDetailsEditor';
import OrderPrintButton from '@/components/admin/OrderPrintButton';
import SafeImage from '@/components/SafeImage';
import { prisma } from '@/lib/prisma';
import { computeCartPricing } from '@/lib/cart-bundle-pricing';

type OrderDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatTk(value: number) {
  return `Tk ${value.toLocaleString('en-BD', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default async function AdminOrderDetailsPage({
  params,
}: OrderDetailsPageProps) {
  const { id } = await params;
  await requireAdminPermission(`/admin/orders/${id}`, 'orders.read');

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          division: true,
          district: true,
          thana: true,
          address: true,
        },
      },
      products: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              bundleOffers: {
                where: { isActive: true },
                orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
                select: {
                  id: true,
                  title: true,
                  minTotalQty: true,
                  discountPercent: true,
                  variants: {
                    select: { variantId: true },
                  },
                },
              },
            },
          },
          variant: {
            select: {
              id: true,
              color: true,
              size: true,
              sku: true,
              imagePath: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  });

  if (!order) notFound();
  const orderNotes = await prisma.$queryRaw<
    Array<{ id: string; note: string; createdByName: string; createdAt: Date }>
  >`SELECT id, note, "createdByName", "createdAt" FROM "OrderNote" WHERE "orderId" = ${id} ORDER BY "createdAt" DESC`;
  const catalogVariants = await prisma.productVariant.findMany({
    where: {
      isActive: true,
      product: { status: 'active' },
    },
    select: {
      id: true,
      productId: true,
      sku: true,
      color: true,
      size: true,
      price: true,
      imagePath: true,
      product: {
        select: { name: true },
      },
    },
    orderBy: [{ product: { name: 'asc' } }, { sortOrder: 'asc' }],
  });
  const isFulfilled = order.status === 'delivered';
  const effectiveFirstName = isFulfilled
    ? order.firstName
    : order.customer.firstName || order.firstName;
  const effectiveLastName = isFulfilled
    ? order.lastName ?? ''
    : order.customer.lastName ?? order.lastName ?? '';
  const effectivePhone = isFulfilled ? order.phone : order.customer.phone || order.phone;
  const effectiveEmail = isFulfilled
    ? order.email ?? ''
    : order.customer.email ?? order.email ?? '';
  const effectiveDivision = isFulfilled
    ? order.division
    : order.customer.division ?? order.division;
  const effectiveDistrict = isFulfilled
    ? order.district
    : order.customer.district ?? order.district;
  const effectiveThana = isFulfilled ? order.thana : order.customer.thana ?? order.thana;
  const effectiveAddress = isFulfilled
    ? order.address
    : order.customer.address ?? order.address;
  const paidAmountValue =
    order.paidAmount && typeof order.paidAmount.toNumber === 'function'
      ? order.paidAmount.toNumber()
      : 0;
  const productLinesForPricing = order.products.map((item) => ({
    id: item.id,
    productId: item.productId,
    variantId: item.variantId,
    quantity: item.quantity,
    unitPrice: item.unitPrice.toNumber(),
  }));
  const offersByProductId = new Map(
    order.products.map((item) => [
      item.productId,
      (item.product.bundleOffers ?? []).map((offer) => ({
        id: offer.id,
        title: offer.title?.trim() || 'Bundle Offer',
        minTotalQty: offer.minTotalQty,
        discountPercent: offer.discountPercent.toNumber(),
        variantIds: offer.variants.map((entry) => entry.variantId),
        isActive: true,
      })),
    ]),
  );
  const pricingWithCurrentOffers = computeCartPricing(
    productLinesForPricing,
    (productId) => offersByProductId.get(productId) ?? [],
  );
  const eligibleQtyByOfferId = new Map<string, number>();
  for (const line of productLinesForPricing) {
    const offers = offersByProductId.get(line.productId) ?? [];
    for (const offer of offers) {
      const isEligibleVariant =
        offer.variantIds.includes(line.variantId);
      if (!isEligibleVariant) continue;
      eligibleQtyByOfferId.set(
        offer.id,
        (eligibleQtyByOfferId.get(offer.id) ?? 0) + line.quantity,
      );
    }
  }

  return (
    <section className="space-y-5">
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm;
          }

          body * {
            visibility: hidden !important;
          }

          #order-print-sheet,
          #order-print-sheet * {
            visibility: visible !important;
          }

          #order-print-sheet {
            position: fixed;
            left: 0;
            top: 0;
            width: 100%;
            background: white;
            color: black;
            padding: 2mm 4mm;
            margin: 0;
            border: 0;
          }
        }
      `}</style>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{order.orderNumber}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {new Intl.DateTimeFormat('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              }).format(order.placedAt)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <OrderPrintButton />
          </div>
        </div>
      </div>

      <OrderDetailsEditor
        initialOrder={{
          id: order.id,
          updatedAt: order.updatedAt.toISOString(),
          orderStatus: order.status,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.tags.includes('PREPAID_ORDER') ? 'paid' : 'unpaid',
          firstName: effectiveFirstName,
          lastName: effectiveLastName,
          phone: effectivePhone,
          receiverPhone: order.receiverPhone,
          email: effectiveEmail,
          division: effectiveDivision,
          district: effectiveDistrict,
          thana: effectiveThana,
          address: effectiveAddress,
          notes: '',
          noteHistory: orderNotes.map((entry) => ({
            id: entry.id,
            note: entry.note,
            createdByName: entry.createdByName,
            createdAt: entry.createdAt.toISOString(),
          })),
          subtotalAmount: order.subtotalAmount.toNumber(),
          discountAmount: order.discountAmount.toNumber(),
          orderLevelDiscount: Math.max(
            0,
            order.discountAmount.toNumber() -
              order.products.reduce(
                (sum, item) => sum + item.discountAmount.toNumber(),
                0,
              ),
          ),
          deliveryCharge: order.deliveryCharge.toNumber(),
          totalAmount: order.totalAmount.toNumber(),
          paidAmount: paidAmountValue,
          variantCatalog: catalogVariants.map((variant) => ({
            variantId: variant.id,
            productId: variant.productId,
            productName: variant.product.name,
            variantLabel: [variant.color, variant.size].filter(Boolean).join(' / ') || 'Standard',
            sku: variant.sku,
            unitPrice: variant.price.toNumber(),
            imagePath: variant.imagePath ?? '',
          })),
          items: order.products.map((item) => ({
            id: item.id,
            productId: item.productId,
            variantId: item.variantId,
            productName: item.productName,
            variantLabel:
              item.variantLabel ??
                `${item.variant.color || 'Standard'} / ${item.variant.size || 'Standard'}`,
            imagePath: item.imagePath ?? item.variant.imagePath ?? '',
            quantity: item.quantity,
            unitPrice: item.unitPrice.toNumber(),
            discountAmount: item.discountAmount.toNumber(),
            lineTotal: item.lineTotal.toNumber(),
            bundleRule: item.bundleRule,
            appliedBundleTitle:
              item.bundleTitle ??
              pricingWithCurrentOffers.linePricingById[item.id]?.bundleTitle,
            activeBundleOffers: (item.product.bundleOffers ?? []).map((offer) => {
              const eligibleQty = eligibleQtyByOfferId.get(offer.id) ?? 0;
              const variantMatch =
                offer.variants.length === 0 ||
                offer.variants.some((entry) => entry.variantId === item.variantId);
              return {
                id: offer.id,
                title: offer.title?.trim() || 'Bundle Offer',
                minTotalQty: offer.minTotalQty,
                discountPercent: offer.discountPercent.toNumber(),
                variantIds: offer.variants.map((entry) => entry.variantId),
                variantMatch,
                eligibleQty,
                triggered: eligibleQty >= offer.minTotalQty,
              };
            }),
          })),
        }}
      />

      <section
        id="order-print-sheet"
        className="hidden text-[12px] text-black print:block"
      >
        <div className="mx-auto max-w-[760px]">
          <div className="h-[2.5in] overflow-hidden">
            <div className="mb-1 flex items-start justify-between leading-tight">
              <div className="h-14 w-20 overflow-hidden bg-white">
                <img
                  src="/logo.png"
                  alt="BuyEasy logo"
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="leading-tight">
                <p className="text-right text-[20px] font-medium">
                  Receipt / Invoice #{order.orderNumber}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 leading-tight">
              <div className="leading-tight">
                <p className="mb-1 text-[14px] font-semibold uppercase">Shipping Address</p>
                <p className="text-[14px]">{[effectiveFirstName, effectiveLastName].filter(Boolean).join(' ') || '-'}</p>
                <p className="text-[14px]">
                  {[effectiveAddress, effectiveThana, effectiveDistrict].filter(Boolean).join(', ')}
                </p>
                <p className="text-[14px]">{effectiveDivision}, Bangladesh</p>
                <p className="mt-1 text-[14px]">Tel. {order.receiverPhone || '-'}</p>
              </div>
              <div className="leading-tight">
                <p className="mb-1 text-[14px] font-semibold uppercase">Customer</p>
                <p className="text-[14px]">{[effectiveFirstName, effectiveLastName].filter(Boolean).join(' ') || '-'}</p>
                <p className="text-[14px]">
                  {[effectiveAddress, effectiveThana, effectiveDistrict].filter(Boolean).join(', ')}
                </p>
                <p className="text-[14px]">{effectiveDivision}, Bangladesh</p>
                <p className="mt-1 text-[14px]">Tel. {effectivePhone || '-'}</p>
              </div>
              <div className="leading-tight">
                <p className="mb-1 text-[14px] font-semibold uppercase">Payment Method</p>
                <p className="text-[14px]">
                  {order.paymentMethod === 'COD' ? 'Cash on Delivery (COD)' : 'bKash'}
                </p>
                <p className="mb-1 mt-2 text-[14px] font-semibold uppercase">Shipping Method</p>
                <p className="text-[14px]">Home Delivery</p>
              </div>
            </div>
          </div>

          <hr className="my-5 border-0 border-t-[4px] border-black" />

          <div className="grid grid-cols-[1fr_170px_90px_170px] text-[18px] font-semibold uppercase">
            <p>Items</p>
            <p className="text-right">Price</p>
            <p className="text-right">Qty</p>
            <p className="text-right">Item Total</p>
          </div>

          <div className="mt-3 space-y-2 leading-tight">
            {order.products.map((item) => (
              <div key={item.id} className="grid grid-cols-[1fr_170px_90px_170px] items-center gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-16 w-16 overflow-hidden border border-slate-300">
                    <SafeImage
                      src={item.imagePath ?? item.variant.imagePath}
                      alt={item.productName}
                      className="h-full w-full object-cover"
                      fallbackClassName="flex h-full w-full items-center justify-center bg-white px-1 text-center text-[9px] font-medium leading-tight text-slate-400"
                    />
                  </div>
                  <div>
                    <p className="text-[18px] leading-6">{item.productName}</p>
                    <p className="text-[18px]">
                      {item.variantLabel ??
                        `${item.variant.color || 'Standard'} / ${item.variant.size || 'Standard'}`}
                    </p>
                    {item.bundleTitle ? (
                      <p className="text-[14px]">
                        {item.bundleTitle}
                        {item.bundleRule ? ` (${item.bundleRule})` : ''}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="text-right text-[18px]">
                  <p className={item.discountAmount.toNumber() > 0 ? 'line-through' : ''}>
                    {formatTk(item.unitPrice.toNumber())}
                  </p>
                  {item.discountAmount.toNumber() > 0 ? (
                    <>
                      <p>{formatTk(item.unitPrice.toNumber() - item.discountAmount.toNumber())}</p>
                      <p className="text-[15px]">
                        (-{formatTk(item.discountAmount.toNumber())} / unit)
                      </p>
                    </>
                  ) : null}
                </div>
                <p className="text-right text-[18px]">{item.quantity}</p>
                <p className="text-right text-[18px]">{formatTk(item.lineTotal.toNumber())}</p>
              </div>
            ))}
          </div>

          <hr className="my-5 border-0 border-t-[4px] border-black" />

          <div className="ml-auto w-[350px]">
            <div className="space-y-3 text-[20px]">
              <div className="flex justify-between">
                <p>Subtotal</p>
                <p>{formatTk(order.subtotalAmount.toNumber())}</p>
              </div>
              <div className="flex justify-between">
                <p>Shipping</p>
                <p>{formatTk(order.deliveryCharge.toNumber())}</p>
              </div>
              <div className="flex justify-between">
                <p>Total discount</p>
                <p>{formatTk(order.discountAmount.toNumber())}</p>
              </div>
              <div className="flex justify-between font-bold">
                <p>TOTAL (BDT)</p>
                <p>{formatTk(order.totalAmount.toNumber())}</p>
              </div>
              <div className="flex justify-between">
                <p>Total due</p>
                <p>{formatTk(Math.max(0, order.totalAmount.toNumber() - paidAmountValue))}</p>
              </div>
            </div>
            <hr className="mt-4 border-0 border-t-[4px] border-black" />
          </div>

          <div className="mt-12 text-center text-[18px] leading-tight">
            <p>Thank you for shopping with us!</p>
            <p className="mt-3 font-bold">BuyEasy</p>
            <p>Oli Miar Tek, Shewrapara, Mirpur, Dhaka</p>
            <p>01712345678</p>
          </div>
        </div>
      </section>

    </section>
  );
}
