import type { NextConfig } from "next";

/** Fail the build if an admin/write secret is accidentally prefixed with NEXT_PUBLIC_. */
function assertNoSecretPublicEnv() {
  const leaked = Object.keys(process.env).filter((key) => {
    if (!key.startsWith("NEXT_PUBLIC_")) return false;
    const upper = key.toUpperCase();
    return (
      upper.includes("SECRET") ||
      upper.includes("PASSWORD") ||
      upper.includes("SMTP") ||
      upper.includes("BLOB") ||
      upper.includes("CRON") ||
      upper.includes("WEB3") ||
      upper.includes("ADMIN") ||
      upper.includes("PRIVATE") ||
      upper.includes("SERVICE_ROLE") ||
      upper.includes("SERVER_KEY") ||
      upper.includes("WRITE_TOKEN") ||
      upper.endsWith("_TOKEN")
    );
  });

  if (leaked.length > 0) {
    throw new Error(
      `Refusing to expose server secrets to the browser via ${leaked.join(", ")}. Keep admin keys unprefixed and server-only.`
    );
  }
}

assertNoSecretPublicEnv();

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https:",
      "style-src 'self' 'unsafe-inline' https:",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
      "worker-src 'self' blob:",
      "connect-src 'self' https: blob: data:",
      "frame-src 'self' blob: https://www.google.com https://maps.google.com https://www.google.com.ph",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp", "@img/sharp-win32-x64", "tesseract.js"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
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
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
      {
        protocol: "https",
        hostname: "*.blob.vercel-storage.com",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "https",
        hostname: "*.supabase.in",
      },
    ],
  },
  experimental: {
    optimizePackageImports: ["three", "bootstrap"],
  },
};

export default nextConfig;