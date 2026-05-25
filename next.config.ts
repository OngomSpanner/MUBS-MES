import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
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