import type { Prisma } from '@prisma/client';
import { sendMail } from '@/lib/mail';

type OrderForInvoice = Prisma.OrderGetPayload<{ include: { products: true } }>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function money(value: Prisma.Decimal | number) {
  return `BDT ${Number(value).toLocaleString('en-BD', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })}`;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('en-BD', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Dhaka',
  }).format(value);
}

function orderLink(orderNumber: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!appUrl) return null;
  return `${appUrl.replace(/\/$/, '')}/order-confirmation?orderId=${encodeURIComponent(orderNumber)}`;
}

export async function sendOrderInvoiceEmail(order: OrderForInvoice) {
  const to = order.email?.trim().toLowerCase();
  if (!to || !EMAIL_PATTERN.test(to)) {
    return { reason: 'missing_email' as const, sent: false as const };
  }

  const customerName = [order.firstName, order.lastName].filter(Boolean).join(' ');
  const address = [order.address, order.thana, order.district, order.division]
    .filter(Boolean)
    .join(', ');
  const confirmationLink = orderLink(order.orderNumber);

  const itemRows = order.products
    .map((item) => {
      const productLabel = [item.productName, item.variantLabel].filter(Boolean).join(' - ');
      return `
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
            <div style="font-weight: 700;">${escapeHtml(productLabel)}</div>
            <div style="color: #6b7280; font-size: 13px;">SKU: ${escapeHtml(item.sku)}</div>
            ${
              item.bundleTitle
                ? `<div style="color: #047857; font-size: 13px;">${escapeHtml(item.bundleTitle)}</div>`
                : ''
            }
          </td>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">${money(item.unitPrice)}</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">${money(item.lineTotal)}</td>
        </tr>
      `;
    })
    .join('');

  const textLines = [
    `Invoice for ${order.orderNumber}`,
    `Placed: ${formatDate(order.placedAt)}`,
    '',
    `Customer: ${customerName}`,
    `Phone: ${order.phone}`,
    `Delivery address: ${address}`,
    `Payment method: ${order.paymentMethod}`,
    '',
    'Items:',
    ...order.products.map((item) => {
      const productLabel = [item.productName, item.variantLabel].filter(Boolean).join(' - ');
      return `- ${productLabel} x ${item.quantity}: ${money(item.lineTotal)}`;
    }),
    '',
    `Subtotal: ${money(order.subtotalAmount)}`,
    `Discount: ${money(order.discountAmount)}`,
    `Delivery: ${money(order.deliveryCharge)}`,
    `Total: ${money(order.totalAmount)}`,
    confirmationLink ? `View order: ${confirmationLink}` : '',
  ].filter(Boolean);

  return sendMail({
    html: `
      <div style="margin: 0; padding: 24px; background: #f8fafc; color: #111827; font-family: Arial, sans-serif;">
        <div style="max-width: 680px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden;">
          <div style="padding: 24px; background: #111827; color: #ffffff;">
            <p style="margin: 0 0 6px; color: #d1d5db;">Thanks for your order</p>
            <h1 style="margin: 0; font-size: 24px;">Invoice ${escapeHtml(order.orderNumber)}</h1>
          </div>
          <div style="padding: 24px;">
            <p style="margin: 0 0 16px;">Hi ${escapeHtml(order.firstName)}, your order has been received.</p>
            <table style="width: 100%; margin-bottom: 20px; border-collapse: collapse;">
              <tbody>
                <tr><td style="padding: 4px 0; color: #6b7280;">Placed</td><td style="padding: 4px 0; text-align: right;">${escapeHtml(formatDate(order.placedAt))}</td></tr>
                <tr><td style="padding: 4px 0; color: #6b7280;">Customer</td><td style="padding: 4px 0; text-align: right;">${escapeHtml(customerName)}</td></tr>
                <tr><td style="padding: 4px 0; color: #6b7280;">Phone</td><td style="padding: 4px 0; text-align: right;">${escapeHtml(order.phone)}</td></tr>
                <tr><td style="padding: 4px 0; color: #6b7280;">Payment</td><td style="padding: 4px 0; text-align: right;">${escapeHtml(order.paymentMethod)}</td></tr>
              </tbody>
            </table>
            <p style="margin: 0 0 8px; font-weight: 700;">Delivery address</p>
            <p style="margin: 0 0 20px; color: #374151;">${escapeHtml(address)}</p>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr>
                  <th style="padding-bottom: 8px; border-bottom: 1px solid #d1d5db; text-align: left;">Item</th>
                  <th style="padding-bottom: 8px; border-bottom: 1px solid #d1d5db; text-align: center;">Qty</th>
                  <th style="padding-bottom: 8px; border-bottom: 1px solid #d1d5db; text-align: right;">Price</th>
                  <th style="padding-bottom: 8px; border-bottom: 1px solid #d1d5db; text-align: right;">Total</th>
                </tr>
              </thead>
              <tbody>${itemRows}</tbody>
            </table>
            <table style="width: 100%; margin-top: 20px; border-collapse: collapse;">
              <tbody>
                <tr><td style="padding: 5px 0;">Subtotal</td><td style="padding: 5px 0; text-align: right;">${money(order.subtotalAmount)}</td></tr>
                <tr><td style="padding: 5px 0;">Discount</td><td style="padding: 5px 0; text-align: right;">${money(order.discountAmount)}</td></tr>
                <tr><td style="padding: 5px 0;">Delivery</td><td style="padding: 5px 0; text-align: right;">${money(order.deliveryCharge)}</td></tr>
                <tr><td style="padding: 10px 0 0; font-size: 18px; font-weight: 700;">Total</td><td style="padding: 10px 0 0; text-align: right; font-size: 18px; font-weight: 700;">${money(order.totalAmount)}</td></tr>
              </tbody>
            </table>
            ${
              confirmationLink
                ? `<p style="margin: 24px 0 0;"><a href="${escapeHtml(confirmationLink)}" style="display: inline-block; background: #111827; color: #ffffff; padding: 10px 14px; border-radius: 6px; text-decoration: none; font-weight: 700;">View order</a></p>`
                : ''
            }
          </div>
        </div>
      </div>
    `,
    idempotencyKey: `order-invoice-${order.orderNumber}`,
    subject: `Invoice for order ${order.orderNumber}`,
    text: textLines.join('\n'),
    to,
  });
}
