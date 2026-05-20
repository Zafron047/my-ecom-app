import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

export type CustomerOAuthProvider = 'google' | 'facebook';

export type OAuthProfile = {
  email: string | null;
  firstName: string;
  lastName: string | null;
  name: string;
  provider: CustomerOAuthProvider;
  providerAccountId: string;
};

type ProviderConfig = {
  authUrl: string;
  clientId: string;
  clientSecret: string;
  scope: string;
  tokenUrl: string;
};

const STATE_COOKIE = 'customer_oauth_state';
const STATE_TTL_SECONDS = 10 * 60;

export function isCustomerOAuthProvider(
  value: string,
): value is CustomerOAuthProvider {
  return value === 'google' || value === 'facebook';
}

export function sanitizeCustomerOAuthNextPath(value: unknown): string {
  if (typeof value !== 'string') return '/';

  const trimmed = value.trim();
  if (!trimmed.startsWith('/')) return '/';
  if (trimmed.startsWith('//')) return '/';
  if (trimmed.startsWith('/admin')) return '/';
  if (trimmed.startsWith('/api/')) return '/';
  return trimmed;
}

export function getOAuthStateCookieName(provider: CustomerOAuthProvider) {
  return `${STATE_COOKIE}_${provider}`;
}

export function getProviderConfig(
  provider: CustomerOAuthProvider,
): ProviderConfig | null {
  if (provider === 'google') {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;
    return {
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      clientId,
      clientSecret,
      scope: 'openid email profile',
      tokenUrl: 'https://oauth2.googleapis.com/token',
    };
  }

  const clientId = process.env.FACEBOOK_CLIENT_ID;
  const clientSecret = process.env.FACEBOOK_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const version = process.env.FACEBOOK_API_VERSION || 'v20.0';
  return {
    authUrl: `https://www.facebook.com/${version}/dialog/oauth`,
    clientId,
    clientSecret,
    scope: 'email,public_profile',
    tokenUrl: `https://graph.facebook.com/${version}/oauth/access_token`,
  };
}

export function getRequestOrigin(request: Request) {
  const configuredOrigin =
    process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '';
  if (configuredOrigin) return configuredOrigin.replace(/\/$/, '');
  return new URL(request.url).origin;
}

export function getProviderCallbackUrl(
  request: Request,
  provider: CustomerOAuthProvider,
) {
  return `${getRequestOrigin(request)}/api/auth/${provider}/callback`;
}

function getStateSecret() {
  return process.env.CUSTOMER_OAUTH_STATE_SECRET || process.env.ADMIN_AUTH_SECRET || '';
}

function signStatePayload(payload: string) {
  const secret = getStateSecret();
  if (!secret) return null;
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function createOAuthState(
  provider: CustomerOAuthProvider,
  nextPath: string,
) {
  const nonce = randomBytes(24).toString('hex');
  const expiresAt = Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS;
  const payload = Buffer.from(
    JSON.stringify({ expiresAt, nextPath, nonce, provider }),
  ).toString('base64url');
  const signature = signStatePayload(payload);
  if (!signature) return null;
  return `${payload}.${signature}`;
}

export function verifyOAuthState(
  state: string | null,
  cookieValue: string | undefined,
  provider: CustomerOAuthProvider,
) {
  if (!state || !cookieValue || state !== cookieValue) return null;
  const [payload, signature] = state.split('.');
  if (!payload || !signature) return null;

  const expected = signStatePayload(payload);
  if (!expected) return null;
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (
    expectedBuffer.length !== actualBuffer.length ||
    !timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      expiresAt?: unknown;
      nextPath?: unknown;
      provider?: unknown;
    };
    if (parsed.provider !== provider) return null;
    if (
      typeof parsed.expiresAt !== 'number' ||
      Math.floor(Date.now() / 1000) > parsed.expiresAt
    ) {
      return null;
    }
    return {
      nextPath: sanitizeCustomerOAuthNextPath(parsed.nextPath),
    };
  } catch {
    return null;
  }
}

export function buildAuthorizationUrl({
  config,
  provider,
  redirectUri,
  state,
}: {
  config: ProviderConfig;
  provider: CustomerOAuthProvider;
  redirectUri: string;
  state: string;
}) {
  const authUrl = new URL(config.authUrl);
  authUrl.searchParams.set('client_id', config.clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', config.scope);
  authUrl.searchParams.set('state', state);

  if (provider === 'google') {
    authUrl.searchParams.set('access_type', 'online');
    authUrl.searchParams.set('include_granted_scopes', 'true');
    authUrl.searchParams.set('prompt', 'select_account');
  }

  return authUrl;
}

export async function exchangeCodeForToken({
  code,
  config,
  redirectUri,
}: {
  code: string;
  config: ProviderConfig;
  redirectUri: string;
}) {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { access_token?: string };
  return payload.access_token ?? null;
}

export async function fetchOAuthProfile(
  provider: CustomerOAuthProvider,
  accessToken: string,
): Promise<OAuthProfile | null> {
  if (provider === 'google') {
    const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      email?: string;
      family_name?: string;
      given_name?: string;
      name?: string;
      sub?: string;
    };
    if (!payload.sub) return null;
    const name = payload.name?.trim() || payload.email?.split('@')[0] || 'Google Customer';
    return {
      email: payload.email?.trim().toLowerCase() || null,
      firstName: payload.given_name?.trim() || name.split(/\s+/)[0] || 'Customer',
      lastName: payload.family_name?.trim() || null,
      name,
      provider,
      providerAccountId: payload.sub,
    };
  }

  const version = process.env.FACEBOOK_API_VERSION || 'v20.0';
  const profileUrl = new URL(`https://graph.facebook.com/${version}/me`);
  profileUrl.searchParams.set('fields', 'id,name,email,first_name,last_name');
  profileUrl.searchParams.set('access_token', accessToken);

  const response = await fetch(profileUrl);
  if (!response.ok) return null;
  const payload = (await response.json()) as {
    email?: string;
    first_name?: string;
    id?: string;
    last_name?: string;
    name?: string;
  };
  if (!payload.id) return null;
  const name = payload.name?.trim() || payload.email?.split('@')[0] || 'Facebook Customer';
  return {
    email: payload.email?.trim().toLowerCase() || null,
    firstName: payload.first_name?.trim() || name.split(/\s+/)[0] || 'Customer',
    lastName: payload.last_name?.trim() || null,
    name,
    provider,
    providerAccountId: payload.id,
  };
}
