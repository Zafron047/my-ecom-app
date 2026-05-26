import { Resend } from 'resend';

type SendMailInput = {
  html: string;
  idempotencyKey?: string;
  subject: string;
  text: string;
  to: string;
};

export type SendMailResult =
  | { sent: true }
  | { reason: 'not_configured'; sent: false };

let resendClient: Resend | null = null;
let resendClientApiKey: string | null = null;

function getMailConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.MAIL_FROM?.trim();

  if (!apiKey || !from) return null;
  return { apiKey, from };
}

function getResend(apiKey: string) {
  if (!resendClient || resendClientApiKey !== apiKey) {
    resendClient = new Resend(apiKey);
    resendClientApiKey = apiKey;
  }

  return resendClient;
}

export async function sendMail({
  html,
  idempotencyKey,
  subject,
  text,
  to,
}: SendMailInput): Promise<SendMailResult> {
  const config = getMailConfig();
  if (!config) {
    return { reason: 'not_configured', sent: false };
  }

  const resend = getResend(config.apiKey);
  const { error } = await resend.emails.send(
    {
      from: config.from,
      html,
      subject,
      text,
      to,
    },
    idempotencyKey ? { idempotencyKey } : undefined,
  );

  if (error) {
    throw new Error(error.message);
  }

  return { sent: true };
}
