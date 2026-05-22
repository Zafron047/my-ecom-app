import type { NextConfig } from 'next';

const allowedDevOrigins = process.env.NEXT_ALLOWED_DEV_ORIGINS
  ?.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function getSupabaseProjectUrlFromDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return undefined;

  try {
    const parsedUrl = new URL(databaseUrl);
    const usernameProjectRef = decodeURIComponent(parsedUrl.username).match(
      /^postgres\.([a-z0-9]+)$/i,
    )?.[1];
    const hostProjectRef = parsedUrl.hostname.match(
      /^(?:db|pooler)\.([a-z0-9]+)\.supabase\.co$/i,
    )?.[1];
    const projectRef = usernameProjectRef ?? hostProjectRef;

    return projectRef ? `https://${projectRef}.supabase.co` : undefined;
  } catch {
    return undefined;
  }
}

const supabaseUrl =
  process.env.SUPABASE_URL?.replace(/\/$/, '') ??
  getSupabaseProjectUrlFromDatabaseUrl();
const supabaseStorageHostname = supabaseUrl
  ? new URL(supabaseUrl).hostname
  : undefined;
const disableImageOptimization =
  process.env.NEXT_DISABLE_IMAGE_OPTIMIZATION === 'true';
const privateNoStoreHeaders = [
  {
    key: 'Cache-Control',
    value: 'private, no-store, max-age=0, must-revalidate',
  },
  {
    key: 'Pragma',
    value: 'no-cache',
  },
  {
    key: 'Expires',
    value: '0',
  },
];

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  async headers() {
    return [
      '/api/admin/:path*',
      '/api/account/:path*',
      '/api/auth/:path*',
      '/api/cart/:path*',
      '/api/checkout/:path*',
      '/api/customers/:path*',
      '/api/login',
      '/api/logout',
      '/api/orders/:path*',
      '/api/password-reset/:path*',
      '/api/register',
    ].map((source) => ({
      source,
      headers: privateNoStoreHeaders,
    }));
  },
  ...(allowedDevOrigins?.length
    ? { allowedDevOrigins }
    : {}),
  ...(supabaseStorageHostname
    ? {
        images: {
          unoptimized: disableImageOptimization,
          remotePatterns: [
            {
              hostname: 'images.unsplash.com',
              protocol: 'https',
            },
            {
              hostname: supabaseStorageHostname,
              pathname: '/storage/v1/object/public/**',
              protocol: 'https',
            },
          ],
        },
      }
    : {
        images: {
          unoptimized: disableImageOptimization,
          remotePatterns: [
            {
              hostname: 'images.unsplash.com',
              protocol: 'https',
            },
          ],
        },
      }),
};

export default nextConfig;
