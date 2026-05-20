const NON_MARKETING_ROUTE_PREFIXES = [
  '/_next',
  '/account',
  '/admin',
  '/admin-access',
  '/api',
  '/auth',
  '/forgot-password',
  '/login',
  '/register',
  '/reset-password',
  '/unauthorized',
];

export function isPublicStorefrontMarketingPath(pathname: string | null | undefined) {
  if (!pathname) return false;

  const normalizedPathname = pathname.toLowerCase();
  return !NON_MARKETING_ROUTE_PREFIXES.some(
    (prefix) =>
      normalizedPathname === prefix || normalizedPathname.startsWith(`${prefix}/`),
  );
}
