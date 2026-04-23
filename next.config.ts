import type { NextConfig } from 'next';

const allowedDevOrigins = process.env.NEXT_ALLOWED_DEV_ORIGINS
  ?.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  distDir: '.next-build',
  ...(allowedDevOrigins?.length
    ? { allowedDevOrigins }
    : {}),
};

export default nextConfig;
