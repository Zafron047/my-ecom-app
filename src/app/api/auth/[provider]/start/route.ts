import { NextRequest, NextResponse } from 'next/server';
import {
  buildAuthorizationUrl,
  createOAuthState,
  getOAuthStateCookieName,
  getProviderCallbackUrl,
  getProviderConfig,
  isCustomerOAuthProvider,
  sanitizeCustomerOAuthNextPath,
} from '@/lib/customer-oauth';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider: rawProvider } = await context.params;
  if (!isCustomerOAuthProvider(rawProvider)) {
    return NextResponse.redirect(new URL('/login?error=oauth_provider', request.url));
  }

  const config = getProviderConfig(rawProvider);
  if (!config) {
    return NextResponse.redirect(new URL('/login?error=oauth_not_configured', request.url));
  }

  const nextPath = sanitizeCustomerOAuthNextPath(
    request.nextUrl.searchParams.get('next'),
  );
  const state = createOAuthState(rawProvider, nextPath);
  if (!state) {
    return NextResponse.redirect(new URL('/login?error=oauth_not_configured', request.url));
  }

  const redirectUri = getProviderCallbackUrl(request, rawProvider);
  const authorizationUrl = buildAuthorizationUrl({
    config,
    provider: rawProvider,
    redirectUri,
    state,
  });

  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set(getOAuthStateCookieName(rawProvider), state, {
    httpOnly: true,
    maxAge: 10 * 60,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  return response;
}
