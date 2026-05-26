import type { Prisma } from '@prisma/client';
import { sendMail } from '@/lib/mail';
import { businessData } from '@/lib/business-data';
import { getBusinessProfile } from '@/lib/storefront-data';

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

function absoluteUrl(value: string | undefined) {
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!appUrl) return value;

  return `${appUrl.replace(/\/$/, '')}/${value.replace(/^\//, '')}`;
}

export async function sendOrderInvoiceEmail(order: OrderForInvoice) {
  const to = order.email?.trim().toLowerCase();
  if (!to || !EMAIL_PATTERN.test(to)) {
    return { reason: 'missing_email' as const, sent: false as const };
  }

  const businessProfile = await getBusinessProfile();
  const businessName = businessProfile.businessName || businessData.name;
  const businessLogoUrl = absoluteUrl(businessProfile.logoUrl || businessData.logo);
  const businessLogoAlt = businessProfile.logoAlt || businessData.logoAlt;
  const businessPhone = businessProfile.phone;
  const businessEmail = businessProfile.email;
  const businessAddress = businessProfile.address;
  const businessWebsite = businessProfile.websiteUrl || businessData.websiteUrl;
  const returnRefundPolicy = businessProfile.returnRefundPolicy;
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
    `${businessName} invoice`,
    `Invoice for ${order.orderNumber}`,
    `Placed: ${formatDate(order.placedAt)}`,
    '',
    businessAddress ? `Business address: ${businessAddress}` : '',
    businessPhone ? `Business phone: ${businessPhone}` : '',
    businessEmail ? `Business email: ${businessEmail}` : '',
    businessWebsite ? `Website: ${businessWebsite}` : '',
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
    returnRefundPolicy ? `Return/refund policy: ${returnRefundPolicy}` : '',
  ].filter(Boolean);

  return sendMail({
    html: `
      <div style="margin: 0; padding: 24px; background: #f8fafc; color: #111827; font-family: Arial, sans-serif;">
        <div style="max-width: 680px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden;">
          <div style="padding: 24px; background: #111827; color: #ffffff;">
            <table style="width: 100%; border-collapse: collapse;">
              <tbody>
                <tr>
                  <td style="vertical-align: top;">
                    ${
                      businessLogoUrl
                        ? `<img src="${escapeHtml(businessLogoUrl)}" alt="${escapeHtml(businessLogoAlt)}" style="display: block; max-width: 132px; max-height: 54px; object-fit: contain; margin-bottom: 12px;" />`
                        : ''
                    }
                    <p style="margin: 0 0 6px; color: #d1d5db;">Thanks for your order</p>
                    <h1 style="margin: 0; font-size: 24px;">Invoice ${escapeHtml(order.orderNumber)}</h1>
                  </td>
                  <td style="vertical-align: top; text-align: right;">
                    <p style="margin: 0; font-size: 18px; font-weight: 700;">${escapeHtml(businessName)}</p>
                    ${
                      businessAddress
                        ? `<p style="margin: 6px 0 0; color: #d1d5db; font-size: 13px;">${escapeHtml(businessAddress)}</p>`
                        : ''
                    }
                    ${
                      businessPhone
                        ? `<p style="margin: 6px 0 0; color: #d1d5db; font-size: 13px;">${escapeHtml(businessPhone)}</p>`
                        : ''
                    }
                  </td>
                </tr>
              </tbody>
            </table>
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
            ${
              returnRefundPolicy
                ? `<p style="margin: 24px 0 0; color: #4b5563; font-size: 13px;"><strong>Return/refund policy:</strong> ${escapeHtml(returnRefundPolicy)}</p>`
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
