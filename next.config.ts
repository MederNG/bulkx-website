import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  // Keep the last page around so Overview ↔ Aura ↔ Tools feel instant.
  experimental: {
    staleTimes: {
      dynamic: 180,
      static: 300,
    },
  },
  // leaderboard.json is tens of thousands of rows. Watching it (and the rest
  // of data/) makes Fast Refresh stall or never finish on this machine.
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ["**/node_modules/**", "**/.git/**", "**/data/**"],
      };
    }
    return config;
  },
};

export default nextConfig;
