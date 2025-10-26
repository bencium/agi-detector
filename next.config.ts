import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow builds to succeed even if ESLint finds issues.
  // CI should run `npm run lint` separately to enforce rules.
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
