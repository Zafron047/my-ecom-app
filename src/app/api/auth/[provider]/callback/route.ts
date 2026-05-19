import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  CUSTOMER_AUTH_COOKIE,
  CUSTOMER_SESSION_COOKIE,
  createCustomerSessionToken,
  hashCustomerSessionToken,
} from '@/lib/customer-auth';
import {
  exchangeCodeForToken,
  fetchOAuthProfile,
  getOAuthStateCookieName,
  getProviderCallbackUrl,
  getRequestOrigin,
  getProviderConfig,
  isCustomerOAuthProvider,
  type OAuthProfile,
  verifyOAuthState,
} from '@/lib/customer-oauth';
import { prisma } from '@/lib/prisma';

type SocialAccountRecord = {
  customerId: string;
};

type CustomerRecord = {
  id: string;
  isBlocked: boolean;
};

function redirectWithError(request: Request, error: string) {
  return NextResponse.redirect(new URL(`/login?error=${error}`, request.url));
}

async function createSessionResponse(
  request: Request,
  customerId: string,
  nextPath: string,
) {
  const response = NextResponse.redirect(new URL(nextPath, getRequestOrigin(request)));
  const sessionToken = createCustomerSessionToken();
  const sessionTokenHash = hashCustomerSessionToken(sessionToken);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
  const now = new Date();

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "CustomerSession"
      ("id", "customerId", "sessionTokenHash", "expiresAt", "lastSeenAt", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $5, $5)
    `,
    randomUUID(),
    customerId,
    sessionTokenHash,
    expiresAt,
    now,
  );

  response.cookies.set(CUSTOMER_SESSION_COOKIE, sessionToken, {
    expires: expiresAt,
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  response.cookies.set(CUSTOMER_AUTH_COOKIE, '1', {
    expires: expiresAt,
    httpOnly: false,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  return response;
}

async function findOrCreateSocialCustomer(profile: OAuthProfile) {
  const linkedAccounts = await prisma.$queryRawUnsafe<SocialAccountRecord[]>(
    `
      SELECT "customerId"
      FROM "CustomerSocialAccount"
      WHERE "provider" = $1 AND "providerAccountId" = $2
      LIMIT 1
    `,
    profile.provider,
    profile.providerAccountId,
  );
  const linkedAccount = linkedAccounts[0] ?? null;
  if (linkedAccount) {
    const customer = await prisma.customer.findUnique({
      where: { id: linkedAccount.customerId },
      select: { id: true, isBlocked: true },
    });
    return customer;
  }

  let customer: CustomerRecord | null = null;
  if (profile.email) {
    customer = await prisma.customer.findUnique({
      where: { email: profile.email },
      select: { id: true, isBlocked: true },
    });
  }

  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        email: profile.email,
        firstName: profile.firstName,
        identifierTag: 'NEW',
        isBlocked: false,
        lastName: profile.lastName,
        phone: `oauth:${profile.provider}:${profile.providerAccountId}`,
        customerType: 'retail',
      },
      select: { id: true, isBlocked: true },
    });
  }

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "CustomerSocialAccount"
      ("id", "customerId", "provider", "providerAccountId", "email", "name", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
      ON CONFLICT ("provider", "providerAccountId") DO UPDATE SET
        "customerId" = EXCLUDED."customerId",
        "email" = EXCLUDED."email",
        "name" = EXCLUDED."name",
        "updatedAt" = EXCLUDED."updatedAt"
    `,
    randomUUID(),
    customer.id,
    profile.provider,
    profile.providerAccountId,
    profile.email,
    profile.name,
    new Date(),
  );

  return customer;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider: rawProvider } = await context.params;
  if (!isCustomerOAuthProvider(rawProvider)) {
    return redirectWithError(request, 'oauth_provider');
  }

  const error = request.nextUrl.searchParams.get('error');
  if (error) {
    return redirectWithError(request, 'oauth_cancelled');
  }

  const stateResult = verifyOAuthState(
    request.nextUrl.searchParams.get('state'),
    request.cookies.get(getOAuthStateCookieName(rawProvider))?.value,
    rawProvider,
  );
  if (!stateResult) {
    return redirectWithError(request, 'oauth_state');
  }

  const code = request.nextUrl.searchParams.get('code');
  const config = getProviderConfig(rawProvider);
  if (!code || !config) {
    return redirectWithError(request, 'oauth_not_configured');
  }

  const redirectUri = getProviderCallbackUrl(request, rawProvider);
  const accessToken = await exchangeCodeForToken({ code, config, redirectUri });
  if (!accessToken) {
    return redirectWithError(request, 'oauth_token');
  }

  const profile = await fetchOAuthProfile(rawProvider, accessToken);
  if (!profile) {
    return redirectWithError(request, 'oauth_profile');
  }

  const customer = await findOrCreateSocialCustomer(profile);
  if (!customer || customer.isBlocked) {
    return redirectWithError(request, 'oauth_blocked');
  }

  const response = await createSessionResponse(
    request,
    customer.id,
    stateResult.nextPath,
  );
  response.cookies.delete(getOAuthStateCookieName(rawProvider));
  return response;
}
