import type { NextConfig } from "next";

const lowMemoryBuild = process.env.LOW_MEMORY_BUILD === '1';

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    webpackMemoryOptimizations: true,
    ...(lowMemoryBuild
      ? {
          webpackBuildWorker: false,
          cpus: 1,
        }
      : {}),
  },
  /** Serve runtime uploads via API (reads disk); keeps /uploads/* URLs working in prod. */
  async rewrites() {
    return [{ source: '/uploads/:path*', destination: '/api/uploads/:path*' }];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
};

export default nextConfig;
