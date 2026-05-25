function normalizeOrigin(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return new URL(trimmed).origin;
  } catch {
    try {
      return new URL(`https://${trimmed}`).origin;
    } catch {
      return null;
    }
  }
}

export function getPublicAppOrigin(requestUrl?: string) {
  const configuredOrigin =
    normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL ?? '') ??
    normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL ?? '') ??
    normalizeOrigin(process.env.APP_URL ?? '');

  if (configuredOrigin) return configuredOrigin;

  const vercelOrigin =
    normalizeOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL ?? '') ??
    normalizeOrigin(process.env.VERCEL_URL ?? '');

  if (vercelOrigin) return vercelOrigin;
  if (requestUrl) return new URL(requestUrl).origin;
  return 'http://localhost:3000';
}
