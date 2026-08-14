import { getPublicSiteUrl } from "@/lib/security/public-env";

export const CANONICAL_SITE_URL = "https://pna-events.com";

function normalizeBaseUrl(raw: string | undefined | null): string {
  return (raw ?? "").trim().replace(/\/$/, "");
}

function isLocalhostUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  } catch {
    return false;
  }
}

function isVercelAppUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".vercel.app");
  } catch {
    return /vercel\.app/i.test(url);
  }
}

function toPublicSiteUrl(url: string): string {
  if (!url || isVercelAppUrl(url)) return CANONICAL_SITE_URL;
  return url;
}

export function getSiteBaseUrl(): string {
  const fromPublic = normalizeBaseUrl(getPublicSiteUrl());
  if (fromPublic) {
    if (isLocalhostUrl(fromPublic)) return fromPublic;
    return toPublicSiteUrl(fromPublic);
  }

  const fromServer = normalizeBaseUrl(process.env.SITE_URL);
  if (fromServer) {
    if (isLocalhostUrl(fromServer)) return fromServer;
    return toPublicSiteUrl(fromServer);
  }

  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:3000";
  }

  return CANONICAL_SITE_URL;
}
