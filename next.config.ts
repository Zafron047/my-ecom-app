import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    '192.168.100.101',
    '192.168.100.101:3000',
  ],
};

export default nextConfig;
