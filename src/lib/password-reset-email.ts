import { sendMail } from '@/lib/mail';

type PasswordResetEmailInput = {
  expiresAt: Date;
  resetLink: string;
  to: string;
};

function formatExpiry(expiresAt: Date) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Dhaka',
  }).format(expiresAt);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function sendCustomerPasswordResetEmail({
  expiresAt,
  resetLink,
  to,
}: PasswordResetEmailInput) {
  const expiry = formatExpiry(expiresAt);

  return sendMail({
    html: `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
        <h1 style="font-size: 20px;">Reset your password</h1>
        <p>We received a request to reset your BDBuyEasy password.</p>
        <p>
          <a href="${escapeHtml(resetLink)}" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 10px 16px; border-radius: 6px; text-decoration: none; font-weight: 700;">
            Reset password
          </a>
        </p>
        <p>This link expires at ${escapeHtml(expiry)}.</p>
        <p>If the button does not work, open this link:</p>
        <p><a href="${escapeHtml(resetLink)}">${escapeHtml(resetLink)}</a></p>
        <p>If you did not request this, you can ignore this email.</p>
      </div>
    `,
    subject: 'Reset your password',
    text: [
      'We received a request to reset your password.',
      `Reset your password: ${resetLink}`,
      `This link expires at ${expiry}.`,
      'If you did not request this, you can ignore this email.',
    ].join('\n\n'),
    to,
  });
}

export async function sendAdminPasswordResetEmail({
  expiresAt,
  resetLink,
  to,
}: PasswordResetEmailInput) {
  const expiry = formatExpiry(expiresAt);

  return sendMail({
    html: `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
        <h1 style="font-size: 20px;">Reset your admin password</h1>
        <p>An admin password reset link was requested for your BDBuyEasy account.</p>
        <p>
          <a href="${escapeHtml(resetLink)}" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 10px 16px; border-radius: 6px; text-decoration: none; font-weight: 700;">
            Reset admin password
          </a>
        </p>
        <p>This one-time link expires at ${escapeHtml(expiry)}.</p>
        <p>If the button does not work, open this link:</p>
        <p><a href="${escapeHtml(resetLink)}">${escapeHtml(resetLink)}</a></p>
        <p>If you did not request this, contact another administrator.</p>
      </div>
    `,
    subject: 'Reset your admin password',
    text: [
      'An admin password reset link was requested for your account.',
      `Reset your admin password: ${resetLink}`,
      `This one-time link expires at ${expiry}.`,
      'If you did not request this, contact another administrator.',
    ].join('\n\n'),
    to,
  });
}
