import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:3001/api/:path*",
      },
    ];
  },
  images: {
    remotePatterns: [
      { hostname: "github.com" },
      { hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
