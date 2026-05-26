import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendOrderInvoiceEmail } from '../src/lib/order-invoice-email';

const mocks = vi.hoisted(() => ({
  sendMail: vi.fn(),
}));

vi.mock('@/lib/mail', () => ({
  sendMail: mocks.sendMail,
}));

vi.mock('@/lib/storefront-data', () => ({
  getBusinessProfile: vi.fn(async () => ({
    businessName: 'BDBuyEasy',
    tagline: 'Easy deals everyday',
    logoUrl: '/business-logo.png',
    logoAlt: 'BDBuyEasy logo',
    phone: '01712345678',
    email: 'support@bdbuyeasy.com',
    address: 'Oli Miar Tek, Shewrapara, Mirpur, Dhaka',
    websiteUrl: 'https://bdbuyeasy.com',
    returnRefundPolicy: 'Check items during delivery.',
  })),
}));

function order(overrides: Record<string, unknown> = {}) {
  return {
    address: 'House 10',
    deliveryCharge: 80,
    discountAmount: 0,
    district: 'Dhaka',
    division: 'Dhaka',
    email: ' Customer@Example.Test ',
    firstName: 'Nina',
    lastName: 'Khan',
    orderNumber: 'ORD-1001',
    paymentMethod: 'COD',
    phone: '01712345678',
    placedAt: new Date('2026-05-25T12:00:00.000Z'),
    products: [
      {
        bundleTitle: null,
        lineTotal: 1000,
        productName: 'Shoe',
        quantity: 2,
        sku: 'SKU-1',
        unitPrice: 500,
        variantLabel: 'Black / 42',
      },
    ],
    subtotalAmount: 1000,
    thana: 'Mirpur',
    totalAmount: 1080,
    ...overrides,
  } as Parameters<typeof sendOrderInvoiceEmail>[0];
}

describe('order invoice email', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sendMail.mockResolvedValue({ sent: true });
    process.env.NEXT_PUBLIC_APP_URL = 'https://bdbuyeasy.com';
  });

  it('sends an invoice to the customer email', async () => {
    await sendOrderInvoiceEmail(order());

    expect(mocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'order-invoice-ORD-1001',
        subject: 'Invoice for order ORD-1001',
        to: 'customer@example.test',
      }),
    );
    const message = mocks.sendMail.mock.calls[0][0];
    expect(message.text).toContain('BDBuyEasy invoice');
    expect(message.text).toContain('Invoice for ORD-1001');
    expect(message.text).toContain('Shoe - Black / 42 x 2: BDT 1,000');
    expect(message.text).toContain('Business phone: 01712345678');
    expect(message.html).toContain('https://bdbuyeasy.com/order-confirmation?orderId=ORD-1001');
    expect(message.html).toContain('https://bdbuyeasy.com/business-logo.png');
    expect(message.html).toContain('Check items during delivery.');
  });

  it('skips delivery when the order has no valid email', async () => {
    const result = await sendOrderInvoiceEmail(order({ email: 'bad-email' }));

    expect(result).toEqual({ reason: 'missing_email', sent: false });
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });
});
