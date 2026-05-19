export const PUBLIC_STOREFRONT_CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400',
};

export const PRIVATE_NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

export function withPrivateNoStoreHeaders(init: ResponseInit = {}): ResponseInit {
  const headers = new Headers(init.headers);

  for (const [key, value] of Object.entries(PRIVATE_NO_STORE_HEADERS)) {
    headers.set(key, value);
  }

  return {
    ...init,
    headers,
  };
}
