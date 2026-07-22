import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp", "@img/sharp-win32-x64"],
  async redirects() {
    return [
      {
        source: "/speakers",
        destination: "/events",
        permanent: true,
      },
      {
        source: "/events/:id",
        destination: "/events?overview=:id",
        permanent: false,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  experimental: {
    optimizePackageImports: ["three", "bootstrap"],
  },
};

export default nextConfig;